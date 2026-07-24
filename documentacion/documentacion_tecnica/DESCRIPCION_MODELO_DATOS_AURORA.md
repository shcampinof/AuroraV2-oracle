# Descripción del modelo de datos Aurora

Fecha: 2026-05-19

## Introducción

Este documento complementa el modelo entidad-relación y el diccionario de datos existentes. No los reemplaza. La descripción resume los objetos de datos usados por la aplicación y la documentación técnica asociada.

## Fuente de datos del sistema

La aplicación trabaja principalmente contra Oracle. El backend abre las conexiones con `oracledb` y centraliza la ejecución de consultas en `backend/db/oraclePool.js`.

En `backend/data/` permanece un archivo local: `formatos.mock.js`. Ese archivo funciona como catálogo de formatos descargables para la Caja de Herramientas; no reemplaza ni complementa las tablas de negocio de Oracle.

## Documentos oficiales del modelo

Documentos de referencia:

- `documentacion/documentacion_tecnica/base_datos/DICCIONARIO_MODELO_DNDP.html`
- `documentacion/documentacion_tecnica/base_datos/Diagrama.png`
- `documentacion/documentacion_tecnica/base_datos/Manual de despliegue.pdf`
- Documentos técnicos en `documentacion/soporte/base_datos/10_diccionario_campos_base_datos.md`, `documentacion/soporte/base_datos/12_sql_oracle_principales.md` y `documentacion/soporte/base_datos/13_mapeo_formularios_bd.md`.

El MER y el diccionario de datos son la referencia formal cuando han sido aprobados por el equipo responsable.

## Tablas o entidades principales

Objetos usados por consultas, repositorios y scripts:

| Objeto | Uso en la aplicación |
|---|---|
| `PERSONA` | Información base de personas. |
| `SITUACION_CARCELARIA` | Datos de reclusión, proceso, situación y ubicación. |
| `GESTION_JURIDICA` | Actuaciones o gestiones jurídicas. |
| `ASIGNACION` | Asignación activa o histórica de defensores. |
| `DEFENSORES` | Catálogo de defensores. |
| `PAG` | Catálogo o validación de PAG. |
| `CALIFICACION_CONDUCTA` | Calificaciones de conducta asociadas a persona. |
| `REGIONALES` | Tabla incluida en script de base de prueba. |
| `PONAL` | Tabla staging de carga cruda desde Excel PONAL/CDT. |
| `SISIPEC` | Tabla staging de carga cruda desde Excel SISIPEC. |
| `AURORA_10` | Tabla staging de migración/carga desde Aurora 1.0. |
| `LOG_CARGA` | Bitácora Oracle de procedimientos ETL. |

No se deben inferir relaciones no confirmadas por el MER o diccionario oficial.

## Relación general usada por la aplicación

Las consultas y repositorios relacionan los objetos así:

- `PERSONA` se relaciona con `SITUACION_CARCELARIA` para construir listados y detalle.
- `PERSONA` se relaciona con `GESTION_JURIDICA` para historial y actuaciones.
- `PERSONA` se relaciona con `ASIGNACION` para defensor asignado.
- `ASIGNACION` puede relacionarse con `DEFENSORES`.
- `CALIFICACION_CONDUCTA` complementa información del formulario.
- `PAG` se usa para validar asignaciones.
- `PONAL`, `SISIPEC` y `AURORA_10` alimentan procesos ETL que actualizan el modelo normalizado.

La definición formal de relaciones corresponde al MER oficial.

## Campos principales usados por la aplicación

Campos o conceptos usados por la aplicación:

- Número de identificación.
- Nombre de usuario.
- Situación jurídica.
- Lugar de reclusión.
- Departamento de reclusión.
- Municipio de reclusión.
- Autoridad a cargo.
- Número de proceso.
- Defensor asignado.
- Acción o actuación a impulsar.
- Estado del caso.
- Fechas de análisis, entrevista, solicitud y decisión.
- Datos de calificación de conducta.
- Cédula y nombre de PAG.
- Cédula, nombre, correo y regional de defensor.

Los nombres exactos de columnas deben validarse contra el diccionario de datos.

## Repositorios relevantes

| Archivo | Responsabilidad |
|---|---|
| `personaRepository.js` | Listados, detalle y datos consolidados de persona. |
| `gestionRepository.js` | Historial y creación/actualización de gestiones jurídicas. |
| `asignacionRepository.js` | Reemplazo o cierre de asignaciones activas. |
| `defensoresRepository.js` | Consulta y creación de defensores. |
| `pagRepository.js` | Validación por cédula PAG. |
| `situacionRepository.js` | Actualización de situación carcelaria. |
| `calificacionConductaRepository.js` | Escritura de calificaciones. |
| `oracleConsolidado.repo.js` | Fachada usada por rutas PPL. |
| `oraclePool.js` | Ejecución SQL y reemplazo de esquema. |

## Staging y ETL

Las tablas `PONAL`, `SISIPEC` y `AURORA_10` se consideran tablas staging: reciben datos crudos desde archivos Excel y sirven como entrada para procedimientos ETL Oracle.

| Staging | Archivo fuente | Procedimiento |
|---|---|---|
| `PONAL` | `CONSOLIDADO_PPL_REGIONES.xlsx` | `PRC_CARGA_PONAL` |
| `SISIPEC` | `Consolidado_SISIPEC.xlsx` | `PRC_CARGA_SISIPEC` |
| `AURORA_10` | `Aurora_1_0.xlsx` | `PRC_CARGA_AURORA10` |

La ejecución operativa está documentada en `documentacion/soporte/operacion/16_cargas_staging_etl_bd.md`.

## Observaciones sobre Oracle

- El código contiene referencias `DNDP.` que se reemplazan por `ORACLE_SCHEMA`.
- `ORACLE_SCHEMA` permite apuntar a esquemas temporales de prueba.
- El script `test-db:setup` se niega a ejecutarse contra `DNDP` salvo autorización explícita.
- El endpoint `/api/health/db` valida conectividad con `SELECT 1 AS DB_OK FROM dual`.

## Recomendaciones para mantener el diccionario

- Actualizar el diccionario cuando cambien columnas usadas por el formulario.
- Registrar cambios de tablas y secuencias.
- Mantener una matriz entre campos frontend y columnas Oracle.
- Versionar scripts de migración o cambios de modelo si existen.
- Validar cada cambio con DBA antes de producción.

## Alcances pendientes de confirmación

- El MER completo debe mantenerse alineado con la base Oracle real y con el diccionario oficial.
- La existencia de todos los objetos en producción debe confirmarse con el DBA o responsable de base de datos.
- `AURORA_10`, `PONAL` y `SISIPEC` se usan como tablas staging para procesos de carga/ETL; no son consultadas directamente por las vistas de negocio ordinarias del frontend.

## Recomendaciones finales

- Usar este documento como mapa de lectura del código, no como diccionario oficial.
- Mantener el MER y el diccionario de datos como referencia autorizada.
- Ejecutar pruebas de escritura solo contra esquemas temporales.
