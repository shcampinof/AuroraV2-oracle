# SQL principales Oracle (AuroraV2-oracle)

Nota de ambiente: el codigo conserva SQL con prefijo `DNDP.`, pero `backend/db/oraclePool.js` reemplaza ese prefijo por `ORACLE_SCHEMA` cuando la variable esta configurada. Para pruebas de base de datos se debe usar un esquema distinto a `DNDP`.

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
SELECT DISTINCT TRIM(COALESCE(TO_NCHAR(a.NOMBRE_DEFENSOR), TO_NCHAR(d.NOMBRE))) AS DEFENSOR
FROM ranked_situacion s
JOIN DNDP.PERSONA p ON p.ID_PERSONA = s.ID_PERSONA
LEFT JOIN (
  SELECT a.*,
         ROW_NUMBER() OVER (
           PARTITION BY a.ID_PERSONA
           ORDER BY a.FECHA_ASIGNACION DESC NULLS LAST, a.ID_ASIGNACION DESC
         ) AS RN
  FROM DNDP.ASIGNACION a
  WHERE a.FECHA_FIN IS NULL
) a ON a.ID_PERSONA = p.ID_PERSONA AND a.RN = 1
LEFT JOIN DNDP.DEFENSORES d ON d.CEDULA = a.CEDULA_DEFENSOR
WHERE s.RN = 1
  AND <scope_depto>
  AND <tipo_condenado>
  AND TRIM(NVL(COALESCE(TO_NCHAR(a.NOMBRE_DEFENSOR), TO_NCHAR(d.NOMBRE)), '')) <> ''
ORDER BY DEFENSOR
```

## 4. Historial por situación
```sql
SELECT *
FROM DNDP.GESTION_JURIDICA
WHERE ID_SITUACION = :idSituacion
ORDER BY FECHA_REGISTRO ASC NULLS LAST, ID_GESTION ASC
```

La UI transforma cada fila de este resultado en una actuación. El estado visible no depende únicamente de una columna persistida: se deriva de las respuestas de `GESTION_JURIDICA`, la situación activa y los campos resumidos que el backend expone como `estadoSource`.

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

## 8. Base de pruebas

El script `backend/scripts/test-db/setup-test-db.js` crea las 12 tablas documentadas en `BD Documentation/DICCIONARIO_MODELO_DNDP.html` y carga datos semilla controlados para pruebas de integracion:

- `PERSONA.NUMERO = 900000001` para flujo condenado.
- `PERSONA.NUMERO = 900000002` para flujo sindicado.
- `PAG.CEDULA_PAG = 900001`.
- `DEFENSORES.CEDULA = 900002`.

Comando:

```bash
DOTENV_CONFIG_PATH=/ruta/aurora/backend/.env.test npm --prefix backend run test-db:setup
```

El comando se niega a ejecutarse si el esquema efectivo es `DNDP`, salvo autorizacion explicita con `ALLOW_DNDP_TEST_SETUP=1`.

Si alguna tabla ya existe pero le faltan columnas esperadas por el diccionario, el script falla con `TEST_DB_SCHEMA_MISMATCH` para evitar correr pruebas contra una estructura incompleta.
