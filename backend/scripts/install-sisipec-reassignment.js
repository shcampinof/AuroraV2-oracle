const assert = require('assert/strict');
const path = require('path');
require('dotenv').config({
  path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '..', '.env'),
  quiet: true,
});

const db = require('../db/oraclePool');
const { getOracleSchema } = require('../config/oracle');

const PATCH_MARKER = 'AURORA_REASIGNACION_SISIPEC_V3';
const V2_PATCH_MARKER = 'AURORA_REASIGNACION_SISIPEC_V2';
const V1_PATCH_MARKER = 'AURORA_REASIGNACION_SISIPEC_V1';

const DECLARATION_ANCHOR = '    v_tiene_situacion     NUMBER;\n';
const DETECTION_ANCHOR = `            END;

            -- Buscar en historial completo por campos CRITICOS`;
const BRANCH_END_ANCHOR = `            END IF;

            -- ──────────────────────────────────────────────────────
            -- CALIFICACION_CONDUCTA (Caso B) — insercion ordenada`;

const DECLARATIONS = `    -- ${PATCH_MARKER}
    v_cierre_automatico   NUMBER := 0;
    v_cambio_regional     NUMBER := 0;
    v_regional_actual     DNDP.CAT_ERON_REGIONAL.REGIONAL%TYPE;
    v_regional_nueva      DNDP.CAT_ERON_REGIONAL.REGIONAL%TYPE;
    v_cambio_bloque_2     NUMBER := 0;
    v_defensor_activo     DNDP.ASIGNACION.NOMBRE_DEFENSOR%TYPE;
    v_motivo_cierre       DNDP.GESTION_JURIDICA.CIERRE_CASO%TYPE;
    v_seq_gestion         NUMBER;
`;

const DETECTION_AND_TRANSITION = `            END;

            -- ${PATCH_MARKER}: la comparacion se hace antes de que el ETL
            -- actualice la situacion vigente, para conservar el contexto de
            -- las actuaciones anteriores.
            v_cierre_automatico := 0;
            v_cambio_regional   := 0;
            v_regional_actual   := NULL;
            v_regional_nueva    := NULL;
            v_cambio_bloque_2   := 0;
            v_defensor_activo   := NULL;
            v_motivo_cierre     := NULL;

            IF v_tiene_activa = 1 THEN
                BEGIN
                    SELECT NOMBRE_DEFENSOR
                      INTO v_defensor_activo
                      FROM DNDP.ASIGNACION
                     WHERE ID_PERSONA = v_id_persona
                       AND FECHA_FIN IS NULL;
                EXCEPTION
                    WHEN NO_DATA_FOUND THEN
                        v_defensor_activo := NULL;
                END;

                IF v_defensor_activo IS NOT NULL THEN
                    SELECT MAX(TO_CHAR(REGIONAL))
                      INTO v_regional_actual
                      FROM DNDP.VW_SITUACION_REGIONAL
                     WHERE ID_SITUACION = v_id_situacion_activa;

                    SELECT NVL(
                             (SELECT MAX(TO_CHAR(c.REGIONAL))
                                FROM DNDP.CAT_ERON_REGIONAL c
                               WHERE c.ESTABLECIMIENTO = r.ESTABLECIMIENTO),
                             (SELECT MAX(TO_CHAR(c.REGIONAL))
                                FROM DNDP.CAT_ERON_REGIONAL c
                               WHERE c.DEPARTAMENTO = r.DEPARTAMENTO
                                 AND c.MUNICIPIO_SISIPEC = r.MUNICIPIO)
                           )
                      INTO v_regional_nueva
                      FROM dual;

                    IF v_regional_actual IS NOT NULL
                       AND v_regional_nueva IS NOT NULL
                       AND UPPER(TRIM(REGEXP_REPLACE(v_regional_actual, '\\s+', ' ')))
                           <> UPPER(TRIM(REGEXP_REPLACE(v_regional_nueva, '\\s+', ' '))) THEN
                        v_cambio_regional := 1;
                    END IF;

                    SELECT COUNT(*)
                      INTO v_cambio_bloque_2
                      FROM DNDP.SITUACION_CARCELARIA actual
                     WHERE actual.ID_SITUACION = v_id_situacion_activa
                       AND (
                         NVL(TO_CHAR(actual.FECHA_CAPTURA, 'YYYYMMDD'), 'X') <> v_norm_fecha_captura
                         OR NVL(UPPER(TRIM(REGEXP_REPLACE(TO_CHAR(actual.SITUACION), '\\s+', ' '))), 'X') <> v_norm_situacion
                         OR NVL(UPPER(TRIM(REGEXP_REPLACE(TO_CHAR(actual.AUTORIDAD), '\\s+', ' '))), 'X')
                           <> NVL(UPPER(TRIM(REGEXP_REPLACE(TO_CHAR(r.AUTORIDAD), '\\s+', ' '))), 'X')
                         OR NVL(REGEXP_REPLACE(TO_CHAR(actual.PROCESO), '[^0-9]', ''), 'X') <> v_norm_proceso
                         OR NVL(UPPER(TRIM(REGEXP_REPLACE(TO_CHAR(actual.DELITOS), '\\s+', ' '))), 'X')
                           <> NVL(UPPER(TRIM(REGEXP_REPLACE(TO_CHAR(r.DELITOS), '\\s+', ' '))), 'X')
                         OR NVL(actual.PENA_DIAS, -1) <> NVL(r.PENA_DIAS, -1)
                         OR NVL(actual.PRIVACION, -1) <> NVL(r.PRIVACION, -1)
                         OR NVL(actual.REDENCION, -1) <> NVL(r.REDENCION, -1)
                         OR NVL(actual.TIEMPO_EFECTIVO, -1) <> NVL(r.TIEMPO_EFECTIVO, -1)
                         OR NVL(actual.PORCENTAJE, -1) <> NVL(r.PORCENTAJE, -1)
                         OR NVL(UPPER(TRIM(TO_CHAR(actual.FASE))), 'X') <> NVL(UPPER(TRIM(TO_CHAR(v_fase))), 'X')
                         OR NVL(UPPER(TRIM(TO_CHAR(actual.REQUERIMIENTOS))), 'X')
                           <> NVL(UPPER(TRIM(TO_CHAR(v_requerimientos))), 'X')
                         OR NVL(UPPER(TRIM(TO_CHAR(actual.CATEGORIZACION))), 'X')
                           <> NVL(UPPER(TRIM(TO_CHAR(r.CATEGORIZACION))), 'X')
                         OR NVL((
                           SELECT MAX(UPPER(TRIM(TO_CHAR(cc.CALIFICACION_1))))
                             FROM DNDP.CALIFICACION_CONDUCTA cc
                            WHERE cc.ID_SITUACION = actual.ID_SITUACION
                         ), 'X') <> NVL(UPPER(TRIM(TO_CHAR(r.CALIFICACION))), 'X')
                         OR NVL((
                           SELECT MAX(TO_CHAR(cc.FECHA_CALIFICACION_1, 'YYYYMMDD'))
                             FROM DNDP.CALIFICACION_CONDUCTA cc
                            WHERE cc.ID_SITUACION = actual.ID_SITUACION
                         ), 'X') <> NVL(TO_CHAR(CAST(r.FECHA_CALIFICACION AS DATE), 'YYYYMMDD'), 'X')
                       );

                    IF v_cambio_regional > 0
                       OR (
                         UPPER(TRIM(REGEXP_REPLACE(v_defensor_activo, '\\s+', ' '))) = 'EQUIPO PPL DNDP'
                         AND v_cambio_bloque_2 > 0
                       ) THEN
                        IF v_cambio_regional > 0 THEN
                            v_motivo_cierre := 'Cierre automático por cambio de regional.';
                        ELSE
                            v_motivo_cierre := 'Cierre automático por actualización relevante de SISIPEC.';
                        END IF;

                        UPDATE DNDP.GESTION_JURIDICA
                           SET DEFENSOR_GESTION = NVL(DEFENSOR_GESTION, v_defensor_activo),
                               CIERRE_CASO = v_motivo_cierre
                         WHERE ID_GESTION = (
                           SELECT ID_GESTION
                             FROM (
                               SELECT ID_GESTION
                                 FROM DNDP.GESTION_JURIDICA
                                WHERE ID_SITUACION = v_id_situacion_activa
                                ORDER BY FECHA_REGISTRO DESC NULLS LAST, ID_GESTION DESC
                             )
                            WHERE ROWNUM = 1
                         );

                        UPDATE DNDP.ASIGNACION
                           SET FECHA_FIN = SYSDATE
                         WHERE ID_PERSONA = v_id_persona
                           AND FECHA_FIN IS NULL;

                        UPDATE DNDP.SITUACION_CARCELARIA
                           SET ACTIVO = 0
                         WHERE ID_SITUACION = v_id_situacion_activa;

                        SELECT NVL(MAX(ID_SITUACION), 0) + 1
                          INTO v_seq_situacion
                          FROM DNDP.SITUACION_CARCELARIA;

                        INSERT INTO DNDP.SITUACION_CARCELARIA (
                            ID_SITUACION, ID_PERSONA, FECHA_CAPTURA,
                            SITUACION, DELITOS, PROCESO, AUTORIDAD,
                            LUGAR_PRIVACION, ESTABLECIMIENTO, DEPARTAMENTO, MUNICIPIO,
                            PENA, PENA_DIAS, PRIVACION, REDENCION,
                            TIEMPO_EFECTIVO, PORCENTAJE, FASE,
                            REQUERIMIENTOS, CATEGORIZACION, FECHA_REGISTRO, ACTIVO, FUENTE,
                            FECHA_CORTE, VENCIMIENTO
                        ) VALUES (
                            v_seq_situacion, v_id_persona, CAST(r.FECHA_CAPTURA AS DATE),
                            v_situacion_norm, r.DELITOS, r.PROCESO, r.AUTORIDAD,
                            'ERON', r.ESTABLECIMIENTO, r.DEPARTAMENTO, r.MUNICIPIO,
                            v_pena_calculada, r.PENA_DIAS, r.PRIVACION, r.REDENCION,
                            r.TIEMPO_EFECTIVO, r.PORCENTAJE, v_fase,
                            v_requerimientos, r.CATEGORIZACION, SYSDATE, 1, 'SISIPEC',
                            CAST(r.FECHA_CORTE AS DATE), v_vencimiento
                        );

                        v_id_situacion := v_seq_situacion;

                        IF UPPER(TRIM(TO_CHAR(r.CATEGORIZACION))) LIKE 'PRELIMINAR %'
                           OR UPPER(TRIM(TO_CHAR(r.CATEGORIZACION))) = 'UTILIDAD PUBLICA'
                           OR UPPER(TRIM(TO_CHAR(r.CATEGORIZACION))) LIKE '%PRISION DOMICILIARIA%'
                           OR UPPER(TRIM(TO_CHAR(r.CATEGORIZACION))) LIKE '%LIBERTAD CONDICIONAL%'
                           OR UPPER(TRIM(TO_CHAR(r.CATEGORIZACION))) LIKE '%REVISAR POR PENA%' THEN
                            SELECT NVL(MAX(ID_GESTION), 0) + 1
                              INTO v_seq_gestion
                              FROM DNDP.GESTION_JURIDICA;

                            INSERT INTO DNDP.GESTION_JURIDICA (
                              ID_GESTION, ID_SITUACION, DEFENSOR_GESTION, FECHA_REGISTRO
                            ) VALUES (
                              v_seq_gestion, v_id_situacion, NULL, SYSTIMESTAMP
                            );
                        END IF;

                        v_cierre_automatico := 1;
                    END IF;
                END IF;
            END IF;

            IF v_cierre_automatico = 0 THEN

            -- Buscar en historial completo por campos CRITICOS`;

const PRESERVE_HISTORY_REPLACEMENT = `        ELSE

            -- ${PATCH_MARKER}: una ausencia en el nuevo corte finaliza la
            -- vigencia, pero no elimina persona, situacion ni asignaciones.
            UPDATE DNDP.SITUACION_CARCELARIA
               SET ACTIVO = 0,
                   FECHA_REGISTRO = SYSDATE
             WHERE ID_SITUACION = reg.ID_SITUACION;

            UPDATE DNDP.ASIGNACION
               SET FECHA_FIN = SYSDATE
             WHERE ID_PERSONA = reg.ID_PERSONA
               AND FECHA_FIN IS NULL;

            v_cierre_situacion := v_cierre_situacion + 1;

        END IF;`;

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  assert.notEqual(first, -1, `No se encontro el ancla ${label}.`);
  assert.equal(source.indexOf(needle, first + needle.length), -1, `El ancla ${label} no es unica.`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function transformSisipecProcedure(rawSource) {
  let source = String(rawSource || '').replace(/\r\n?/g, '\n');
  assert(source.trim(), 'El procedimiento PRC_CARGA_SISIPEC no tiene codigo fuente visible.');
  if (source.includes(PATCH_MARKER)) return { source, changed: false };

  const v2DepartmentComparison = `                    SELECT COUNT(*)
                      INTO v_cambio_regional
                      FROM DNDP.SITUACION_CARCELARIA actual
                     WHERE actual.ID_SITUACION = v_id_situacion_activa
                       AND NVL(UPPER(TRIM(REGEXP_REPLACE(TO_CHAR(actual.DEPARTAMENTO), '\\s+', ' '))), 'X')
                           <> NVL(UPPER(TRIM(REGEXP_REPLACE(TO_CHAR(r.DEPARTAMENTO), '\\s+', ' '))), 'X');`;
  const v3CatalogComparison = `                    SELECT MAX(TO_CHAR(REGIONAL))
                      INTO v_regional_actual
                      FROM DNDP.VW_SITUACION_REGIONAL
                     WHERE ID_SITUACION = v_id_situacion_activa;

                    SELECT NVL(
                             (SELECT MAX(TO_CHAR(c.REGIONAL))
                                FROM DNDP.CAT_ERON_REGIONAL c
                               WHERE c.ESTABLECIMIENTO = r.ESTABLECIMIENTO),
                             (SELECT MAX(TO_CHAR(c.REGIONAL))
                                FROM DNDP.CAT_ERON_REGIONAL c
                               WHERE c.DEPARTAMENTO = r.DEPARTAMENTO
                                 AND c.MUNICIPIO_SISIPEC = r.MUNICIPIO)
                           )
                      INTO v_regional_nueva
                      FROM dual;

                    IF v_regional_actual IS NOT NULL
                       AND v_regional_nueva IS NOT NULL
                       AND UPPER(TRIM(REGEXP_REPLACE(v_regional_actual, '\\s+', ' ')))
                           <> UPPER(TRIM(REGEXP_REPLACE(v_regional_nueva, '\\s+', ' '))) THEN
                        v_cambio_regional := 1;
                    END IF;`;

  if (source.includes(V1_PATCH_MARKER)) {
    const v1EronAndDepartmentComparison = `                    SELECT COUNT(*)
                      INTO v_cambio_eron
                      FROM DNDP.SITUACION_CARCELARIA actual
                     WHERE actual.ID_SITUACION = v_id_situacion_activa
                       AND (
                         NVL(UPPER(TRIM(REGEXP_REPLACE(TO_CHAR(actual.ESTABLECIMIENTO), '\\s+', ' '))), 'X')
                           <> NVL(UPPER(TRIM(REGEXP_REPLACE(TO_CHAR(r.ESTABLECIMIENTO), '\\s+', ' '))), 'X')
                         OR NVL(UPPER(TRIM(REGEXP_REPLACE(TO_CHAR(actual.DEPARTAMENTO), '\\s+', ' '))), 'X')
                           <> NVL(UPPER(TRIM(REGEXP_REPLACE(TO_CHAR(r.DEPARTAMENTO), '\\s+', ' '))), 'X')
                       );`;
    assert(
      source.includes(v1EronAndDepartmentComparison),
      'La migracion V1 no contiene la comparacion esperada de ERON y departamento.'
    );
    source = source
      .replace(v1EronAndDepartmentComparison, v2DepartmentComparison)
      .replaceAll(V1_PATCH_MARKER, V2_PATCH_MARKER)
      .replaceAll('v_cambio_eron', 'v_cambio_regional')
      .replaceAll(
        'Cierre automático por cambio de ERON o regional.',
        'Cierre automático por cambio de regional.'
      );
  }

  if (source.includes(V2_PATCH_MARKER)) {
    assert(
      source.includes(v2DepartmentComparison),
      'La migracion V2 no contiene la comparacion esperada por departamento.'
    );
    const declarationLine = source.match(/^    v_cambio_regional\s+NUMBER := 0;\n/m)?.[0];
    const resetLine = source.match(/^            v_cambio_regional\s+:= 0;\n/m)?.[0];
    assert(declarationLine, 'La migracion V2 no contiene la declaracion de cambio regional.');
    assert(resetLine, 'La migracion V2 no contiene la inicializacion de cambio regional.');
    source = source
      .replace(
        declarationLine,
        declarationLine +
          '    v_regional_actual     DNDP.CAT_ERON_REGIONAL.REGIONAL%TYPE;\n' +
          '    v_regional_nueva      DNDP.CAT_ERON_REGIONAL.REGIONAL%TYPE;\n'
      )
      .replace(
        resetLine,
        resetLine +
          '            v_regional_actual   := NULL;\n' +
          '            v_regional_nueva    := NULL;\n'
      )
      .replace(v2DepartmentComparison, v3CatalogComparison)
      .replaceAll(V2_PATCH_MARKER, PATCH_MARKER);
    return { source, changed: true };
  }

  source = replaceOnce(
    source,
    DECLARATION_ANCHOR,
    `${DECLARATION_ANCHOR}${DECLARATIONS}`,
    'declaraciones'
  );
  source = replaceOnce(source, DETECTION_ANCHOR, DETECTION_AND_TRANSITION, 'deteccion de cambios');
  source = replaceOnce(
    source,
    BRANCH_END_ANCHOR,
    `            END IF;\n\n            END IF; -- ${PATCH_MARKER}\n\n` +
      `            -- ──────────────────────────────────────────────────────\n` +
      `            -- CALIFICACION_CONDUCTA (Caso B) — insercion ordenada`,
    'fin de ramas de situacion'
  );

  const deletePattern = /        ELSE\n\n            -- ELIMINAR: sin gestiones, sin valor en el modelo\.[\s\S]*?            v_del_persona := v_del_persona \+ 1;\n\n            END IF;\n\n        END IF;/;
  assert(deletePattern.test(source), 'No se encontro el bloque de eliminacion post-carga.');
  source = source.replace(deletePattern, PRESERVE_HISTORY_REPLACEMENT);
  source = source.replaceAll('PRC_CARGA_SISIPEC_V3', 'PRC_CARGA_SISIPEC_V4');

  return { source, changed: true };
}

async function readProcedureSource(owner) {
  const result = await db.execute(
    `SELECT TEXT
       FROM ALL_SOURCE
      WHERE OWNER = :owner
        AND NAME = 'PRC_CARGA_SISIPEC'
        AND TYPE = 'PROCEDURE'
      ORDER BY LINE`,
    { owner },
    { operation: 'sisipecReassignment.readProcedureSource' }
  );
  return (result.rows || []).map((row) => String(row.TEXT || '')).join('');
}

async function compileProcedure(source) {
  const ddl = /^\s*CREATE\s+OR\s+REPLACE\s+/i.test(source)
    ? source
    : `CREATE OR REPLACE ${source}`;
  await db.execute(ddl, {}, {
    autoCommit: true,
    operation: 'sisipecReassignment.compileProcedure',
  });
}

async function readCompilationErrors(owner) {
  const result = await db.execute(
    `SELECT LINE, POSITION, TEXT
       FROM ALL_ERRORS
      WHERE OWNER = :owner
        AND NAME = 'PRC_CARGA_SISIPEC'
        AND TYPE = 'PROCEDURE'
      ORDER BY SEQUENCE`,
    { owner },
    { operation: 'sisipecReassignment.readCompilationErrors' }
  );
  return result.rows || [];
}

async function run({ apply = false } = {}) {
  const owner = getOracleSchema();
  const current = await readProcedureSource(owner);
  const transformed = transformSisipecProcedure(current);

  if (!transformed.changed) {
    return { ok: true, owner, changed: false, applied: false, message: 'La migracion ya esta instalada.' };
  }
  if (!apply) {
    return {
      ok: true,
      owner,
      changed: true,
      applied: false,
      message: 'Diagnostico aprobado. Ejecute con --apply para compilar la migracion.',
    };
  }

  await compileProcedure(transformed.source);
  const errors = await readCompilationErrors(owner);
  if (errors.length) {
    // CREATE OR REPLACE confirma aun si Oracle deja el objeto INVALID. Se
    // restaura la version previa para que una migracion fallida no empeore el
    // ambiente y luego se informa el detalle original de compilacion.
    await compileProcedure(current);
    const detail = errors.map((row) => `${row.LINE}:${row.POSITION} ${row.TEXT}`).join('\n');
    throw new Error(`La migracion no compilo y se restauro la version previa:\n${detail}`);
  }

  return { ok: true, owner, changed: true, applied: true, message: 'Migracion instalada correctamente.' };
}

if (require.main === module) {
  run({ apply: process.argv.includes('--apply') })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    })
    .finally(() => db.closePool());
}

module.exports = {
  PATCH_MARKER,
  run,
  transformSisipecProcedure,
};
