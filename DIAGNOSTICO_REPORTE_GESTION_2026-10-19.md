# Reporte de gestión: histórico, personas asignadas y cierres

Revisión del 19 de octubre de 2026. Periodo de comprobación: **1 de enero de
2025 a 19 de octubre de 2026**.

## Alcance y resultado

Se corrigió el código del reporte y se contrastaron consultas reales en Oracle.
La conexión disponible apunta al servicio **DNDPDEV.defensoria.gov.co**, esquema
**DNDP**. Esta revisión no acredita los números originales de producción:
no se dispone del Excel, de sus filtros exactos ni del corte de aquellos PDF.
No se modificaron expedientes ni se publicó esta corrección.

Se encontraron diferencias de criterios que explican por qué las cifras pueden
variar en ambos sentidos:

- El reporte incluía personas con situación carcelaria inactiva. El listado de
  condenados exige que la situación más reciente siga activa.
- El reporte incluía condenados y sindicados, en todos los establecimientos del
  defensor. Un Excel filtrado por establecimiento o por situación jurídica
  representa otro conjunto.
- La carga **actualmente asignada** y las actuaciones **históricas del periodo**
  son conjuntos diferentes. Una reasignación cambia el primero, pero debe
  conservar el segundo para el defensor que realizó cada actuación.
- Una fila de gestión no equivale a una persona. El conteo de personas debe usar
  `ID_PERSONA` único, después de aplicar los mismos filtros.
- El texto almacenado en `ACCION_REALIZAR` puede estar desactualizado. El estado
  jurídico se obtiene de las reglas compartidas con el listado y el formulario.

## 6.1. Histórico después de una reasignación

### Cómo se hacía

Para cada hito fechado se buscaba una asignación del defensor a la persona:

```sql
AND EXISTS (
  SELECT 1
  FROM DNDP.ASIGNACION a
  WHERE a.ID_PERSONA = e.ID_PERSONA
    -- Coincidencia por cédula o nombre normalizado del defensor seleccionado.
    AND (
      a.FECHA_FIN IS NULL
      OR (
        e.FECHA >= TRUNC(a.FECHA_ASIGNACION)
        AND e.FECHA < TRUNC(a.FECHA_FIN) + 1
      )
    )
)
```

El problema del intervalo era asimétrico: mientras la asignación estuviera
vigente incluía toda la historia. Al terminarla, exigía que la fecha de la
actuación fuera posterior a `FECHA_ASIGNACION`. Las actuaciones importadas
anteriores al alta técnica podían desaparecer del reporte del defensor anterior
y pasar al nuevo. Dos reasignaciones en un mismo día también podían hacer que
un hito satisficiera más de un intervalo.

Además, `asignacionRepository` actualiza `DEFENSOR_GESTION` al cambiar el
responsable de una gestión abierta. Por eso ese campo, por sí solo, **no es un
registro inmutable del autor de todos sus hitos**. Sustituir el filtro anterior
por una comparación directa con ese campo tampoco resolvería todos los casos.

### Cómo queda

Se conserva el flujo que permite continuar una gestión abierta al reasignarla.
La consulta del reporte reconstruye su atribución sin reescribir gestiones:

1. Contrasta `DEFENSOR_GESTION` con la asignación existente al registrar la gestión.
2. Usa ese defensor cuando corresponde al registro original. Esto también permite
   conservar gestiones nuevas con fechas de hitos retroactivas.
3. Cuando cambió el responsable, atribuye cada hito según su propia fecha y el
   historial de asignaciones. También cubre la secuencia A → B → A.
4. Para cargas anteriores al alta técnica, la **primera** asignación puede cubrir
   actuaciones anteriores a su fecha de inicio. Las siguientes no heredan toda
   la historia.
5. Elige una sola asignación por hito, ordenando por `FECHA_ASIGNACION` e
   `ID_ASIGNACION`. Dos solicitudes o insistencias distintas siguen siendo dos
   actuaciones, aunque compartan fecha.
6. Conserva en el detalle `fuenteAutor`: `DEFENSOR_GESTION` o
   `ASIGNACION_HISTORICA`.

El intervalo de respaldo es:

```sql
(a.ORDEN = 1 OR e.FECHA >= TRUNC(a.FECHA_ASIGNACION))
AND (a.FECHA_FIN IS NULL OR e.FECHA < TRUNC(a.FECHA_FIN) + 1)
```

`ORDEN` se calcula sobre **todas** las asignaciones de la persona, sin filtrar
previamente por defensor. La selección de una sola fila también ocurre antes
de filtrar al defensor del reporte.

**Límite de los datos:** si falta el historial, la fecha de registro o la
identificación del autor, no existe evidencia suficiente para reconstruir toda
la autoría con certeza. Se usa la información disponible. Si el hito solo tiene
fecha y hubo varias reasignaciones ese día, se elige la última de ese día;
esto evita duplicaciones, pero no demuestra la hora real de la actuación.
Los homónimos con distintas cédulas no reciben automáticamente una actuación
identificada únicamente por su nombre ambiguo.

## 6.2. Personas asignadas y casos cerrados

### Cómo se hacía

`listAssignedCasesForReport` elegía la situación más reciente de cada persona,
la última asignación vigente y la gestión más reciente con información. Sin
embargo, **no exigía situación carcelaria activa ni limitaba el tipo jurídico o
el establecimiento**. La regional seleccionada solo se usaba en el encabezado.

El resumen contaba las filas devueltas como personas asignadas y utilizaba el
estado calculado de la situación actual para contar las cerradas. Una situación
inactiva se presenta como `CASO_CERRADO`, aunque no sea un cierre jurídico
impulsado por ese defensor durante el periodo.

Por otra parte, los cierres del periodo se detectaban por texto libre de
`CIERRE_CASO`, `ACCION_REALIZAR` o `ACTUACION_ADELANTAR`. Ese criterio podía tanto
omitir cierres derivados de las respuestas como aceptar textos antiguos.

### Cómo queda

El reporte y el listado usan el mismo constructor de filtros y las mismas
reglas de estado:

- Una situación más reciente por persona; no se recupera una situación antigua
  solo porque estuviera activa.
- Una asignación vigente por persona (`FECHA_FIN IS NULL`).
- Selección explícita de condenados, sindicados o ambos.
- Establecimiento opcional, con coincidencia del nombre exacto normalizado.
- Exclusión de situaciones inactivas por defecto. La opción **Incluir personas
  fuera de prisión** permite ampliar el universo al consultar todos los tipos,
  igual que en Usuarios asignados.
- Personas únicas por `ID_PERSONA`, también en la construcción del resumen.
- Estado de la última gestión con información, usando las reglas del flujo;
  no el texto libre de la acción guardada.

El PDF y la pantalla aclaran que la regional es de encabezado. El filtro de
establecimiento sí restringe las consultas. Para comparar con el listado,
se deben igualar defensor, tipo, establecimiento e inclusión de inactivos.

El núcleo del conteo corregido, sobre el CTE real `assigned_rows`, es:

```sql
SELECT
  COUNT(DISTINCT ID_PERSONA) AS PERSONAS_ASIGNADAS,
  COUNT(DISTINCT CASE
    WHEN ESTADO_CODIGO <> 'CASO_CERRADO' THEN ID_PERSONA
  END) AS PERSONAS_ACTIVAS,
  COUNT(DISTINCT CASE
    WHEN ESTADO_CODIGO = 'CASO_CERRADO' THEN ID_PERSONA
  END) AS PERSONAS_CON_CASO_CERRADO,
  COUNT(DISTINCT CASE
    WHEN SITUACION_ACTIVA = 0 THEN ID_PERSONA
  END) AS PERSONAS_FUERA_PRISION
FROM assigned_rows;
```

El script de auditoría exporta esta consulta **con todos sus CTE, reglas de
estado y parámetros**, lista para ejecutar en Oracle. El fragmento anterior
explica el agregado; no sustituye los CTE del archivo exportado.

### Indicadores que no deben confundirse

| Indicador | Identificador y criterio |
| --- | --- |
| Personas asignadas | `ID_PERSONA` único, asignación vigente y filtros actuales. |
| Personas activas | Personas del conjunto anterior cuyo estado no es `CASO_CERRADO`. |
| Total de personas con caso cerrado | Personas del conjunto actual cuyo estado es `CASO_CERRADO`. Si se incluyen inactivos, también incluye esas situaciones. |
| Casos cerrados durante el periodo | `ID_SITUACION` único con cierre jurídico derivado de sus respuestas y fecha de referencia dentro del periodo. Puede pertenecer a una persona ya reasignada. |
| Personas con cierre durante el periodo | `ID_PERSONA` único entre los cierres anteriores. |
| Actuaciones | Hitos por gestión: análisis, entrevista, cada solicitud, cada insistencia y recurso. Los cierres no se suman al total de actuaciones. |

En este reporte, «caso» cerrado durante el periodo conserva la unidad existente:
`ID_SITUACION`. No representa un conteo independiente de radicados judiciales.

**Las fechas de inicio y fin filtran actuaciones; no reconstruyen la carga
asignada a una fecha pasada.** Ampliar el inicio a 2025 no convierte la cifra de
asignados en «todas las personas que alguna vez atendió el defensor».

No existe una fecha independiente de cierre jurídico. Se mantiene como
referencia la primera disponible en este orden: decisión del recurso, decisión
de la autoridad, presentación del recurso, recurso desfavorable, entrevista,
análisis y registro. El reporte lo indica. Una situación inactiva por sí sola
no acredita un cierre jurídico fechado en el histórico.

## Resultados comprobados en DNDPDEV

Se compararon **los conjuntos de `ID_PERSONA` y los estados de cierre por
persona**, no solamente las sumas. Los conjuntos del reporte y del listado
coincidieron en las doce combinaciones evaluadas: cuatro alcances por cada uno
de los tres nombres siguientes. Las cuatro de Abrahan estaban vacías.

| Defensor y alcance | Personas | Con caso cerrado | Fuera de prisión |
| --- | ---: | ---: | ---: |
| Jorge Ovidio Suárez Merchán, criterio anterior: todos, incluidos inactivos | 192 | 90 | 54 |
| Jorge, ambos tipos, solo situaciones activas | 138 | 36 | 0 |
| Jorge, condenados, todos los establecimientos, situaciones activas | 136 | 36 | 0 |
| Jorge, condenados, CPMS GIRARDOT, situaciones activas | 130 | 33 | 0 |
| Germán Arturo Puentes Cuéllar, criterio anterior: todos, incluidos inactivos | 161 | 46 | 26 |
| Germán, condenados, todos los establecimientos, situaciones activas | 135 | 20 | 0 |
| Germán, condenados, CPMS GIRARDOT, situaciones activas | 131 | 20 | 0 |

Para Jorge, las 90 personas cerradas del criterio anterior se descomponen en
**54 situaciones inactivas + 36 personas todavía en prisión con caso cerrado**.
No corresponde afirmar que 90 deba pasar a 52: esa cifra de producción no pudo
reproducirse con el corte y datos disponibles.

En el periodo comprobado, la consulta anterior encontraba 44 situaciones de
Jorge con cierre por texto; las reglas del flujo encuentran 61 cierres jurídicos
con fecha de referencia. Tampoco deben compararse directamente con las 36 o 33
personas cerradas de la carga actual: pertenecen al histórico del periodo.

Abrahan Alberto Cleves Monje existe en el catálogo, pero en esta conexión no
tiene asignaciones ni actuaciones. No se pudo comprobar aquí el ejemplo de
78 frente a 89. Tampoco se dispone de la identidad exacta del tercer defensor
mencionado de Girardot. Las cifras 149/159 y 78/89 requieren comparar los
conjuntos de IDs del mismo ambiente y corte; estos resultados de desarrollo
no las sustituyen.

## Consultas completas y repetición de la auditoría

Desde la raíz del proyecto, con la configuración del ambiente que se quiera
revisar:

```sh
DOTENV_CONFIG_PATH="$PWD/.env" npm --prefix backend run audit:reportes-gestion -- \
  --fecha-inicio 2025-01-01 --fecha-fin 2026-10-19 \
  --output-dir /tmp/aurora-auditoria-gestion
```

Para un defensor concreto:

```sh
DOTENV_CONFIG_PATH="$PWD/.env" npm --prefix backend run audit:reportes-gestion -- \
  --defensor "JORGE OVIDIO SUAREZ MERCHAN" \
  --fecha-inicio 2025-01-01 --fecha-fin 2026-10-19 \
  --output-dir /tmp/aurora-auditoria-jorge
```

Si existe una cédula canónica, añadir `--cedula` con sus dígitos. Para comparar
con producción, ejecutar con sus variables de conexión de lectura y el corte
correspondiente. El script imprime el servicio consultado y solo hace `SELECT`.

El directorio contiene:

- `resultado.json`: conteos, IDs incluidos, IDs cerrados e IDs excluidos respecto
  del universo anterior.
- `*.sql`: SQL exacto ejecutado por los repositorios y la reconstrucción de la
  consulta anterior de actuaciones.
- `*.conteo.sql`: consulta completa de agregados por persona.
- `*.binds.json`: valores de los parámetros Oracle, sin credenciales.

En esta revisión se guardaron en
`/tmp/aurora-auditoria-gestion-20261019`. Los archivos 01 y 04 muestran, para
Jorge, el universo anterior y el nuevo por defecto; el 08 corresponde a
condenados activos de CPMS GIRARDOT. Cada archivo tiene sus propios binds.

Para revisar un Excel, comparar `ID_PERSONA` únicos después de aplicar los
mismos filtros. Si la columna «defensor» del Excel representa al autor histórico
de una gestión, no debe usarse como equivalente al defensor actualmente
asignado. También hay que comprobar que no contenga situaciones o
establecimientos históricos de la misma persona.

## Validación

- 18 suites del backend aprobadas.
- 330 pruebas de frontend, en 25 archivos, aprobadas; lint y compilación aprobados.
- Matriz de estados en Oracle: 58 escenarios y 406 comprobaciones, sin fallos.
- Consulta real de conteo exportada para Jorge en Girardot: 130 asignadas,
  97 activas y 33 cerradas.
- Prueba de autoría en Oracle con fixtures en CTE: importación anterior al alta,
  reasignación, responsable sobrescrito, vuelta A → B → A, actuaciones distintas
  en la misma fecha, homónimos, cierres derivados, inactividad y límites del
  periodo. No inserta ni actualiza filas.

```sh
RUN_ORACLE_INTEGRATION=true DOTENV_CONFIG_PATH="$PWD/.env" \
  npm --prefix backend run test:oracle:reportes-gestion
```

La corrección está preparada en el espacio de trabajo. La validación de los
archivos y totales originales de producción sigue pendiente de disponer de
ese ambiente y corte.
