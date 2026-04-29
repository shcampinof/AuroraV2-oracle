# SQL principales Oracle (AuroraV2-oracle)

## 1. CTE situación activa
```sql
WITH ranked_situacion AS (
  SELECT
    s.*,
    ROW_NUMBER() OVER (
      PARTITION BY s.ID_PERSONA
      ORDER BY
        CASE WHEN NVL(s.ACTIVO, 0) = 1 THEN 0 ELSE 1 END,
        s.FECHA_CAPTURA DESC NULLS LAST,
        LENGTH(REGEXP_REPLACE(NVL(s.PROCESO, ''), '[^0-9]', '')) DESC,
        s.FECHA_REGISTRO DESC NULLS LAST,
        s.ID_SITUACION DESC
    ) AS RN
  FROM DNDP.SITUACION_CARCELARIA s
)
```

## 2. Base de listados y detalle
```sql
SELECT ...
FROM DNDP.PERSONA p
JOIN ranked_situacion s
  ON s.ID_PERSONA = p.ID_PERSONA
 AND s.RN = 1
LEFT JOIN DNDP.GESTION_JURIDICA g
  ON g.ID_SITUACION = s.ID_SITUACION
WHERE <scope_depto>
  AND TO_CHAR(p.NUMERO) = :documento -- opcional
ORDER BY TO_CHAR(p.NUMERO), NVL(g.FECHA_REGISTRO, s.FECHA_REGISTRO), NVL(g.ID_GESTION, 0)
```

## 3. Distinct defensores (source=condenados)
```sql
SELECT DISTINCT TRIM(g.DEFENSOR) AS DEFENSOR
FROM ranked_situacion s
JOIN DNDP.PERSONA p ON p.ID_PERSONA = s.ID_PERSONA
JOIN DNDP.GESTION_JURIDICA g ON g.ID_SITUACION = s.ID_SITUACION
WHERE s.RN = 1
  AND <scope_depto>
  AND <tipo_condenado>
  AND TRIM(NVL(g.DEFENSOR, '')) <> ''
ORDER BY DEFENSOR
```

## 4. Historial por situación
```sql
SELECT *
FROM DNDP.GESTION_JURIDICA
WHERE ID_SITUACION = :idSituacion
ORDER BY FECHA_REGISTRO ASC NULLS LAST, ID_GESTION ASC
```

## 5. Crear actuación
```sql
INSERT INTO DNDP.GESTION_JURIDICA (<columnas>)
VALUES (<binds>)
RETURNING ID_GESTION INTO :outId
```

## 6. Actualizar actuación
```sql
UPDATE DNDP.GESTION_JURIDICA
SET <columna> = :valor, ...
WHERE ID_GESTION = :idGestion
```

## 7. Health DB
```sql
SELECT 1 AS DB_OK FROM dual
```
