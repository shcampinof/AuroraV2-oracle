const assert = require('assert/strict');
const { buildGestionEstadoCodigoExpr } = require('../repositories/oracle/personaRepository');
const { buildIsPotentialBeneficiarySql } = require('../repositories/oracle/potentialBeneficiarySql');

const PATCH_MARKER = 'AURORA_REASIGNACION_SISIPEC_V4';
const PREVIOUS_MARKER = 'AURORA_REASIGNACION_SISIPEC_V3';

const DECLARATIONS = `    -- ${PATCH_MARKER}
    v_cierre_automatico   NUMBER := 0;
    v_cambio_regional     NUMBER := 0;
    v_cambio_elegibilidad NUMBER := 0;
    v_situacion_anterior  NUMBER;
    v_gestion_anterior    NUMBER;
    v_estado_anterior     VARCHAR2(50);
    v_regional_actual     DNDP.CAT_ERON_REGIONAL.REGIONAL%TYPE;
    v_regional_nueva      DNDP.CAT_ERON_REGIONAL.REGIONAL%TYPE;
    v_defensor_activo     DNDP.ASIGNACION.NOMBRE_DEFENSOR%TYPE;
    v_asignacion_activa   DNDP.ASIGNACION.ID_ASIGNACION%TYPE;
    v_seq_gestion         NUMBER;
    v_max_gestion         NUMBER;
    v_max_situacion       NUMBER;
`;

function buildTransitionSql() {
  return `            -- ${PATCH_MARKER}: comparar antes de sobrescribir la situación.
            -- La fila de persona serializa esta transición con las asignaciones PAG.
            SELECT ID_PERSONA INTO v_id_persona
              FROM DNDP.PERSONA WHERE ID_PERSONA = v_id_persona FOR UPDATE;

            v_cierre_automatico := 0;
            v_cambio_regional := 0;
            v_cambio_elegibilidad := 0;
            v_situacion_anterior := v_id_situacion_activa;
            v_gestion_anterior := NULL;
            v_estado_anterior := NULL;
            v_regional_actual := NULL;
            v_regional_nueva := NULL;
            v_defensor_activo := NULL;
            v_asignacion_activa := NULL;

            IF v_situacion_anterior IS NULL THEN
                BEGIN
                    SELECT ID_SITUACION INTO v_situacion_anterior
                      FROM DNDP.SITUACION_CARCELARIA
                     WHERE ID_PERSONA = v_id_persona
                     ORDER BY FECHA_REGISTRO DESC NULLS LAST, ID_SITUACION DESC
                     FETCH FIRST 1 ROWS ONLY;
                EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
                END;
            END IF;

            IF v_situacion_anterior IS NOT NULL THEN
                BEGIN
                    SELECT ID_ASIGNACION, NOMBRE_DEFENSOR
                      INTO v_asignacion_activa, v_defensor_activo
                      FROM DNDP.ASIGNACION
                     WHERE ID_PERSONA = v_id_persona AND FECHA_FIN IS NULL
                     ORDER BY FECHA_ASIGNACION DESC NULLS LAST, ID_ASIGNACION DESC
                     FETCH FIRST 1 ROWS ONLY;
                EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
                END;

                BEGIN
                    SELECT g.ID_GESTION, CASE WHEN NVL(s.ACTIVO, 0) <> 1 THEN 'CASO_CERRADO'
                        ELSE (${buildGestionEstadoCodigoExpr('g.DEFENSOR_GESTION')}) END
                      INTO v_gestion_anterior, v_estado_anterior
                      FROM DNDP.GESTION_JURIDICA g
                      JOIN DNDP.SITUACION_CARCELARIA s ON s.ID_SITUACION = g.ID_SITUACION
                     WHERE g.ID_SITUACION = v_situacion_anterior
                     ORDER BY g.FECHA_REGISTRO DESC NULLS LAST, g.ID_GESTION DESC
                     FETCH FIRST 1 ROWS ONLY;
                EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
                END;

                SELECT MAX(TO_CHAR(REGIONAL)) INTO v_regional_actual
                  FROM DNDP.VW_SITUACION_REGIONAL
                 WHERE ID_SITUACION = v_situacion_anterior;
                SELECT NVL(
                         (SELECT MAX(TO_CHAR(c.REGIONAL)) FROM DNDP.CAT_ERON_REGIONAL c
                           WHERE c.ESTABLECIMIENTO = r.ESTABLECIMIENTO),
                         (SELECT MAX(TO_CHAR(c.REGIONAL)) FROM DNDP.CAT_ERON_REGIONAL c
                           WHERE c.DEPARTAMENTO = r.DEPARTAMENTO AND c.MUNICIPIO_SISIPEC = r.MUNICIPIO)
                       ) INTO v_regional_nueva FROM dual;

                IF v_regional_actual IS NOT NULL AND v_regional_nueva IS NOT NULL
                   AND UPPER(TRIM(REGEXP_REPLACE(v_regional_actual, '[[:space:]]+', ' ')))
                     <> UPPER(TRIM(REGEXP_REPLACE(v_regional_nueva, '[[:space:]]+', ' '))) THEN
                    v_cambio_regional := 1;
                END IF;

                IF v_estado_anterior = 'CASO_CERRADO' THEN
                    SELECT COUNT(*) INTO v_cambio_elegibilidad
                      FROM DNDP.SITUACION_CARCELARIA s
                     WHERE s.ID_SITUACION = v_situacion_anterior
                       AND NOT ${buildIsPotentialBeneficiarySql('s.CATEGORIZACION')}
                       AND ${buildIsPotentialBeneficiarySql('r.CATEGORIZACION')};
                END IF;

                IF v_cambio_regional > 0 OR v_cambio_elegibilidad > 0 THEN
                    -- Un cierre anterior conserva su motivo y su responsable.
                    IF v_cambio_regional > 0 AND NVL(v_estado_anterior, '-') <> 'CASO_CERRADO' THEN
                        UPDATE DNDP.GESTION_JURIDICA
                           SET CIERRE_CASO = 'Cierre automático por cambio de regional.',
                               DEFENSOR_GESTION = NVL(DEFENSOR_GESTION, v_defensor_activo),
                               ID_ASIGNACION_GESTION = NVL(ID_ASIGNACION_GESTION, v_asignacion_activa)
                         WHERE ID_GESTION = v_gestion_anterior;
                    END IF;
                    UPDATE DNDP.ASIGNACION SET FECHA_FIN = SYSDATE
                     WHERE ID_PERSONA = v_id_persona AND FECHA_FIN IS NULL;
                    UPDATE DNDP.SITUACION_CARCELARIA SET ACTIVO = 0
                     WHERE ID_PERSONA = v_id_persona AND ACTIVO = 1;

                    SELECT NVL(MAX(ID_SITUACION), 0) INTO v_max_situacion FROM DNDP.SITUACION_CARCELARIA;
                    LOOP
                        SELECT DNDP.SEQ_SITUACION.NEXTVAL INTO v_seq_situacion FROM dual;
                        EXIT WHEN v_seq_situacion > v_max_situacion;
                    END LOOP;
                    INSERT INTO DNDP.SITUACION_CARCELARIA (
                        ID_SITUACION, ID_PERSONA, FECHA_CAPTURA, SITUACION, DELITOS, PROCESO, AUTORIDAD,
                        LUGAR_PRIVACION, ESTABLECIMIENTO, DEPARTAMENTO, MUNICIPIO,
                        PENA, PENA_DIAS, PRIVACION, REDENCION, TIEMPO_EFECTIVO, PORCENTAJE, FASE,
                        ENFOQUE, REQUERIMIENTOS, CATEGORIZACION, FECHA_REGISTRO, ACTIVO, FUENTE,
                        FECHA_CORTE, VENCIMIENTO
                    ) VALUES (
                        v_seq_situacion, v_id_persona, CAST(r.FECHA_CAPTURA AS DATE),
                        v_situacion_norm, r.DELITOS, r.PROCESO, r.AUTORIDAD,
                        'ERON', r.ESTABLECIMIENTO, r.DEPARTAMENTO, r.MUNICIPIO,
                        v_pena_calculada, r.PENA_DIAS, r.PRIVACION, r.REDENCION,
                        r.TIEMPO_EFECTIVO, r.PORCENTAJE, v_fase,
                        (SELECT NVL(TO_NCHAR(r.ENFOQUE), ENFOQUE) FROM DNDP.SITUACION_CARCELARIA
                          WHERE ID_SITUACION = v_situacion_anterior),
                        v_requerimientos, r.CATEGORIZACION, SYSDATE, 1, 'SISIPEC',
                        CAST(r.FECHA_CORTE AS DATE), v_vencimiento
                    );
                    v_id_situacion := v_seq_situacion;
                    v_new_situacion := v_new_situacion + 1;

                    -- Únicamente identidad de la gestión y fecha: no copiar hitos ni defensor.
                    SELECT NVL(MAX(ID_GESTION), 0) INTO v_max_gestion FROM DNDP.GESTION_JURIDICA;
                    LOOP
                        SELECT DNDP.SEQ_GESTION.NEXTVAL INTO v_seq_gestion FROM dual;
                        EXIT WHEN v_seq_gestion > v_max_gestion;
                    END LOOP;
                    INSERT INTO DNDP.GESTION_JURIDICA (ID_GESTION, ID_SITUACION, FECHA_REGISTRO)
                    VALUES (v_seq_gestion, v_id_situacion, SYSTIMESTAMP);
                    v_cierre_automatico := 1;
                END IF;
            END IF;

            IF v_cierre_automatico = 0 THEN

`;
}

function removeDeferredRegionalTransition(source) {
  // Las versiones recientes ya traen un cierre diferido. Su captura debe
  // retirarse para que no termine la gestión nueva creada por este parche.
  if (!source.includes('-- FIX CAMBIO DE REGIONAL: anotar')) return source;
  const capture = /            -- FIX CAMBIO DE REGIONAL: anotar[\s\S]*?            END IF;\n\n(?=            -- Buscar en historial completo por campos CRITICOS)/;
  const apply = /    FOR i IN 1 \.\. v_tras_n LOOP\n[\s\S]*?\n    END LOOP;/;
  assert(capture.test(source) && apply.test(source), 'No se reconoce el cierre diferido por regional; revise el procedimiento.');
  return source.replace(capture, '').replace(apply, `    -- ${PATCH_MARKER}: el traslado se resuelve antes de actualizar la situación.`);
}

function upgradeLifecycle(source) {
  const declarations = new RegExp(`    -- ${PREVIOUS_MARKER}\\n[\\s\\S]*?    v_seq_gestion\\s+NUMBER;\\n`);
  assert(declarations.test(source), 'No se reconocen las declaraciones V3 de SISIPEC.');
  source = source.replace(declarations, DECLARATIONS);
  const start = source.indexOf(`            -- ${PREVIOUS_MARKER}: la comparacion`);
  const end = source.indexOf('            -- Buscar en historial completo por campos CRITICOS', start);
  assert(start >= 0 && end > start, 'No se reconoce la transición V3 de SISIPEC.');
  source = source.slice(0, start) + buildTransitionSql() + source.slice(end);

  // Una recarga debe encontrar primero el caso vigente, aunque el caso anterior
  // tenga los mismos campos críticos. Así no reactiva el cerrado ni mueve sus hitos.
  const historyStart = source.indexOf('            -- Buscar en historial completo por campos CRITICOS');
  const historyEnd = source.indexOf('                v_tiene_historico := 1;', historyStart);
  assert(historyEnd > historyStart, 'No se reconoce la búsqueda de situación histórica.');
  const history = source.slice(historyStart, historyEnd);
  assert(/AND\s+ROWNUM\s*=\s*1;/.test(history), 'La búsqueda histórica no contiene el límite esperado.');
  source = source.slice(0, historyStart) + history.replace(/AND\s+ROWNUM\s*=\s*1;/,
    `ORDER BY ACTIVO DESC, FECHA_REGISTRO DESC NULLS LAST, ID_SITUACION DESC
                FETCH FIRST 1 ROWS ONLY;`) + source.slice(historyEnd);
  return source.replaceAll(PREVIOUS_MARKER, PATCH_MARKER);
}

module.exports = { PATCH_MARKER, removeDeferredRegionalTransition, upgradeLifecycle };
