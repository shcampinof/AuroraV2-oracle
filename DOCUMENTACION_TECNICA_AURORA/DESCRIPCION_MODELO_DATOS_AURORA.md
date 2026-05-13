# Descripción del modelo de datos Aurora

Fecha: 2026-05-13

## Introducción

Este documento complementa el modelo entidad-relación y el diccionario de datos existentes. No los reemplaza. La descripción se limita a objetos detectados en código y documentación incluida en el repositorio.

## Fuente de datos identificada

La fuente principal es Oracle. El backend se conecta mediante `oracledb` y usa un pool en `backend/db/oraclePool.js`.

El catálogo local de formatos se mantiene en `backend/data/formatos.mock.js`. No debe usarse como fuente de datos de negocio.

## Documentos oficiales del modelo

Se identificaron:

- `docs/DICCIONARIO_MODELO_DNDP.html`
- `BD Documentation/DICCIONARIO_MODELO_DNDP.html`
- `BD Documentation/Diagrama.png`
- `BD Documentation/Manual de despliegue.pdf`
- Documentos técnicos en `docs/10_diccionario_campos_base_datos.md`, `docs/12_sql_oracle_principales.md` y `docs/13_mapeo_formularios_bd.md`.

El MER y el diccionario de datos deben considerarse la referencia oficial si están aprobados por el equipo responsable.

## Tablas o entidades detectadas

Objetos detectados en consultas y scripts:

| Objeto | Uso observado |
|---|---|
| `PERSONA` | Información base de personas. |
| `SITUACION_CARCELARIA` | Datos de reclusión, proceso, situación y ubicación. |
| `GESTION_JURIDICA` | Actuaciones o gestiones jurídicas. |
| `ASIGNACION` | Asignación activa o histórica de defensores. |
| `DEFENSORES` | Catálogo de defensores. |
| `PAG` | Catálogo o validación de PAG. |
| `CALIFICACION_CONDUCTA` | Calificaciones de conducta asociadas a persona. |
| `REGIONALES` | Tabla incluida en script de base de prueba. |
| `PONAL` | Tabla incluida en script de base de prueba. |
| `SISIPEC` | Tabla incluida en script de base de prueba. |
| `AURORA_10` | Tabla incluida en script de base de prueba. |
| `LOG_CARGA` | Tabla incluida en script de base de prueba. |

No se deben inferir relaciones no confirmadas por el MER o diccionario oficial.

## Relación general inferida desde el código

Desde las consultas se observa que:

- `PERSONA` se relaciona con `SITUACION_CARCELARIA` para construir listados y detalle.
- `PERSONA` se relaciona con `GESTION_JURIDICA` para historial y actuaciones.
- `PERSONA` se relaciona con `ASIGNACION` para defensor asignado.
- `ASIGNACION` puede relacionarse con `DEFENSORES`.
- `CALIFICACION_CONDUCTA` complementa información del formulario.
- `PAG` se usa para validar asignaciones.

Esta relación es una lectura técnica del código. Debe contrastarse con el MER oficial.

## Campos principales usados por la aplicación

Campos o conceptos observados:

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

## Limitaciones

- No se pudo validar en esta revisión el MER completo en una base Oracle real.
- No se pudo validar en esta revisión la existencia de todos los objetos en producción.
- No se pudo validar en esta revisión si `AURORA_10`, `PONAL`, `SISIPEC` y `LOG_CARGA` son usados directamente por la aplicación o solo por documentación/procesos de carga.

## Recomendaciones finales

- Usar este documento como mapa de lectura del código, no como diccionario oficial.
- Mantener el MER y el diccionario de datos como referencia autorizada.
- Ejecutar pruebas de escritura solo contra esquemas temporales.
