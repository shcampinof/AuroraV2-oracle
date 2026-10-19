# Revisión de reasignaciones desde PAG

Fecha: 19 de octubre de 2026.
Ambiente comprobado: servicio Oracle **DNDPDEV**, esquema **DNDP**, usando la
configuración de la raíz y del contenedor `aurora-aurora-1`.

## Resultado

**No se reprodujo el bloqueo en el ambiente conectado.** El código actual
permite reasignar varias veces un caso y la prueba contra Oracle lo confirmó.
Falta conocer el caso, el ambiente y el mensaje de error del reporte funcional
para determinar su causa concreta.

## Antecedente que coincide con el síntoma

El repositorio conserva una migración para corregir el índice único
`IDX_ASIG_VIGENTE`. Su definición anterior era:

```sql
(ID_PERSONA, NVL(TO_CHAR(FECHA_FIN, 'YYYYMMDD'), 'VIGENTE'))
```

Al reasignar, se cierra la asignación anterior con `FECHA_FIN = SYSDATE` y se
inserta una nueva. Con ese índice, dos asignaciones históricas de la misma
persona cerradas el mismo día tienen la misma clave. La primera reasignación
puede funcionar y la segunda falla por unicidad (`ORA-00001`). También puede
afectar la eliminación de una asignación después de reasignar ese día.

La migración existe desde el commit `7670fa0` y reemplaza esa definición por:

```sql
CASE WHEN FECHA_FIN IS NULL THEN ID_PERSONA END
```

Este índice permite múltiples asignaciones cerradas y exige una sola activa.
**En la base revisada ya tiene esta definición, es UNIQUE y está VALID.** No
se aplicó ninguna migración porque allí no es necesaria. Se encontraron siete
combinaciones persona/día con múltiples cierres históricos, hasta cuatro
cierres en un día; la más reciente corresponde al 20 de agosto de 2026.

## Comprobaciones realizadas

- Prueba real del SQL de `asignacionRepository` en Oracle: asignación inicial,
  tres reasignaciones consecutivas (incluido volver al defensor inicial),
  eliminación y asignación posterior. Se verificaron el último defensor, todo
  el historial y como máximo una asignación activa después de cada operación.
- La prueba utilizó una persona sintética en una sola conexión, sin commit.
  Se comprobó que el rollback eliminó la persona y sus cinco asignaciones.
  Las secuencias Oracle sí consumen valores aunque se revierta la transacción.
- Dos pruebas de interacción React: tres reasignaciones seguidas del mismo
  condenado y del mismo sindicado, sin salir del módulo. Se verificaron los
  documentos y la cédula del nuevo defensor enviados en cada guardado, la
  posibilidad de volver a seleccionar el caso y la actualización del listado.
  Estas pruebas simulan las respuestas HTTP; no sustituyen una reproducción
  desde el navegador y ambiente del funcional.
- Pasaron las tres pruebas existentes de filtros PAG y la suite
  `asignacion-safety.test.js`. Pasaron lint del nuevo archivo de frontend,
  revisión de sintaxis del script y comprobación de espacios del diff.
- El repositorio de asignaciones y el servicio de PPL tienen el mismo hash
  que los archivos del contenedor en ejecución.

No se cambió la lógica funcional ni se publicó una nueva versión. Se añadieron
pruebas de regresión y este diagnóstico.

## Prueba posterior desde el navegador

A solicitud del usuario, se probó la aplicación publicada en HTTPS con Chromium
y Playwright. Se utilizó una sesión técnica con rol **PAG**, sin rol de
administrador, y los endpoints reales, sin simular respuestas de asignación.

**Resultado: OK.** Se recorrió **PAG - Asignación de casos de condenados →
Reasignación** con un condenado sintético, un PAG y dos defensores de prueba:

1. Validación del PAG y asignación inicial al defensor A.
2. Reasignación A → B.
3. Segunda reasignación B → A, sin salir del módulo.
4. Tercera reasignación A → B, sin salir del módulo.
5. Recarga del navegador, validación del PAG y nueva consulta: seguía asignado a B.
6. Consulta por defensor anterior A: cero resultados; consulta por B: un resultado.

Los cuatro guardados respondieron **HTTP 200, `updated=1` y `requested=1`**.
En cada paso se comprobó el detalle HTTP y el historial directamente en Oracle:
defensor y PAG correctos, cuatro asignaciones conservadas al finalizar las
reasignaciones y una sola activa.

La limpieza confirmó cero registros restantes del fixture en PERSONA,
SITUACION_CARCELARIA, ASIGNACION, PAG y DEFENSORES. No se cambiaron expedientes
reales. Esta prueba sí confirma el comportamiento de la aplicación en ejecución,
pero su conexión sigue siendo **DNDPDEV**: no acredita la configuración de la
base de producción donde se originó el comentario funcional.

El script reproducible es `backend/scripts/pag-reasignacion.browser.integration.js`.
Requiere Playwright instalado aparte y autorización explícita mediante
`RUN_PAG_BROWSER_INTEGRATION=true`; no agrega dependencias a la aplicación.
`PLAYWRIGHT_MODULE_PATH` puede indicar la ruta absoluta del módulo instalado;
`PAG_BROWSER_BASE_URL` permite indicar el URL de la aplicación.

## Repetir el diagnóstico

Inspección del índice, sin modificarlo:

```sh
DOTENV_CONFIG_PATH="$PWD/.env" npm --prefix backend run db:fix-asignacion-index
```

Prueba Oracle con datos sintéticos y rollback obligatorio:

```sh
RUN_ORACLE_INTEGRATION=true DOTENV_CONFIG_PATH="$PWD/.env" \
  node backend/scripts/oracle-reasignacion.integration.js
```

Pruebas de pantalla y filtros:

```sh
npm --prefix frontend test -- src/pages/AsignacionDefensores.reasignacion.test.jsx src/pages/AsignacionDefensores.test.jsx
node backend/scripts/asignacion-safety.test.js
```

Si el funcional estaba consultando por defensor actual, después de reasignar
el caso deja de pertenecer a ese filtro. Para localizarlo de nuevo se debe
buscar por documento o por el nuevo defensor. Es el comportamiento de la
consulta actual; no demuestra un fallo al guardar.

En otro ambiente, consultar primero la definición de `IDX_ASIG_VIGENTE`. Si
conserva la definición antigua, la migración existente es la corrección
correspondiente. Si ya está corregido, se necesita el error y caso concretos
para continuar; no corresponde atribuir automáticamente el reporte al índice.
