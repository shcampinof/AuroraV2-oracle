# Consultas y controles de filtros

## 1. Alcance

| Módulo | Campo | Origen | Regla principal |
|---|---|---|---|
| Usuarios asignados | Defensor | Asignación activa y catálogo de defensores | Identidad por cédula; texto homologado para presentación |
| Usuarios asignados | Acción o estado | Catálogo de estados y acciones | Código canónico; los cierres se presentan como `Caso cerrado` |
| Usuarios asignados | Nombre, documento y ubicación | Situación carcelaria vigente | Búsqueda normalizada; los lugares del filtro corresponden a personas con `ACTIVO = 1` |
| Atención | Defensor | `DNDP.DEFENSORES` | Lista controlada y escribible; alta compacta con cédula y nombre |
| Atención | Acción a impulsar | Reglas del flujo y campos diligenciados | Valor calculado; no usa SQL de catálogo |
| Atención | Nombre del establecimiento | Catálogo de centros activos | Lista controlada, escribible y dependiente de ubicación |
| Atención | Departamento | Catálogo de ubicaciones activas | Lista controlada y escribible |
| Atención | Distrito/municipio | Catálogo dependiente del departamento | Lista controlada y escribible |
| PAG - Asignación | Departamento, municipio, establecimiento y potenciales candidatos | Condenados activos | Requiere al menos un filtro |
| PAG - Reasignación | Los anteriores y defensor actual | Condenados activos con asignación vigente | Requiere al menos un filtro |
| PAG | Nuevo defensor | `DNDP.DEFENSORES` | Nombre en mayúscula y sin signos diacríticos |

## 2. Centro canónico

Un centro canónico es una identidad estable del catálogo, compuesta por:

- código del establecimiento, por ejemplo `INPEC_601`;
- nombre visible preferido, por ejemplo `CPMS MANIZALES`;
- nombres históricos o variantes asociados al mismo establecimiento.

La homologación agrupa variantes de escritura, no establecimientos distintos. Las siglas `CPMS` y `CPMSM` conservan identidades separadas cuando corresponden a centros masculino y femenino.

| Nombre | Identidad |
|---|---|
| `CPMS MANIZALES`, `EPMSC MANIZALES` | `INPEC_601` |
| `CPMSM MANIZALES`, `RM MANIZALES` | `INPEC_611` |
| `CPMS ARMENIA`, `EPMSC ARMENIA`, `EMPSC ARMENIA` | `INPEC_613` |
| `CPMSM ARMENIA`, `RM ARMENIA` | `INPEC_615` |
| `CPMS BARRANQUILLA` | `INPEC_301` |
| `CPMS BARRANQUILLA (JYP)`, `EPMSC BARRANQUILLA` | `INPEC_322` |
| `CPMS VALLEDUPAR`, `EPMSC VALLEDUPAR` | `INPEC_307` |
| `CPOMS ACACIAS` | `INPEC_130` |
| `CPMS ACACIAS` | `INPEC_148` |

La separación de Acacías consulta también el valor original de `DNDP.SISIPEC`, debido a que el consolidado histórico puede presentar `CPOMS ACACIAS` como `CPMS ACACIAS`.

## 3. Universo de datos

### 3.1 Situación vigente para resultados

La situación mostrada se selecciona por persona con `ROW_NUMBER()`:

```sql
WITH ranked_situacion AS (
  SELECT
    s.*,
    ROW_NUMBER() OVER (
      PARTITION BY s.ID_PERSONA
      ORDER BY
        COALESCE(s.FECHA_CORTE, CAST(s.FECHA_REGISTRO AS DATE), s.FECHA_CAPTURA)
          DESC NULLS LAST,
        CASE WHEN NVL(s.ACTIVO, 0) = 1 THEN 0 ELSE 1 END,
        s.ID_SITUACION DESC
    ) AS RN
  FROM DNDP.SITUACION_CARCELARIA s
)
```

La tabla de Usuarios asignados admite condenados y sindicados. Una consulta por defensor, nombre o documento puede incluir una situación cerrada; la interfaz la presenta como caso histórico. Una consulta por ubicación exige `ACTIVO = 1`.

El filtro `Caso cerrado`, cuando se consulta por sí solo, comprende los cierres determinados por las reglas del trámite y las situaciones más recientes con `ACTIVO = 0` o `NULL` que tengan gestión jurídica o asignación histórica de defensor. La asignación histórica se reconoce por cédula o por nombre, incluidos los registros anteriores a la adopción del catálogo de defensores. Cuando se combina con defensor, identificación, nombre o ubicación, conserva el universo de ese primer criterio y actúa como una intersección; por tanto, agregar `Caso cerrado` no puede aumentar el total obtenido con el otro filtro.

```sql
AND ESTADO_CODIGO = 'CASO_CERRADO'
AND (
  NVL(s.ACTIVO, 0) = 1
  OR EXISTS (
    SELECT 1
    FROM DNDP.SITUACION_CARCELARIA historical_s
    JOIN DNDP.GESTION_JURIDICA historical_g
      ON historical_g.ID_SITUACION = historical_s.ID_SITUACION
    WHERE historical_s.ID_PERSONA = p.ID_PERSONA
  )
  OR EXISTS (
    SELECT 1
    FROM DNDP.ASIGNACION historical_a
    WHERE historical_a.ID_PERSONA = p.ID_PERSONA
      AND (
        historical_a.CEDULA_DEFENSOR IS NOT NULL
        OR TRIM(historical_a.NOMBRE_DEFENSOR) IS NOT NULL
      )
  )
)
```

Los históricos con `ACTIVO = 0` o `NULL`, sin gestión y sin defensor, no forman parte del resultado. La ausencia del texto de situación jurídica no excluye un histórico que cumpla alguna de las dos condiciones.

La consulta directa del formulario también puede recuperar una persona con situación inactiva. El formulario se presenta en modo de solo lectura y no permite crear actuaciones ni actualizar el caso.

### 3.2 Catálogos de ubicación

Los catálogos se construyen solamente con la situación más reciente cuando continúa activa:

```sql
WITH ranked_situacion AS (
  SELECT s.*
  FROM (
    SELECT
      source_s.*,
      ROW_NUMBER() OVER (
        PARTITION BY source_s.ID_PERSONA
        ORDER BY
          COALESCE(
            source_s.FECHA_CORTE,
            CAST(source_s.FECHA_REGISTRO AS DATE),
            source_s.FECHA_CAPTURA
          ) DESC NULLS LAST,
          source_s.ID_SITUACION DESC
      ) AS RN
    FROM DNDP.SITUACION_CARCELARIA source_s
  ) s
  WHERE s.RN = 1
    AND NVL(s.ACTIVO, 0) = 1
)
```

Este orden evita reactivar una ubicación histórica de una persona cuya situación posterior ya fue cerrada.

## 4. Consultas de los catálogos

El endpoint común es:

```http
GET /api/ppl/condenados/filter-options
```

Admite `tipo=all`, `tipo=condenado` o `tipo=sindicado`, además de departamento y municipio para catálogos dependientes.

### 4.1 Departamento

```sql
SELECT DEPARTAMENTO
FROM (
  SELECT DISTINCT TRIM(s.DEPARTAMENTO) AS DEPARTAMENTO
  FROM DNDP.PERSONA p
  JOIN ranked_situacion s
    ON s.ID_PERSONA = p.ID_PERSONA
   AND s.RN = 1
  WHERE TRIM(s.DEPARTAMENTO) IS NOT NULL
  ORDER BY DEPARTAMENTO
)
WHERE ROWNUM <= :maxRows;
```

### 4.2 Municipio dependiente

```sql
SELECT MUNICIPIO
FROM (
  SELECT DISTINCT TRIM(s.MUNICIPIO) AS MUNICIPIO
  FROM DNDP.PERSONA p
  JOIN ranked_situacion s
    ON s.ID_PERSONA = p.ID_PERSONA
   AND s.RN = 1
  WHERE normalized(s.DEPARTAMENTO) LIKE :departamentoFilter
    AND TRIM(s.MUNICIPIO) IS NOT NULL
  ORDER BY MUNICIPIO
)
WHERE ROWNUM <= :maxRows;
```

### 4.3 Establecimiento dependiente

```sql
SELECT LUGAR
FROM (
  SELECT DISTINCT TRIM(s.ESTABLECIMIENTO) AS LUGAR
  FROM DNDP.PERSONA p
  JOIN ranked_situacion s
    ON s.ID_PERSONA = p.ID_PERSONA
   AND s.RN = 1
  WHERE normalized(s.DEPARTAMENTO) LIKE :departamentoFilter
    AND normalized(s.MUNICIPIO) LIKE :municipioFilter
    AND TRIM(s.ESTABLECIMIENTO) IS NOT NULL
  ORDER BY LUGAR
)
WHERE ROWNUM <= :maxRows;
```

Los valores obtenidos se resuelven contra `centros-reclusion.v1.json`. Las variantes se agrupan por código `INPEC_*`.

Política por módulo:

- PAG muestra 124 establecimientos del corte SISIPEC del 7 de julio. El catálogo oficial contiene 125 y excluye `INPEC_514` para este flujo.
- Usuarios asignados y Atención conservan todos los lugares activos observados, incluidos CDT, URI, estaciones y otros centros no incluidos en los 124 establecimientos de condenados.
- Los filtros dependientes reducen la lista según departamento y municipio.

### 4.4 Defensor actual

```sql
SELECT DEFENSOR_ID, DEFENSOR
FROM (
  SELECT DISTINCT
    TRIM(TO_CHAR(a.CEDULA_DEFENSOR)) AS DEFENSOR_ID,
    TRIM(COALESCE(d.NOMBRE, a.NOMBRE_DEFENSOR)) AS DEFENSOR
  FROM DNDP.PERSONA p
  JOIN ranked_situacion s
    ON s.ID_PERSONA = p.ID_PERSONA
   AND s.RN = 1
  LEFT JOIN active_asignacion a
    ON a.ID_PERSONA = p.ID_PERSONA
   AND a.RN = 1
  LEFT JOIN DNDP.DEFENSORES d
    ON d.CEDULA = a.CEDULA_DEFENSOR
  WHERE TRIM(COALESCE(d.NOMBRE, a.NOMBRE_DEFENSOR)) IS NOT NULL
  ORDER BY DEFENSOR
)
WHERE ROWNUM <= :maxRows;
```

El filtro Defensor actual de PAG - Reasignación consulta el catálogo de manera independiente sobre todas las asignaciones activas. Las sugerencias no dependen de las filas recuperadas para la tabla. El límite técnico es de 2.000 opciones.

El campo Nuevo defensor de Asignación y Reasignación usa el catálogo completo `DNDP.DEFENSORES`:

```sql
SELECT
  TO_CHAR(d.CEDULA) AS CEDULA,
  d.NOMBRE,
  d.CORREO,
  d.REGIONAL,
  TO_CHAR(d.CEDULA_PAG) AS CEDULA_PAG
FROM DNDP.DEFENSORES d
ORDER BY d.NOMBRE;
```

Al crear un defensor, el nombre se transforma antes de validar y guardar:

```text
normalización NFD -> eliminación de diacríticos -> mayúscula -> espacios simples
```

El Formulario de atención usa el mismo catálogo. El texto escrito debe coincidir con una opción. La identidad se valida en la interfaz y en la API; la asignación conserva nombre y cédula. La opción `Crear defensor` permite registrar una cédula y un nombre sin salir del formulario y selecciona el registro creado.

### 4.5 Acciones, estados y potenciales candidatos

Los estados y acciones proceden de catálogos de códigos. El filtro envía el código, por ejemplo `ENTREVISTAR_USUARIO`, y Oracle compara el estado derivado del flujo.

El cierre usa una sola etiqueta visible:

| Código de estado | Código de acción | Etiqueta |
|---|---|---|
| `CASO_CERRADO` | `SIN_ACCION_PENDIENTE` | `Caso cerrado` |

`Sin acción pendiente` se conserva como alias de lectura para datos históricos. La tabla, los filtros, el formulario y el historial presentan `Caso cerrado`.

Los potenciales candidatos se derivan de `SITUACION_CARCELARIA.CATEGORIZACION`:

```sql
CASE
  WHEN normalized(s.CATEGORIZACION) LIKE 'PRELIMINAR %'
    THEN 'proximos_requisito_temporal'
  WHEN normalized(s.CATEGORIZACION) = 'UTILIDAD PUBLICA'
    THEN 'mujeres_potenciales_utilidad_publica'
  WHEN normalized(s.CATEGORIZACION) LIKE '%PRISION DOMICILIARIA%'
    OR normalized(s.CATEGORIZACION) LIKE '%LIBERTAD CONDICIONAL%'
    OR normalized(s.CATEGORIZACION) LIKE '%REVISAR POR PENA%'
    THEN 'potenciales_beneficiarios'
  ELSE 'no_reunen_requisitos'
END
```

## 5. Consulta de resultados

### 5.1 Asignación y Reasignación

La separación se aplica en Oracle antes del ordenamiento y de la paginación:

```sql
-- Asignación
AND NVL(s.ACTIVO, 0) = 1
AND a.CEDULA_DEFENSOR IS NULL

-- Reasignación
AND NVL(s.ACTIVO, 0) = 1
AND a.CEDULA_DEFENSOR IS NOT NULL
```

Cada pestaña consulta su propio universo de datos antes de aplicar el límite de página.

PAG no ejecuta ni presenta la tabla inicial. La consulta se habilita después de validar el PAG y exige al menos uno de estos filtros: documento, departamento, municipio, establecimiento, potencial o defensor actual.

### 5.2 Conteo exacto

El total y la página se ejecutan en paralelo. El conteo no incluye `ORDER BY`:

```sql
SELECT COUNT(*) AS TOTAL_MATCHED
FROM (
  -- persona, situación vigente, gestión y asignación activa
) filtered_rows
WHERE -- filtros de la consulta;
```

El total se almacena en caché durante cinco minutos según el tipo y los filtros. Los cambios de asignación invalidan los totales almacenados.

### 5.3 Página de resultados

```sql
SELECT *
FROM (
  SELECT ordered_rows.*, ROWNUM AS PAGE_ROW_NUMBER
  FROM (
    SELECT filtered_rows.*
    FROM (
      -- consulta base
    ) filtered_rows
    WHERE -- estado o acción
    ORDER BY "Numero de identificacion"
  ) ordered_rows
  WHERE ROWNUM <= :endRow
)
WHERE PAGE_ROW_NUMBER > :offsetRows;
```

Parámetros de interfaz:

- tamaño de página: 50;
- `offsetRows = (page - 1) * 50`;
- `endRow = offsetRows + 50`;
- total exacto y número total de páginas en la respuesta;
- navegación completa sin cargar el conjunto total en el navegador.

La misma estrategia se usa en Usuarios asignados y PAG.

## 6. Normalización y blindajes

Las búsquedas de texto aplican en SQL:

- conversión a mayúscula;
- eliminación de tildes y otros signos diacríticos;
- corrección de secuencias mojibake conocidas;
- conversión de espacios no separables;
- compactación de espacios;
- comparación por prefijo o contenido según el campo.

Ejemplo conceptual:

```sql
normalized(s.DEPARTAMENTO) LIKE :departamentoFilter
```

Por esta razón `ATLANTICO`, `ATLÁNTICO` y variantes de codificación se consultan como una misma identidad textual. La lista visible se reduce mediante la misma clave normalizada.

Blindajes adicionales:

- documento y cédula se reducen a dígitos;
- un identificador inválido produce `1 = 0` y nunca elimina silenciosamente el filtro;
- defensor y establecimiento usan identificadores estables cuando existe catálogo;
- Atención rechaza defensores que no pertenezcan a `DNDP.DEFENSORES`, incluso si se intenta enviar el nombre directamente al API;
- un código de acción, estado o centro desconocido no devuelve resultados sin filtrar;
- PAG aplica `ACTIVO = 1` de forma obligatoria;
- el formulario bloquea la edición de situaciones inactivas;
- los campos escribibles de ubicación rechazan al guardar cualquier valor que no pertenezca al catálogo;
- CPMS y CPMSM se registran con identidades separadas en el catálogo.

## 7. Índices y limitaciones

Índices presentes en el esquema consultado:

| Tabla | Índice | Columnas |
|---|---|---|
| `SITUACION_CARCELARIA` | `IDX_SIT_PERSONA_ACTIVO` | `ID_PERSONA, ACTIVO` |
| `SITUACION_CARCELARIA` | `SYS_C008773` | `ID_SITUACION` |
| `ASIGNACION` | `IDX_ASIG_DEFENSOR` | `CEDULA_DEFENSOR, FECHA_FIN` |
| `ASIGNACION` | `IDX_ASIG_PAG` | `CEDULA_PAG, FECHA_FIN` |
| `ASIGNACION` | `IDX_ASIG_VIGENTE` | `ID_PERSONA, NVL(TO_CHAR(FECHA_FIN, 'YYYYMMDD'), 'VIGENTE')` |
| `ASIGNACION` | `PK_ASIGNACION` | `ID_ASIGNACION` |
| `GESTION_JURIDICA` | `IDX_GESTION_SITUACION` | `ID_SITUACION` |
| `GESTION_JURIDICA` | `SYS_C008776` | `ID_GESTION` |

No se observaron índices registrados para `SISIPEC` en el esquema consultado.

Limitaciones vigentes:

- Las funciones de normalización sobre columnas pueden impedir el uso de índices convencionales.
- El conteo exacto sigue recorriendo el conjunto filtrado. La ejecución paralela y la caché evitan repetirlo en cada página.
- Los catálogos de ubicación dependen de la calidad del valor fuente. Los nombres desconocidos permanecen visibles en Usuarios asignados y Atención, pero no ingresan automáticamente a la lista oficial de 124 centros PAG.
- La asociación histórica de Acacías requiere consultar `DNDP.SISIPEC` hasta corregir el dato consolidado de origen.
- Los catálogos dependientes tienen un máximo de 2.000 valores por campo.
