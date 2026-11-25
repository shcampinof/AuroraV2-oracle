-- Referencia suministrada por el usuario el 17 de noviembre de 2026.
-- Solo SELECT. Parámetros enlazados para contrastar los ocho indicadores.
WITH
  FUNCTION normalizar(texto VARCHAR2) RETURN VARCHAR2 IS
    valor VARCHAR2(32767) := texto;
  BEGIN
    valor := REPLACE(valor, UNISTR('\00C3\0081'), 'A');
    valor := REPLACE(valor, UNISTR('\00C3\00A1'), 'A');
    valor := REPLACE(valor, UNISTR('\00C3\2030'), 'E');
    valor := REPLACE(valor, UNISTR('\00C3\00A9'), 'E');
    valor := REPLACE(valor, UNISTR('\00C3\008D'), 'I');
    valor := REPLACE(valor, UNISTR('\00C3\00AD'), 'I');
    valor := REPLACE(valor, UNISTR('\00C3\201C'), 'O');
    valor := REPLACE(valor, UNISTR('\00C3\00B3'), 'O');
    valor := REPLACE(valor, UNISTR('\00C3\0161'), 'U');
    valor := REPLACE(valor, UNISTR('\00C3\00BA'), 'U');
    valor := REPLACE(valor, UNISTR('\00C3\2018'), 'N');
    valor := REPLACE(valor, UNISTR('\00C3\00B1'), 'N');

    RETURN TRANSLATE(
      UPPER(TRIM(REGEXP_REPLACE(
        REPLACE(valor, UNISTR('\00A0'), ' '),
        '[[:space:]]+', ' '
      ))),
      'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑ',
      'AEIOUAEIOUAEIOUN'
    );
  END;

  FUNCTION diligenciado(texto VARCHAR2) RETURN NUMBER IS
  BEGIN
    IF NVL(TRIM(REGEXP_REPLACE(
      REPLACE(texto, UNISTR('\00A0'), ' '),
      '[[:space:]]+', ' '
    )), '-') IN ('-', '--') THEN
      RETURN 0;
    END IF;

    RETURN 1;
  END;

  FUNCTION negativo(texto VARCHAR2) RETURN NUMBER IS
    valor VARCHAR2(32767) := NVL(normalizar(texto), '-');
  BEGIN
    IF valor = 'NO'
      OR valor LIKE 'NO APLICA%'
      OR valor LIKE 'NO CUMPLE%'
    THEN
      RETURN 1;
    END IF;

    RETURN 0;
  END;

parametros_entrada AS (
  SELECT
    TO_DATE(:fechaInicio, 'YYYY-MM-DD') AS fecha_inicio,
    TO_DATE(:fechaFin, 'YYYY-MM-DD') AS fecha_fin,
    :defensorCedula AS cedula_defensor,
    :defensorNombre AS nombre_defensor,

    -- También admite: 'Sin regional identificada'
    :regional AS regional,

    -- NULL: todos los establecimientos de la regional.
    -- Para uno específico: 'CPMS ARMENIA', por ejemplo.
    CAST(:lugar AS VARCHAR2(300)) AS establecimiento,

    -- Valores: 'all', 'condenado', 'sindicado'
    :tipo AS tipo,

    -- 1: incluir fuera de prisión; únicamente con tipo = 'all'.
    -- 0: desactivar esa opción.
    :incluirFueraPrision AS incluir_fuera_prision,

    -- AJUSTE TABLERO. Criterios del tablero en los indicadores 1.1 a 1.6:
    -- 0: solo a condenados; los sindicados conservan la lógica anterior.
    -- 1: a todos, igual que el tablero (el tablero no distingue tipo).
    0 AS aplicar_tablero_sindicados
  FROM dual
),
parametros AS (
  SELECT
    TRUNC(fecha_inicio) AS fecha_inicio,
    TRUNC(fecha_fin) AS fecha_fin,
    REGEXP_REPLACE(cedula_defensor, '[^0-9]', '') AS cedula,
    normalizar(nombre_defensor) AS nombre,
    normalizar(regional) AS regional,
    normalizar(establecimiento) AS establecimiento,
    LOWER(TRIM(tipo)) AS tipo,
    incluir_fuera_prision,
    aplicar_tablero_sindicados
  FROM parametros_entrada
),
eron_aliases AS (
  SELECT j.centro_id, j.alias
  FROM JSON_TABLE(
    TO_CLOB(q'~[
["INPEC_101","EPMSC LETICIA","CPMS LETICIA"],
["INPEC_103","EPMSC SANTA ROSA DE VITERBO (JYP-MUJERES)","CPMS SANTA ROSA DE VITERBO (JYP-MUJERES)"],
["INPEC_104","CPMS CHIQUINQUIRA"],
["INPEC_105","EPMSC DUITAMA","CPMS DUITAMA"],
["INPEC_107","EPMSC GUATEQUE","CPMS GUATEQUE"],
["INPEC_109","CPMS MONIQUIRA"],
["INPEC_110","CPMS RAMIRIQUI"],
["INPEC_112","EPMSC SOGAMOSO","CPMS SOGAMOSO"],
["INPEC_113","COMPLEJO CARCELARIO Y PENITENCIARIO BOGOTA"],
["INPEC_114","CPMS BOGOTA"],
["INPEC_116","EPMSC CAQUEZA","CPMS CAQUEZA"],
["INPEC_117","CPMS CHOCONTA"],
["INPEC_119","CPMS FUSAGASUGA"],
["INPEC_120","CPMS GACHETA"],
["INPEC_124","CPMS LA MESA"],
["INPEC_126","CPMS UBATE"],
["INPEC_127","CPMS VILLETA"],
["INPEC_129","CPAMSM BOGOTA"],
["INPEC_130","CPOMS ACACIAS"],
["INPEC_131","CPMS VILLAVICENCIO","VILLAVICENCIO"],
["INPEC_133","EPMSC GRANADA","CPMS GRANADA"],
["INPEC_136","CPMS MELGAR","MELGAR"],
["INPEC_138","CPMS GIRARDOT"],
["INPEC_139","CPMS NEIVA"],
["INPEC_140","CPMS GARZON"],
["INPEC_141","CPMS LA PLATA"],
["INPEC_142","EPMSC PITALITO"],
["INPEC_143","CPMS FLORENCIA"],
["INPEC_144","EPMSC CHAPARRAL"],
["INPEC_145","CPMS ESPINAL"],
["INPEC_148","CPMS ACACIAS"],
["INPEC_149","CPMS TUNJA"],
["INPEC_150","CPAMS EL BARNE"],
["INPEC_152","CPMS PAZ DE ARIPORO"],
["INPEC_153","CPMS YOPAL"],
["INPEC_156","PMS LA ESPERANZA DE GUADUAS"],
["INPEC_157","PMS LAS HELICONIAS DE FLORENCIA"],
["INPEC_158","CPMS GUAMO"],
["INPEC_202","EPMSC BOLIVAR-CAUCA"],
["INPEC_204","CPMS EL BORDO"],
["INPEC_206","EPMSC PUERTO TEJADA"],
["INPEC_207","EPMSC SANTANDER DE QUILICHAO","SANTANDER DE QUILICHAO"],
["INPEC_208","EPMSC SILVIA","CPMS SILVIA"],
["INPEC_209","CPMSM POPAYAN"],
["INPEC_215","CPMSM PASTO"],
["INPEC_217","CPMS IPIALES"],
["INPEC_219","EPMSC LA UNION"],
["INPEC_221","CPMS TUQUERRES","TUQUERRES"],
["INPEC_222","EPMSC TUMACO","CPMS TUMACO","TUMACO"],
["INPEC_225","CPAMS PALMIRA"],
["INPEC_226","CPMS CALI (ERE)"],
["INPEC_227","CPMS BUGA"],
["INPEC_228","EPMSC BUENAVENTURA","CPMS BUENAVENTURA"],
["INPEC_233","CPMS TULUA"],
["INPEC_235","CPAMS POPAYAN (ERE)"],
["INPEC_238","EPMSC CARTAGO","CPMS CARTAGO"],
["INPEC_239","EPMSC CAICEDONIA","CPMS CAICEDONIA"],
["INPEC_241","EPMSC SEVILLA","CPMS SEVILLA"],
["INPEC_242","COMPLEJO CARCELARIO Y PENITENCIARIO JAMUNDI"],
["INPEC_301","CPMS BARRANQUILLA","CMS BARRANQUILLA"],
["INPEC_303","CPMS CARTAGENA"],
["INPEC_305","CPMS MAGANGUE"],
["INPEC_307","CPMS VALLEDUPAR","EPMSC VALLEDUPAR"],
["INPEC_308","CPMS MONTERIA"],
["INPEC_313","CPMS RIOHACHA"],
["INPEC_314","EPMSC SANTA MARTA","CPMS SANTA MARTA"],
["INPEC_316","EPMSC EL BANCO","CPMS EL BANCO"],
["INPEC_318","EPMSC SAN ANDRES","CPMS SAN ANDRES"],
["INPEC_319","CPMS SINCELEJO"],
["INPEC_322","CPMS BARRANQUILLA (JYP)","EPMSC BARRANQUILLA"],
["INPEC_323","CPAMS VALLEDUPAR"],
["INPEC_324","CPMS TIERRALTA"],
["INPEC_401","EPMSC ARAUCA","CPMS ARAUCA"],
["INPEC_405","EPMSC AGUACHICA","CPMS AGUACHICA"],
["INPEC_407","EPMSC PAMPLONA","CPMS PAMPLONA"],
["INPEC_408","EPMSC OCANA"],
["INPEC_410","CPMS BUCARAMANGA (ERE)"],
["INPEC_411","EPMSC BARRANCABERMEJA","CPMS BARRANCABERMEJA"],
["INPEC_413","EPMSC MALAGA"],
["INPEC_415","EPMS SAN GIL","PMS SAN GIL"],
["INPEC_416","EPMSC SOCORRO","CPMS SOCORRO"],
["INPEC_417","CPMS SAN VICENTE DE CHUCURI"],
["INPEC_418","EPMSC VELEZ"],
["INPEC_420","CPMSM BUCARAMANGA"],
["INPEC_421","CPAMS GIRON","CPMAMS GIRON","GIRON"],
["INPEC_422","COMPLEJO CARCELARIO Y PENITENCIARIO CUCUTA"],
["INPEC_501","CPAMS LA PAZ"],
["INPEC_502","CPMS BELLO"]~')
    || q'~,
["INPEC_505","EPMSC ANDES"],
["INPEC_507","EPMSC BOLIVAR-ANTIOQUIA"],
["INPEC_508","EPMSC CAUCASIA","CPMS CAUCASIA"],
["INPEC_513","CPMS JERICO"],
["INPEC_514","EPMSC LA CEJA"],
["INPEC_515","EPMSC PUERTO BERRIO","CPMS PUERTO BERRIO"],
["INPEC_517","EPMSC SANTA BARBARA"],
["INPEC_518","CPMS SANTO DOMINGO"],
["INPEC_519","EPMSC SANTA ROSA DE OSOS"],
["INPEC_521","EPMSC SONSON","CPMS SONSON"],
["INPEC_523","EPMSC TAMESIS"],
["INPEC_527","EPMSC YARUMAL","CPMS YARUMAL"],
["INPEC_530","EPMSC QUIBDO","CPMS QUIBDO"],
["INPEC_531","CPMS APARTADO"],
["INPEC_533","EPMSC ISTMINA","CPMS ISTMINA"],
["INPEC_535","CPMS PUERTO TRIUNFO"],
["INPEC_537","COMPLEJO CARCELARIO Y PENITENCIARIO PEDREGAL"],
["INPEC_601","CPMS MANIZALES","EPMSC MANIZALES"],
["INPEC_602","EPMSC ANSERMA","CPMS ANSERMA"],
["INPEC_607","EPMSC PACORA","CPMS PACORA"],
["INPEC_608","EPMSC PENSILVANIA","CPMS PENSILVANIA"],
["INPEC_609","EPMSC RIOSUCIO","CPMS RIOSUCIO"],
["INPEC_610","EPMSC SALAMINA","CPMS SALAMINA"],
["INPEC_611","CPMSM MANIZALES","RM MANIZALES"],
["INPEC_612","EPMSC CALARCA","CPMS CALARCA"],
["INPEC_613","CPMS ARMENIA","EPMSC ARMENIA","EMPSC ARMENIA"],
["INPEC_615","CPMSM ARMENIA","RM ARMENIA"],
["INPEC_616","EPMSC PEREIRA (ERE)","CPMS PEREIRA (ERE)"],
["INPEC_617","EPMSC SANTA ROSA DE CABAL","CPMS SANTA ROSA DE CABAL","SANTA ROSA DE CABAL"],
["INPEC_620","RM PEREIRA","CPMSM PEREIRA"],
["INPEC_626","EPMSC FRESNO","CPMS FRESNO"],
["INPEC_628","EPMSC HONDA","CPMS HONDA"],
["INPEC_629","EPMSC LIBANO","CPMS LIBANO"],
["INPEC_633","EPMSC PUERTO BOYACA","CPMS PUERTO BOYACA"],
["INPEC_637","CPAMS LA DORADA"],
["INPEC_639","COMPLEJO CARCELARIO Y PENITENCIARIO IBAGUE"],
["INPEC_9001","CPMMSF FACATATIVA"]
]~',
    '$[*]' COLUMNS (
      centro_id VARCHAR2(30) PATH '$[0]',
      NESTED PATH '$[*]' COLUMNS (
        posicion FOR ORDINALITY,
        alias VARCHAR2(300) PATH '$'
      )
    )
  ) j
  WHERE j.posicion > 1
),
eron_regionales AS (
  SELECT DISTINCT
    a.centro_id,
    normalizar(c.regional) AS regional
  FROM DNDP.CAT_ERON_REGIONAL c
  JOIN eron_aliases a
    ON a.alias = normalizar(c.establecimiento)
  WHERE NVL(c.activo, 1) = 1
    AND TRIM(TO_CHAR(c.regional)) IS NOT NULL
),
situaciones AS (
  SELECT s.*,
    normalizar(COALESCE(
      TRIM(TO_CHAR(s.situacion_juridica_actualizada)),
      TO_CHAR(s.situacion)
    )) AS tipo_normalizado,
    LOWER(COALESCE(
      TRIM(TO_CHAR(s.situacion_juridica_actualizada)),
      TO_CHAR(s.situacion)
    )) AS tipo_filtro,
    normalizar(COALESCE(
      TRIM(TO_CHAR(s.establecimiento)),
      TO_CHAR(s.lugar_privacion)
    )) AS establecimiento_normalizado,
    ROW_NUMBER() OVER (
      PARTITION BY s.id_persona
      ORDER BY
        COALESCE(
          s.fecha_corte,
          CAST(s.fecha_registro AS DATE),
          s.fecha_captura
        ) DESC NULLS LAST,
        CASE WHEN NVL(s.activo, 0) = 1 THEN 0 ELSE 1 END,
        s.fecha_registro DESC NULLS LAST,
        s.fecha_captura DESC NULLS LAST,
        LENGTH(REGEXP_REPLACE(NVL(s.proceso, ''), '[^0-9]', '')) DESC,
        s.id_situacion DESC
    ) AS rn_situacion
  FROM DNDP.SITUACION_CARCELARIA s
),
situaciones_filtradas AS (
  SELECT s.*
  FROM situaciones s
  CROSS JOIN parametros p
  WHERE (
    s.tipo_normalizado LIKE '%CONDENAD%'
    OR s.tipo_normalizado LIKE '%SINDICAD%'
  )
  AND (
    p.tipo = 'all'
    OR (
      p.tipo = 'condenado'
      AND s.tipo_normalizado LIKE '%CONDENAD%'
    )
    OR (
      p.tipo = 'sindicado'
      AND s.tipo_normalizado LIKE '%SINDICAD%'
    )
  )
  AND (
    (
      p.regional = 'SIN REGIONAL IDENTIFICADA'
      AND p.establecimiento IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM eron_regionales r
        JOIN eron_aliases a ON a.centro_id = r.centro_id
        WHERE a.alias = s.establecimiento_normalizado
      )
    )
    OR (
      p.regional <> 'SIN REGIONAL IDENTIFICADA'
      AND EXISTS (
        SELECT 1
        FROM eron_regionales r
        JOIN eron_aliases a ON a.centro_id = r.centro_id
        WHERE a.alias = s.establecimiento_normalizado
          AND r.regional = p.regional
          AND (
            p.establecimiento IS NULL
            OR EXISTS (
              SELECT 1
              FROM eron_aliases seleccionado
              WHERE seleccionado.centro_id = r.centro_id
                AND seleccionado.alias = p.establecimiento
            )
          )
      )
    )
  )
),
gestion_normalizada AS (
  SELECT g.*,
    NVL(normalizar(g.actuacion_adelantar), '-') AS actuacion_n,
    NVL(normalizar(g.sentido_decision), '-') AS decision_n,
    NVL(normalizar(g.se_presenta_recurso), '-') AS recurso_n,
    NVL(normalizar(g.decision_usuario), '-') AS usuario_n,
    NVL(normalizar(g.otras_solicitudes_tramitar), '-') AS otras_n,
    CASE WHEN normalizar(g.cierre_caso) IN (
      'SE CIERRA PORQUE LA PERSONA FUE TRASLADADA A UN ERON DE COMPETENCIA DE OTRA REGIONAL DE LA DEFENSORIA DEL PUEBLO',
      'SE CIERRA PORQUE LA PERSONA SE ENCUENTRA EN LIBERTAD',
      'SE CIERRA PORQUE LA PERSONA YA NO ESTA EN EL ERON POR RAZON AJENA A ESTE TRAMITE.',
      'CIERRE AUTOMATICO POR CAMBIO DE ERON O REGIONAL.',
      'CIERRE AUTOMATICO POR CAMBIO DE REGIONAL.',
      'CIERRE AUTOMATICO POR ACTUALIZACION RELEVANTE DE SISIPEC.',
      'OTRO MOTIVO.'
    ) THEN 1 ELSE 0 END AS cierre_explicito
  FROM DNDP.GESTION_JURIDICA g
),
gestion_utilidad AS (
  SELECT g.*,
    CASE WHEN actuacion_n LIKE '%UTILIDAD PUBLICA%'
      OR (
        diligenciado(g.actuacion_adelantar) = 0
        AND decision_n IN (
          'NIEGA UTILIDAD PUBLICA',
          'OTORGA UTILIDAD PUBLICA'
        )
      )
      THEN 1 ELSE 0
    END AS es_utilidad
  FROM gestion_normalizada g
),
gestion_decision AS (
  SELECT g.*,
    CASE WHEN (
      es_utilidad = 0
      AND decision_n IN (
        'NO CONCEDE LA SOLICITUD',
        'NO CONCEDE SUBROGADO PENAL'
      )
    ) OR (
      es_utilidad = 1
      AND decision_n = 'NIEGA UTILIDAD PUBLICA'
    ) THEN 1 ELSE 0 END AS decision_negativa
  FROM gestion_utilidad g
),
gestiones AS (
  SELECT g.*,
    CASE WHEN s.tipo_normalizado LIKE '%SINDICAD%' THEN
      CASE
        WHEN cierre_explicito = 1
          OR actuacion_n LIKE 'NO SE AVANZARA%'
          OR diligenciado(g.sentido_decision_resuelve_recurso) = 1
          OR decision_n LIKE '%REVOCA MEDIDA%'
          OR decision_n LIKE '%SUSTITUYE MEDIDA%'
          THEN 1

        WHEN g.fecha_decision_recurso IS NOT NULL
          AND diligenciado(g.sentido_decision_resuelve_recurso) = 0
          THEN 0

        WHEN decision_n LIKE '%NIEGA LA SOLICITUD%'
          THEN CASE WHEN recurso_n = 'NO' THEN 1 ELSE 0 END

        ELSE 0
      END
    ELSE
      CASE WHEN (
        negativo(g.libertad_condicional) = 1
        AND negativo(g.prision_domiciliaria_mitad_pena) = 1
        AND negativo(g.procedencia_pena_cumplida) = 1
        AND negativo(g.procedencia_acumulacion_penas) = 1
        AND (
          diligenciado(g.utilidad_publica) = 0
          OR negativo(g.utilidad_publica) = 1
        )
        AND otras_n = 'NINGUNA'
        AND g.fecha_analisis IS NOT NULL
        AND NOT (
          decision_negativa = 1
          AND recurso_n IN ('SI', 'S?')
          AND diligenciado(g.sentido_decision_resuelve_recurso) = 0
        )
      )
      OR cierre_explicito = 1
      OR diligenciado(g.sentido_decision_resuelve_recurso) = 1
      OR (
        diligenciado(g.decision_usuario) = 1
        AND usuario_n NOT LIKE 'SI%'
      )
      OR actuacion_n LIKE '%NINGUNA%'
      OR actuacion_n LIKE '%NO PROCEDE NADA%'
      OR (
        es_utilidad = 1
        AND (
          normalizar(g.cumple_requisito_marginalidad) = 'NO'
          OR normalizar(g.cumple_requisito_jefatura_hogar) = 'NO'
        )
      )
      OR (
        decision_negativa = 1
        AND (
          recurso_n = 'NO'
          OR diligenciado(g.sentido_decision_resuelve_recurso) = 1
        )
      )
      OR (
        es_utilidad = 0
        AND diligenciado(g.sentido_decision) = 1
        AND decision_n NOT IN (
          'NO CONCEDE LA SOLICITUD',
          'NO CONCEDE SUBROGADO PENAL'
        )
      )
      OR (
        es_utilidad = 1
        AND diligenciado(g.sentido_decision) = 1
        AND decision_n <> 'NIEGA UTILIDAD PUBLICA'
      )
      THEN 1 ELSE 0 END
    END AS cerrada
  FROM gestion_decision g
  JOIN situaciones s
    ON s.id_situacion = g.id_situacion
),
-- =====================================================================
-- AJUSTE TABLERO: criterios de las medidas del tablero Power BI
-- (Analisis Juridicos, Casos entrevistados, Solicitudes radicadas,
--  Recursos presentados y medidas de cierre). Se usan solo en
--  base_eventos, es decir, en los indicadores 1.1 a 1.7.
--  ultima_gestion y personas_asignadas (2.1, 2.2 y 2.6) no cambian.
-- =====================================================================
gestion_tablero_1 AS (
  SELECT g.*,
    -- 1 = a esta gestión se le aplican los criterios del tablero
    CASE WHEN s.tipo_normalizado LIKE '%SINDICAD%'
          AND p.aplicar_tablero_sindicados = 0
         THEN 0 ELSE 1 END AS t_aplica,
    -- Analisis Juridicos: los 7 campos del análisis diligenciados
    CASE WHEN g.fecha_analisis IS NOT NULL
      AND diligenciado(g.libertad_condicional) = 1
      AND diligenciado(g.prision_domiciliaria_mitad_pena) = 1
      AND diligenciado(g.procedencia_pena_cumplida) = 1
      AND diligenciado(g.procedencia_acumulacion_penas) = 1
      AND diligenciado(g.otras_solicitudes_tramitar) = 1
      AND diligenciado(SUBSTR(g.resumen_analisis_caso, 1, 400)) = 1
    THEN 1 ELSE 0 END AS t_analisis_completo,
    -- Elegible entrevista: al menos una procedencia (mismos textos del tablero)
    CASE WHEN NVL(normalizar(g.libertad_condicional), '-') LIKE 'SI PROCEDE SOLICITUD DE LIBERTAD CONDICIONAL%'
      OR NVL(normalizar(g.libertad_condicional), '-') LIKE 'SI PROCEDERA PROXIMAMENTE LIBERTAD CONDICIONAL%'
      OR NVL(normalizar(g.prision_domiciliaria_mitad_pena), '-') LIKE 'SI PROCEDE SOLICITUD DE PRISION DOMICILIARIA%'
      OR NVL(normalizar(g.prision_domiciliaria_mitad_pena), '-') LIKE 'SI PROCEDERA PROXIMAMENTE PRISION DOMICILIARIA%'
      OR NVL(normalizar(g.utilidad_publica), '-') = 'SI CUMPLE REQUISITOS OBJETIVOS'
      OR NVL(normalizar(g.procedencia_pena_cumplida), '-') = 'SI'
      OR NVL(normalizar(g.procedencia_acumulacion_penas), '-') = 'SI'
      OR g.otras_n <> 'NINGUNA'
    THEN 1 ELSE 0 END AS t_tiene_procedencia,
    -- Estado entrevista = "Cerrado por decisión"
    CASE WHEN g.usuario_n IN (
      'NO, PORQUE DESEA TRAMITAR LA SOLICITUD A TRAVES DE SU DEFENSOR DE CONFIANZA',
      'NO DESEA TRAMITAR LA SOLICITUD',
      'NO AVANZARA PORQUE NO PUEDE DEMOSTRAR ARRAIGO FUERA DE PRISION',
      'EL USUARIO ES RENUENTE A LA ATENCION'
    ) THEN 1 ELSE 0 END AS t_cerrado_decision,
    -- Estado entrevista = "Entrevista realizada - procede": 5 campos
    CASE WHEN g.fecha_entrevista IS NOT NULL
      AND diligenciado(g.decision_usuario) = 1
      AND diligenciado(g.actuacion_adelantar) = 1
      AND diligenciado(g.requiere_pruebas) = 1
      AND diligenciado(g.poder_avanzar_solicitud) = 1
    THEN 1 ELSE 0 END AS t_entrevista_completa
  FROM gestiones g
  JOIN situaciones s
    ON s.id_situacion = g.id_situacion
  CROSS JOIN parametros p
),
gestion_tablero_2 AS (
  SELECT t.*,
    CASE WHEN t.t_analisis_completo = 1 AND t.t_tiene_procedencia = 1
         THEN 1 ELSE 0 END AS t_elegible,
    -- Solicitudes radicadas: entrevista "procede" + alguna fecha de radicación
    CASE WHEN t.t_analisis_completo = 1 AND t.t_tiene_procedencia = 1
          AND t.t_cerrado_decision = 0 AND t.t_entrevista_completa = 1
          AND (t.fecha_presentacion_solicitud_autoridad IS NOT NULL
               OR t.fecha_radicacion_utilidad IS NOT NULL)
         THEN 1 ELSE 0 END AS t_radicada
  FROM gestion_tablero_1 t
),
gestion_tablero_3 AS (
  SELECT t.*,
    -- Decisión judicial favorable / desfavorable
    CASE WHEN t.t_radicada = 1 AND t.fecha_decision_autoridad IS NOT NULL
          AND t.decision_n IN ('CONCEDE LA SOLICITUD', 'CONCEDE SUBROGADO PENAL', 'OTORGA UTILIDAD PUBLICA')
         THEN 1 ELSE 0 END AS t_favorable,
    CASE WHEN t.t_radicada = 1 AND t.fecha_decision_autoridad IS NOT NULL
          AND t.decision_n IN ('NIEGA UTILIDAD PUBLICA', 'NO CONCEDE LA SOLICITUD', 'NO CONCEDE SUBROGADO PENAL')
         THEN 1 ELSE 0 END AS t_desfavorable
  FROM gestion_tablero_2 t
),
gestion_tablero_4 AS (
  SELECT t.*,
    -- Recursos presentados: desfavorable + fecha de recurso + marcado Sí
    CASE WHEN t.t_desfavorable = 1
          AND t.fecha_presentacion_recurso IS NOT NULL
          AND t.recurso_n IN ('SI', 'S?')
         THEN 1 ELSE 0 END AS t_recurso
  FROM gestion_tablero_3 t
),
gestiones_t AS (
  SELECT t.*,
    -- Cierre = Casos cerrados por analisis juridico
    --        + Solicitudes no procedentes (cerrado por decisión)
    --        + Casos cerrados (favorable, desfavorable sin recurso, recurso resuelto)
    --        + causales escritas en CIERRE_CASO (libertad, traslado de regional, etc.)
    CASE
      WHEN t.t_aplica = 0 THEN t.cerrada
      WHEN t.cierre_explicito = 1
        OR (t.t_analisis_completo = 1 AND t.t_tiene_procedencia = 0)
        OR (t.t_elegible = 1 AND t.t_cerrado_decision = 1)
        OR t.t_favorable = 1
        OR (t.t_desfavorable = 1 AND t.t_recurso = 0)
        OR (t.t_recurso = 1 AND diligenciado(t.sentido_decision_resuelve_recurso) = 1)
      THEN 1 ELSE 0
    END AS t_cerrada,
    CASE
      WHEN t.t_aplica = 1
        AND t.t_recurso = 1
        AND diligenciado(t.sentido_decision_resuelve_recurso) = 1
        THEN CAST(COALESCE(t.fecha_decision_recurso, t.fecha_decision_autoridad) AS DATE)
      WHEN t.t_aplica = 1 AND (t.t_favorable = 1 OR t.t_desfavorable = 1)
        THEN CAST(t.fecha_decision_autoridad AS DATE)
      WHEN t.t_aplica = 1 AND t.t_elegible = 1 AND t.t_cerrado_decision = 1
        THEN CAST(COALESCE(t.fecha_entrevista, t.fecha_analisis) AS DATE)
      WHEN t.t_aplica = 1 AND t.t_analisis_completo = 1 AND t.t_tiene_procedencia = 0
        THEN CAST(t.fecha_analisis AS DATE)
      ELSE CAST(COALESCE(
        t.fecha_decision_recurso,
        t.fecha_decision_autoridad,
        t.fecha_presentacion_recurso,
        t.fecha_recurso_desfavorable,
        t.fecha_entrevista,
        t.fecha_analisis,
        t.fecha_registro
      ) AS DATE)
    END AS t_fecha_cierre
  FROM gestion_tablero_4 t
),
personas_del_defensor AS (
  SELECT a.id_persona
  FROM DNDP.ASIGNACION a
  CROSS JOIN parametros p
  WHERE TO_CHAR(a.cedula_defensor) = p.cedula
    OR (
      a.cedula_defensor IS NULL
      AND normalizar(a.nombre_defensor) = p.nombre
    )

  UNION

  SELECT s.id_persona
  FROM DNDP.GESTION_JURIDICA g
  JOIN DNDP.SITUACION_CARCELARIA s
    ON s.id_situacion = g.id_situacion
  CROSS JOIN parametros p
  WHERE normalizar(g.defensor_gestion) = p.nombre
),
base_eventos AS (
  SELECT
    g.id_gestion,
    g.id_situacion,
    s.id_persona,
    g.defensor_gestion,
    g.fecha_registro AS fecha_registro_gestion,
    g.id_asignacion_gestion,
    ag.cedula_defensor AS cedula_autor_gestion,
    -- AJUSTE TABLERO 1.1: solo análisis completos
    CASE WHEN g.t_aplica = 0 OR g.t_analisis_completo = 1
         THEN CAST(g.fecha_analisis AS DATE) END AS analisis_0,
    -- AJUSTE TABLERO 1.2: caso elegible y entrevista terminada
    -- (completa o cerrada por decisión del usuario)
    CASE WHEN g.t_aplica = 0
           OR (g.t_elegible = 1
               AND (g.t_entrevista_completa = 1 OR g.t_cerrado_decision = 1))
         THEN CAST(g.fecha_entrevista AS DATE) END AS entrevista_1,
    -- AJUSTE TABLERO 1.3: una solicitud por gestión radicada;
    -- no cuenta la audiencia de control
    CASE WHEN g.t_aplica = 0
         THEN CAST(g.fecha_solicitud_audiencia_control AS DATE) END AS solicitud_2,
    CASE WHEN g.t_aplica = 0
           THEN CAST(g.fecha_presentacion_solicitud_autoridad AS DATE)
         WHEN g.t_radicada = 1
           THEN COALESCE(CAST(g.fecha_presentacion_solicitud_autoridad AS DATE),
                         CAST(g.fecha_radicacion_utilidad AS DATE))
    END AS solicitud_3,
    CASE WHEN g.t_aplica = 0
         THEN CAST(g.fecha_radicacion_utilidad AS DATE) END AS solicitud_4,
    CAST(g.fecha_insistencia_1 AS DATE) AS reiteracion_5,
    CAST(g.fecha_insistencia_2 AS DATE) AS reiteracion_6,
    CAST(g.fecha_insistencia_3 AS DATE) AS reiteracion_7,
    CAST(g.fecha_insistencia_4 AS DATE) AS reiteracion_8,
    CAST(g.fecha_insistencia_5 AS DATE) AS reiteracion_9,
    -- AJUSTE TABLERO 1.5: recurso sobre decisión desfavorable, marcado Sí
    CASE WHEN g.t_aplica = 0
           THEN CAST(COALESCE(
             g.fecha_presentacion_recurso,
             g.fecha_recurso_desfavorable
           ) AS DATE)
         WHEN g.t_recurso = 1
           THEN CAST(g.fecha_presentacion_recurso AS DATE)
    END AS recurso_10,
    -- AJUSTE TABLERO 1.6: cierre según las medidas de cierre del tablero
    CASE WHEN g.t_cerrada = 1 THEN g.t_fecha_cierre END AS cierre_11
  FROM gestiones_t g
  JOIN situaciones_filtradas s
    ON s.id_situacion = g.id_situacion
  JOIN DNDP.PERSONA per
    ON per.id_persona = s.id_persona
  JOIN personas_del_defensor alcance
    ON alcance.id_persona = s.id_persona
  LEFT JOIN DNDP.ASIGNACION ag
    ON ag.id_asignacion = g.id_asignacion_gestion
   AND ag.id_persona = s.id_persona
),
eventos AS (
  SELECT
    e.*,
    SUBSTR(origen, 1, INSTR(origen, '_') - 1) AS tipo
  FROM base_eventos
  UNPIVOT (
    fecha FOR origen IN (
      analisis_0 AS 'analisis_0',
      entrevista_1 AS 'entrevista_1',
      solicitud_2 AS 'solicitud_2',
      solicitud_3 AS 'solicitud_3',
      solicitud_4 AS 'solicitud_4',
      reiteracion_5 AS 'reiteracion_5',
      reiteracion_6 AS 'reiteracion_6',
      reiteracion_7 AS 'reiteracion_7',
      reiteracion_8 AS 'reiteracion_8',
      reiteracion_9 AS 'reiteracion_9',
      recurso_10 AS 'recurso_10',
      cierre_11 AS 'cierre_11'
    )
  ) e
),
asignaciones_ordenadas AS (
  SELECT a.*,
    ROW_NUMBER() OVER (
      PARTITION BY a.id_persona
      ORDER BY
        a.fecha_asignacion ASC NULLS FIRST,
        a.id_asignacion
    ) AS orden
  FROM DNDP.ASIGNACION a
  JOIN personas_del_defensor alcance
    ON alcance.id_persona = a.id_persona
),
eventos_con_registro AS (
  SELECT e.*,
    r.id_asignacion AS id_asignacion_registro,
    r.cedula_defensor AS cedula_registro,
    r.nombre_defensor AS nombre_registro,
    ROW_NUMBER() OVER (
      PARTITION BY e.id_gestion, e.origen
      ORDER BY
        r.fecha_asignacion DESC NULLS LAST,
        r.id_asignacion DESC
    ) AS rn_registro
  FROM eventos e
  CROSS JOIN parametros p
  LEFT JOIN asignaciones_ordenadas r
    ON r.id_persona = e.id_persona
   AND e.fecha_registro_gestion IS NOT NULL
   AND (
     r.orden = 1
     OR e.fecha_registro_gestion >= TRUNC(r.fecha_asignacion)
   )
   AND (
     r.fecha_fin IS NULL
     OR e.fecha_registro_gestion < TRUNC(r.fecha_fin) + 1
   )
  WHERE e.fecha >= p.fecha_inicio
    AND e.fecha < p.fecha_fin + 1
),
eventos_atribuidos AS (
  SELECT e.*,
    a.cedula_defensor,
    a.nombre_defensor,
    ROW_NUMBER() OVER (
      PARTITION BY e.id_gestion, e.origen
      ORDER BY
        a.fecha_asignacion DESC NULLS LAST,
        a.id_asignacion DESC
    ) AS rn_autor,
    CASE
      WHEN e.id_asignacion_gestion IS NOT NULL THEN 1

      WHEN NVL(normalizar(e.defensor_gestion), '-') IN ('-', '--')
        THEN 0

      WHEN e.fecha >= TRUNC(e.fecha_registro_gestion)
        AND a.id_asignacion <> e.id_asignacion_registro
        THEN 0

      WHEN e.nombre_registro IS NULL
        AND e.cedula_registro IS NULL
        THEN 1

      WHEN normalizar(e.nombre_registro) =
           normalizar(e.defensor_gestion)
        THEN 1

      WHEN EXISTS (
        SELECT 1
        FROM DNDP.DEFENSORES d
        WHERE d.cedula = e.cedula_registro
          AND normalizar(d.nombre) =
              normalizar(e.defensor_gestion)
      ) THEN 1

      ELSE 0
    END AS autor_original
  FROM eventos_con_registro e
  LEFT JOIN asignaciones_ordenadas a
    ON a.id_persona = e.id_persona
   AND (
     a.orden = 1
     OR e.fecha >= TRUNC(a.fecha_asignacion)
   )
   AND (
     a.fecha_fin IS NULL
     OR e.fecha < TRUNC(a.fecha_fin) + 1
   )
  WHERE e.rn_registro = 1
),
eventos_reporte AS (
  SELECT e.*
  FROM eventos_atribuidos e
  CROSS JOIN parametros p
  WHERE e.rn_autor = 1
  AND (
    (
      e.id_asignacion_gestion IS NOT NULL
      AND (
        TO_CHAR(e.cedula_autor_gestion) = p.cedula
        OR (
          e.cedula_autor_gestion IS NULL
          AND normalizar(e.defensor_gestion) = p.nombre
          AND NOT EXISTS (
            SELECT 1
            FROM DNDP.DEFENSORES h
            WHERE normalizar(h.nombre) = p.nombre
              AND TO_CHAR(h.cedula) <> p.cedula
          )
        )
      )
    )
    OR (
      e.id_asignacion_gestion IS NULL
      AND e.autor_original = 1
      AND normalizar(e.defensor_gestion) = p.nombre
      AND NOT EXISTS (
        SELECT 1
        FROM DNDP.DEFENSORES h
        WHERE normalizar(h.nombre) = p.nombre
          AND TO_CHAR(h.cedula) <> p.cedula
      )
    )
    OR (
      e.id_asignacion_gestion IS NULL
      AND e.autor_original = 0
      AND (
        TO_CHAR(e.cedula_defensor) = p.cedula
        OR (
          e.cedula_defensor IS NULL
          AND normalizar(e.nombre_defensor) = p.nombre
        )
      )
    )
  )
),
ultima_gestion AS (
  SELECT g.*,
    ROW_NUMBER() OVER (
      PARTITION BY g.id_situacion
      ORDER BY
        g.fecha_registro DESC NULLS LAST,
        g.id_gestion DESC
    ) AS rn_gestion
  FROM gestiones g
),
asignacion_vigente AS (
  SELECT a.*,
    ROW_NUMBER() OVER (
      PARTITION BY a.id_persona
      ORDER BY
        a.fecha_asignacion DESC NULLS LAST,
        a.id_asignacion DESC
    ) AS rn_asignacion
  FROM DNDP.ASIGNACION a
  WHERE a.fecha_fin IS NULL
),
personas_asignadas AS (
  SELECT
    s.id_persona,
    s.id_situacion,
    CASE
      WHEN NVL(s.activo, 0) <> 1
        OR NVL(g.cerrada, 0) = 1
        THEN 0
      ELSE 1
    END AS activo
  FROM situaciones_filtradas s
  JOIN DNDP.PERSONA per
    ON per.id_persona = s.id_persona
  JOIN asignacion_vigente a
    ON a.id_persona = s.id_persona
   AND a.rn_asignacion = 1
  LEFT JOIN ultima_gestion g
    ON g.id_situacion = s.id_situacion
   AND g.rn_gestion = 1
  CROSS JOIN parametros p
  WHERE s.rn_situacion = 1
  AND (
    TO_CHAR(a.cedula_defensor) = p.cedula
    OR (
      a.cedula_defensor IS NULL
      AND normalizar(a.nombre_defensor) = p.nombre
    )
  )
  AND (
    (
      p.tipo = 'all'
      AND p.incluir_fuera_prision = 1
    )
    OR (
      p.tipo = 'all'
      AND p.incluir_fuera_prision = 0
      AND NVL(s.activo, 0) = 1
      AND TRIM(s.situacion) IS NOT NULL
    )
    OR (
      p.tipo = 'condenado'
      AND s.tipo_filtro LIKE '%condenad%'
      AND NVL(s.activo, 0) = 1
      AND p.incluir_fuera_prision = 0
    )
    OR (
      p.tipo = 'sindicado'
      AND s.tipo_filtro LIKE '%sindicad%'
      AND p.incluir_fuera_prision = 0
    )
  )
)
, indicadores_eventos AS (
SELECT
  COUNT(CASE WHEN tipo = 'analisis' THEN 1 END) AS CASOS_ANALIZADOS,
  COUNT(CASE WHEN tipo = 'entrevista' THEN 1 END) AS ENTREVISTAS_REALIZADAS,
  COUNT(CASE WHEN tipo = 'solicitud' THEN 1 END) AS SOLICITUDES_PRESENTADAS,
  COUNT(CASE WHEN tipo = 'reiteracion' THEN 1 END) AS REITERACIONES_PRESENTADAS,
  COUNT(CASE WHEN tipo = 'recurso' THEN 1 END) AS RECURSOS_PRESENTADOS,
  COUNT(DISTINCT CASE WHEN tipo = 'cierre' THEN id_situacion END) AS CASOS_CERRADOS,
  COUNT(DISTINCT CASE WHEN tipo IN ('analisis', 'entrevista', 'solicitud', 'reiteracion', 'recurso') THEN id_gestion END) AS TOTAL_ACTUACIONES
FROM eventos_reporte
)
SELECT i.*, (SELECT COUNT(DISTINCT id_persona) FROM personas_asignadas) AS PERSONAS_ASIGNADAS
FROM indicadores_eventos i
