# Reporte de consultas, dropdowns y filtros

Fecha de revisión: 10 de agosto de 2026.

Este documento describe el estado actual de los filtros y dropdowns de Usuarios asignados, Formulario de atención y Asignación PAG. Incluye las consultas Oracle, la lógica de homologación, los blindajes existentes, las limitaciones de cobertura y las recomendaciones de indexación.

## 1. Inventario actual

| Pantalla | Campo | Implementación actual |
|---|---|---|
| Usuarios asignados | Defensor | Datalist proveniente de Oracle |
| Usuarios asignados | Acción a impulsar / estado | Select de estados canónicos |
| Usuarios asignados | Nombre | Texto libre |
| Usuarios asignados | Establecimiento | Datalist homologado |
| Usuarios asignados | Departamento / municipio | Datalist homologado |
| Formulario de atención | Defensor | Datalist del maestro `DNDP.DEFENSORES` |
| Formulario de atención | Acción a impulsar | Calculada por reglas; no es dropdown |
| Formulario de atención | Nombre | Texto libre |
| Formulario de atención | Tipo de lugar | Select estático: `CDT`, `ERON` |
| Formulario de atención | Nombre del establecimiento | Texto libre |
| Formulario de atención | Departamento / municipio | Texto libre |
| Asignación PAG | Departamento / municipio | Datalist proveniente de Oracle |
| Asignación PAG | Nombre del establecimiento | Datalist homologado |
| Asignación PAG | Número de identificación | Texto numérico |
| Asignación PAG | Potenciales candidatos | Select estático con categorías calculadas |
| Reasignación PAG | Defensor actual | Datalist construido con las filas recuperadas |
| Asignación/Reasignación | Nuevo defensor | Datalist del maestro `DNDP.DEFENSORES` |

Actualmente PAG no tiene filtro por nombre de la persona. El campo denominado “Nombre” en este contexto corresponde al nombre del lugar de privación de la libertad.

## 2. SQL base de los catálogos de filtros

Los catálogos de departamento, municipio, establecimiento y defensor comparten una situación vigente y una asignación vigente:

```sql
WITH ranked_situacion AS (
    SELECT *
    FROM (
        SELECT
            s.*,
            ROW_NUMBER() OVER (
                PARTITION BY s.ID_PERSONA
                ORDER BY
                    COALESCE(
                        s.FECHA_CORTE,
                        CAST(s.FECHA_REGISTRO AS DATE),
                        s.FECHA_CAPTURA
                    ) DESC NULLS LAST,
                    s.FECHA_REGISTRO DESC NULLS LAST,
                    s.FECHA_CAPTURA DESC NULLS LAST,
                    s.ID_SITUACION DESC
            ) AS RN
        FROM DNDP.SITUACION_CARCELARIA s
    )
    WHERE RN = 1
      AND NVL(ACTIVO, 0) = 1
),
active_asignacion AS (
    SELECT *
    FROM (
        SELECT
            a.*,
            ROW_NUMBER() OVER (
                PARTITION BY a.ID_PERSONA
                ORDER BY
                    a.FECHA_ASIGNACION DESC NULLS LAST,
                    a.ID_ASIGNACION DESC
            ) AS RN
        FROM DNDP.ASIGNACION a
        WHERE a.FECHA_FIN IS NULL
    )
    WHERE RN = 1
)
SELECT ...
FROM DNDP.PERSONA p
JOIN ranked_situacion s
  ON s.ID_PERSONA = p.ID_PERSONA
LEFT JOIN active_asignacion a
  ON a.ID_PERSONA = p.ID_PERSONA
LEFT JOIN DNDP.DEFENSORES d
  ON d.CEDULA = a.CEDULA_DEFENSOR
WHERE -- condenado, sindicado o ambos
```

La regla de actividad está correctamente aplicada en los catálogos: primero se identifica la última situación y después se valida `ACTIVO=1`. Esto evita recuperar una situación histórica activa de una persona cuya situación posterior fue cerrada.

Implementación: `backend/repositories/oracle/sqlFragments.js`.

### 2.1 Departamento

```sql
SELECT DEPARTAMENTO
FROM (
    SELECT DISTINCT TRIM(s.DEPARTAMENTO) AS DEPARTAMENTO
    FROM ...
    WHERE TRIM(s.DEPARTAMENTO) IS NOT NULL
    ORDER BY DEPARTAMENTO
)
WHERE ROWNUM <= :maxRows;
```

### 2.2 Municipio

```sql
SELECT MUNICIPIO
FROM (
    SELECT DISTINCT TRIM(s.MUNICIPIO) AS MUNICIPIO
    FROM ...
    WHERE TRIM(s.MUNICIPIO) IS NOT NULL
      AND NORMALIZAR(s.DEPARTAMENTO)
            LIKE :departamento || '%'
    ORDER BY MUNICIPIO
)
WHERE ROWNUM <= :maxRows;
```

En PAG el municipio depende del departamento seleccionado.

### 2.3 Establecimiento

```sql
SELECT LUGAR
FROM (
    SELECT DISTINCT TRIM(s.ESTABLECIMIENTO) AS LUGAR
    FROM ...
    WHERE TRIM(s.ESTABLECIMIENTO) IS NOT NULL
      AND NORMALIZAR(s.DEPARTAMENTO)
            LIKE :departamento || '%'
      AND NORMALIZAR(s.MUNICIPIO)
            LIKE :municipio || '%'
    ORDER BY LUGAR
)
WHERE ROWNUM <= :maxRows;
```

### 2.4 Defensor asignado

```sql
SELECT DEFENSOR_ID, DEFENSOR
FROM (
    SELECT DISTINCT
        TRIM(TO_CHAR(a.CEDULA_DEFENSOR)) AS DEFENSOR_ID,
        TRIM(
            COALESCE(
                TO_NCHAR(d.NOMBRE),
                TO_NCHAR(a.NOMBRE_DEFENSOR)
            )
        ) AS DEFENSOR
    FROM ...
    WHERE TRIM(
        COALESCE(d.NOMBRE, a.NOMBRE_DEFENSOR)
    ) IS NOT NULL
    ORDER BY DEFENSOR
)
WHERE ROWNUM <= :maxRows;
```

La implementación completa se encuentra en `backend/repositories/oracle/personaRepository.js`.

## 3. Usuarios asignados

Usuarios asignados consulta condenados y sindicados:

```javascript
tipo: 'all'
```

Implementación de interfaz: `frontend/src/pages/RegistrosAsignados.jsx`.

### 3.1 Consulta principal

```sql
WITH ranked_situacion AS (...),
latest_gestion AS (...),
active_asignacion AS (...)
SELECT
    TO_CHAR(p.NUMERO) AS NUMERO_IDENTIFICACION,
    p.NOMBRE,
    s.ESTABLECIMIENTO,
    s.DEPARTAMENTO,
    s.MUNICIPIO,
    COALESCE(d.NOMBRE, a.NOMBRE_DEFENSOR) AS DEFENSOR,
    ...
FROM DNDP.PERSONA p
JOIN ranked_situacion s
  ON s.ID_PERSONA = p.ID_PERSONA
 AND s.RN = 1
LEFT JOIN active_asignacion a
  ON a.ID_PERSONA = p.ID_PERSONA
 AND a.RN = 1
LEFT JOIN DNDP.DEFENSORES d
  ON d.CEDULA = a.CEDULA_DEFENSOR
LEFT JOIN latest_gestion g
  ON g.ID_SITUACION = s.ID_SITUACION
 AND g.RN = 1
WHERE ...
ORDER BY TO_CHAR(p.NUMERO)
```

### 3.2 Predicados por filtro

```sql
-- Documento
TO_CHAR(p.NUMERO) LIKE :documentoPrefix

-- Nombre
NORMALIZAR(p.NOMBRE) LIKE '%' || :nombre || '%'

-- Defensor por identidad
TO_CHAR(a.CEDULA_DEFENSOR) = :defensorId

-- Defensor por texto
NORMALIZAR(COALESCE(d.NOMBRE, a.NOMBRE_DEFENSOR))
    LIKE :defensor || '%'

-- Establecimiento
NVL(s.ACTIVO, 0) = 1
AND NORMALIZAR(s.ESTABLECIMIENTO)
    LIKE :lugar || '%'

-- Departamento
NVL(s.ACTIVO, 0) = 1
AND NORMALIZAR(s.DEPARTAMENTO)
    LIKE :departamento || '%'

-- Municipio
NVL(s.ACTIVO, 0) = 1
AND NORMALIZAR(s.MUNICIPIO)
    LIKE :municipio || '%'
```

Cuando se identifica un centro canónico, la consulta utiliza todos sus alias:

```sql
NORMALIZAR(s.ESTABLECIMIENTO) IN (
    :centroAlias1,
    :centroAlias2,
    :centroAlias3
)
```

Ejemplo actual:

```text
CPMS ARMENIA
- CPMS ARMENIA
- EPMSC ARMENIA
- EMPSC ARMENIA
```

El dropdown muestra `CPMS ARMENIA`, pero la búsqueda recupera personas registradas con cualquiera de esos nombres.

### 3.3 Acción a impulsar

El control visible se llama “Acción a impulsar / estado”, pero actualmente trabaja principalmente con `estadoCodigo`:

```text
ANALIZAR_CASO
ENTREVISTAR_USUARIO
PRESENTAR_SOLICITUD
PENDIENTE_AUDIENCIA
PENDIENTE_DECISION
PRESENTAR_RECURSO
CASO_CERRADO
```

El estado se calcula desde los campos de gestión jurídica y se filtra en una consulta exterior:

```sql
SELECT *
FROM (
    SELECT
        ...,
        CASE
            WHEN ... THEN 'ANALIZAR_CASO'
            WHEN ... THEN 'ENTREVISTAR_USUARIO'
            WHEN ... THEN 'PRESENTAR_SOLICITUD'
            ...
        END AS ESTADO_CODIGO
    FROM ...
)
WHERE ESTADO_CODIGO = :estadoCodigo
```

El nombre del control sugiere que filtra acciones, pero la interfaz actual selecciona estados. El catálogo de acciones existe, aunque no está expuesto de forma independiente en ese control.

## 4. Formulario de atención

El formulario no ejecuta consultas separadas para nombre, establecimiento, departamento o municipio. Esos datos se cargan al consultar una persona por documento:

```sql
WITH ranked_situacion AS (...)
SELECT
    p.*,
    s.*,
    g.*,
    a.*,
    d.*
FROM DNDP.PERSONA p
JOIN ranked_situacion s
  ON s.ID_PERSONA = p.ID_PERSONA
 AND s.RN = 1
LEFT JOIN DNDP.GESTION_JURIDICA g
  ON g.ID_SITUACION = s.ID_SITUACION
LEFT JOIN asignacion_vigente a
  ON a.ID_PERSONA = p.ID_PERSONA
LEFT JOIN DNDP.DEFENSORES d
  ON d.CEDULA = a.CEDULA_DEFENSOR
WHERE TO_CHAR(p.NUMERO) = :documento
ORDER BY g.FECHA_REGISTRO;
```

### 4.1 Defensor

Es el único datalist dinámico de los campos mencionados. Consulta el maestro completo:

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

Implementación: `backend/repositories/oracle/defensoresRepository.js`.

### 4.2 Tipo de lugar

Es un select estático:

```javascript
['CDT', 'ERON']
```

### 4.3 Nombre, establecimiento, departamento y municipio

Actualmente son campos de texto editables, no dropdowns:

```text
Nombre
Nombre del lugar de privación
Departamento
Distrito/municipio
```

Esto permite volver a introducir variantes como `BOLIVAR`, `BOLÍVAR` y `Bolivar`. La búsqueda posterior las agrupa, pero la base conserva el texto ingresado. Para reducir la duplicidad desde el origen, estos campos deberían reutilizar los catálogos homologados.

### 4.4 Acción a impulsar

No es seleccionada manualmente. Se calcula mediante las reglas de AURORA o CELESTE:

```javascript
registro['Estado del trámite'] = estadoCalculado;
registro['Acción a impulsar'] = estadoCalculado;
```

Por eso no tiene SQL propio de dropdown.

## 5. Asignación PAG y Reasignación

PAG consulta únicamente condenados:

```javascript
tipo: 'condenado'
```

El frontend no siempre envía expresamente el tipo; el backend utiliza `condenado` como valor predeterminado.

### 5.1 Filtros enviados

```javascript
{
    documento,
    departamento,
    municipio,
    lugar,
    centroId,
    potencialSubrogado,
    defensor // sólo reasignación
}
```

Implementación: `frontend/src/pages/AsignacionDefensores.jsx`.

### 5.2 Condición de condenado

```sql
LOWER(
    NVL(situacion_juridica_efectiva, '')
) LIKE '%condenad%'
```

### 5.3 Potenciales candidatos

Se calcula desde `SITUACION_CARCELARIA.CATEGORIZACION`:

```sql
CASE
    WHEN NORMALIZAR(s.CATEGORIZACION) LIKE 'PRELIMINAR %'
        THEN 'proximos_requisito_temporal'

    WHEN NORMALIZAR(s.CATEGORIZACION) = 'UTILIDAD PUBLICA'
        THEN 'mujeres_potenciales_utilidad_publica'

    WHEN NORMALIZAR(s.CATEGORIZACION)
            LIKE '%PRISION DOMICILIARIA%'
      OR NORMALIZAR(s.CATEGORIZACION)
            LIKE '%LIBERTAD CONDICIONAL%'
      OR NORMALIZAR(s.CATEGORIZACION)
            LIKE '%REVISAR POR PENA%'
        THEN 'potenciales_beneficiarios'

    ELSE 'no_reunen_requisitos'
END
```

Después se aplica:

```sql
categoria_calculada = :potencialSubrogado
```

### 5.4 Diferencia entre Asignación y Reasignación

Actualmente Oracle devuelve primero un conjunto limitado de condenados. Después el frontend separa:

```javascript
asignacion =
    rows.filter(row => !tieneDefensor(row.defensorAsignado));

reasignacion =
    rows.filter(row => tieneDefensor(row.defensorAsignado));
```

Esto ocurre después del límite de resultados. Si Oracle devuelve las primeras 100 personas y después se separan las pestañas, pueden quedar personas fuera de la pestaña correspondiente.

La separación debe hacerse en SQL antes del límite:

```sql
-- Asignación
a.CEDULA_DEFENSOR IS NULL

-- Reasignación
a.CEDULA_DEFENSOR IS NOT NULL
```

### 5.5 Defensor actual en Reasignación

El dropdown de defensor actual se construye con las filas recuperadas:

```text
rows
→ extraer defensorAsignado
→ eliminar repetidos
→ ordenar
```

No consulta todos los defensores con condenados asignados. Un defensor que no esté en las primeras filas puede no aparecer como sugerencia, aunque se pueda escribir manualmente.

### 5.6 Nuevo defensor

El selector de nuevo defensor utiliza el maestro completo:

```sql
SELECT CEDULA, NOMBRE, CORREO, REGIONAL, CEDULA_PAG
FROM DNDP.DEFENSORES
ORDER BY NOMBRE;
```

La interfaz muestra como máximo 80 sugerencias mientras se escribe, pero la lista base contiene todos los defensores.

## 6. Homologación y reducción de opciones

La normalización aplicada es:

```text
Reparar mojibake conocido
→ eliminar espacios invisibles
→ unificar espacios
→ NFKD
→ eliminar tildes
→ mayúsculas
```

Ejemplos:

```text
ATLANTICO = ATLÁNTICO
BOLIVAR = BOLÍVAR
CPAMS EL BARNE = CPAMS EL BARNÉ
```

Oracle utiliza una expresión equivalente a:

```sql
TRANSLATE(
    UPPER(
        TRIM(
            NVL(
                REGEXP_REPLACE(columna, '[[:space:]]+', ' '),
                ''
            )
        )
    ),
    'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑ',
    'AEIOUAEIOUAEIOUN'
)
```

El backend utiliza una normalización equivalente en JavaScript en `backend/utils/textNormalization.js`.

### 6.1 Identidades utilizadas

| Campo | Identidad preferida |
|---|---|
| Defensor | Cédula |
| Centro | Código `INPEC_*` |
| Acción | Código canónico |
| Departamento | Texto normalizado |
| Municipio | Texto normalizado |
| Valor desconocido | ID estable `LEGACY_*` |

Los valores desconocidos no se descartan. Permanecen visibles o son agrupados en “Otros lugares activos”.

## 7. Estado actual de establecimientos

### 7.1 Usuarios asignados

Utiliza `tipo=all` y debe incluir todos los lugares activos:

- ERON.
- CDT.
- URI.
- Estaciones.
- CAI.
- Otros lugares de privación.

Estado observado en la revisión:

- 470 textos distintos.
- 462 identidades después de homologación.

### 7.2 Asignación PAG

El consolidado SISIPEC de julio contiene:

- 139.524 registros totales.
- 84.335 condenados.
- Exactamente 124 establecimientos distintos para condenados.
- Los 124 tienen correspondencia en el catálogo oficial.

El objetivo funcional es:

```text
124 establecimientos canónicos para condenados
```

Actualmente la implementación no utiliza directamente esa lista fija de 124. Construye el dropdown con los centros oficiales que tienen personas activas en la base actual y agrega una categoría “Otros lugares activos”.

Con la homologación de Armenia, el estado observado es:

- 120 centros oficiales presentes.
- 97 identidades no oficiales.
- Una categoría agrupada de “Otros”.
- 121 opciones visibles.

Diferencias pendientes:

- Separar `CPMS MANIZALES` de `CPMSM MANIZALES`.
- Homologar `CPMS VALLEDUPAR`.
- Homologar `CPMS BARRANQUILLA (JYP)`.
- Resolver la fusión de `CPOMS ACACIAS` con `CPMS ACACIAS`.

Se encontraron además 44 etiquetas históricas que deberían cambiar a su nombre moderno. La búsqueda ya funciona mediante alias, pero el dropdown aún muestra el nombre anterior.

La categoría “Otros lugares activos” puede conservarse para no excluir condenados ubicados en CDT, URI o estaciones, pero no debe contabilizarse como uno de los 124 establecimientos.

## 8. Blindajes actuales

### 8.1 Parámetros enlazados

Los filtros se envían como binds:

```sql
:documentoPrefix
:defensorId
:nombreFilter
:lugarFilter
:departamentoFilter
:municipioFilter
```

No se concatena el texto del usuario directamente en el SQL.

### 8.2 Valores inválidos

Un ID o categoría inválidos generan:

```sql
1 = 0
```

Esto aplica para:

- Defensor inválido.
- Centro inexistente.
- Estado desconocido.
- Acción desconocida.
- Categoría potencial inválida.
- Documento sin dígitos.

### 8.3 Límites

- Catálogos: máximo 2.000 opciones desde la ruta.
- Usuarios asignados: 50 sin filtros y 100 filtrados.
- PAG: 100 iniciales y 200 filtrados.
- Backend: límite filtrado máximo de 200.
- Usuarios asignados no permite una consulta `tipo=all` sin filtros.

### 8.4 Caché

- Frontend: cinco minutos.
- Backend: cinco minutos para opciones.
- Máximo 12 variantes de caché por ruta.
- Consultas Oracle idénticas y simultáneas se agrupan.

### 8.5 Actividad

Los catálogos exigen situación vigente con `ACTIVO=1`.

Sin embargo, la consulta principal sólo agrega explícitamente:

```sql
NVL(s.ACTIVO, 0) = 1
```

cuando existe un filtro de ubicación. Una consulta PAG sin departamento, municipio o establecimiento podría incluir una situación reciente inactiva si todavía cumple la condición textual de condenado. Debe aplicarse `ACTIVO=1` obligatoriamente a todo el universo PAG.

## 9. Índices Oracle actuales

| Tabla | Índices relevantes |
|---|---|
| `PERSONA` | `NUMERO`, `ID_PERSONA` |
| `SITUACION_CARCELARIA` | `(ID_PERSONA, ACTIVO)`, `ID_SITUACION` |
| `GESTION_JURIDICA` | `ID_SITUACION`, `ID_GESTION` |
| `ASIGNACION` | `(CEDULA_DEFENSOR, FECHA_FIN)`, `(CEDULA_PAG, FECHA_FIN)`, asignación vigente por persona |
| `DEFENSORES` | `CEDULA` |
| `CALIFICACION_CONDUCTA` | Sólo clave primaria |

No existen índices específicos para:

- `PERSONA.NOMBRE`.
- `SITUACION_CARCELARIA.ESTABLECIMIENTO`.
- `DEPARTAMENTO`.
- `MUNICIPIO`.
- `CATEGORIZACION`.
- Las expresiones normalizadas.
- `CALIFICACION_CONDUCTA.ID_SITUACION`.

### 9.1 Limitaciones de indexación

La consulta transforma las columnas mediante:

```sql
UPPER
TRIM
TRANSLATE
REGEXP_REPLACE
REPLACE
TO_CHAR
```

Esto impide aprovechar completamente los índices B-tree tradicionales. Además, una búsqueda como:

```sql
LIKE '%nombre%'
```

no puede utilizar eficientemente un índice B-tree normal.

Mediciones observadas en la integración Oracle:

- Defensor por ID: aproximadamente 56 ms.
- Nombre: aproximadamente 3,2 segundos.
- Lugar, departamento o municipio: entre 2 y 2,4 segundos.
- Estado o acción calculada: entre 8 y 10 segundos.

No existe actualmente Oracle Text, Elasticsearch ni otra indexación textual.

## 10. Recomendaciones prioritarias

1. Aplicar `ACTIVO=1` obligatoriamente a toda consulta PAG.
2. Mover la separación Asignación/Reasignación al SQL antes del límite.
3. Implementar paginación real para evitar que los topes de 100/200 oculten personas.
4. Usar como referencia los 124 establecimientos de condenados del consolidado de julio.
5. Mantener “Otros lugares activos” como categoría adicional sin contabilizarla como establecimiento.
6. Completar la homologación de Manizales, Valledupar, Barranquilla JYP y Acacías.
7. Actualizar las 44 etiquetas históricas conservándolas como alias.
8. Incorporar `CENTRO_ID` al proceso de cargue SISIPEC.
9. Convertir establecimiento, departamento y municipio del Formulario de atención en catálogos controlados.
10. Crear columnas virtuales o persistentes normalizadas e indexarlas.
11. Evaluar índices para:

```sql
SITUACION_CARCELARIA(
    ID_PERSONA,
    FECHA_CORTE,
    FECHA_REGISTRO,
    ID_SITUACION
)

ASIGNACION(
    ID_PERSONA,
    FECHA_FIN,
    FECHA_ASIGNACION,
    ID_ASIGNACION
)

CALIFICACION_CONDUCTA(ID_SITUACION)
```

12. Para búsqueda por nombre con coincidencia interna, evaluar Oracle Text o una columna de búsqueda normalizada.

## 11. Conclusión

La búsqueda ya está protegida contra diferencias de tildes, espacios, mayúsculas, errores de codificación y alias conocidos. También utiliza identidades estables para centros y defensores cuando estas están disponibles.

Las principales limitaciones actuales son:

- La separación tardía de las pestañas de Asignación y Reasignación PAG.
- Los límites de resultados sin paginación.
- La falta de índices sobre las expresiones normalizadas.
- La posibilidad de incluir situaciones inactivas en PAG cuando no se filtra por ubicación.
- Que el catálogo PAG todavía no está fijado a los 124 establecimientos de control del consolidado de julio.
- Las homologaciones pendientes de Manizales, Valledupar, Barranquilla JYP y Acacías.

La homologación ya aplicada para Armenia mantiene separadas las identidades `CPMS ARMENIA` y `CPMSM ARMENIA`, conservando sus nombres históricos como alias.
