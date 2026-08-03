# Descripción del modelo de datos de Aurora

> Estado documental: vigente al 2026-07-30.

![Ilustración 1 de Descripción del modelo de datos de Aurora](assets/identidad_defensoria.png)

![Ilustración 2 de Descripción del modelo de datos de Aurora](assets/visual_derechos_humanos.png)

![Ilustración 3 de Descripción del modelo de datos de Aurora](assets/fondo_institucional.png)

## Control de cambios

| Versión | Fecha | Responsable | Descripción del cambio | Aprobación |
| --- | --- | --- | --- | --- |
| 1.0 | 2026-05-19 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Versión inicial de entrega técnica. | Equipo DNDP |
| 1.1 | 2026-05-28 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Ajuste de formato institucional, control documental, índice, repositorio institucional, despliegue, roles, URL de ambiente y pruebas. | Pendiente aprobación institucional |
| 1.2 | 2026-07-30 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Actualización de objetos, persistencia auxiliar, transacciones, búsqueda compatible con datos heredados y controles ETL. | Pendiente aprobación institucional |

## Tabla de contenido

Índice generado con la estructura de títulos del documento.

Introducción

Fuente de datos

Documentos oficiales del modelo

Tablas o entidades detectadas

Relación general inferida desde el código

Campos principales usados por la aplicación

Repositorios relevantes

Staging y ETL

Observaciones sobre Oracle

Observaciones sobre CSV

Recomendaciones para mantener el diccionario

Limitaciones

Recomendaciones finales


## Introducción

Este documento complementa el modelo entidad-relación y el diccionario de datos existentes. No los reemplaza. La descripción se limita a objetos detectados en código y documentación incluida en el repositorio.

## Fuente de datos

La aplicación trabaja principalmente contra Oracle. El backend abre las conexiones con `oracledb` y centraliza la ejecución de consultas en `backend/db/oraclePool.js`.

En `backend/data/` existe `formatos.js`. Ese archivo funciona como catálogo versionado de formatos descargables para la Caja de Herramientas; no reemplaza ni complementa las tablas de negocio de Oracle.

## Documentos oficiales del modelo

El MER, el diccionario de datos y los scripts aprobados se custodian por el canal definido por el frente de base de datos. Este repositorio contiene la descripción de uso desde Aurora, pero no sustituye esa fuente. Toda modificación se contrasta con la versión identificada por el DBA y se registra con fecha, responsable y ambiente.

Dentro de esta entrega, la referencia complementaria es `DESCRIPCION_MODELO_DATOS_AURORA.md`, junto con el código de `backend/repositories/oracle/`, `backend/db/` y `scripts/cargas_bd/`.

## Tablas o entidades detectadas

Objetos detectados en consultas y scripts:

| Objeto | Uso observado |
| --- | --- |
| PERSONA | Información base de personas. |
| SITUACION_CARCELARIA | Datos de reclusión, proceso, situación y ubicación. |
| GESTION_JURIDICA | Actuaciones o gestiones jurídicas. |
| ASIGNACION | Asignación activa o histórica de defensores. |
| DEFENSORES | Catálogo de defensores. |
| PAG | Catálogo o validación de PAG. |
| CALIFICACION_CONDUCTA | Calificaciones de conducta asociadas a persona. |
| REGIONALES | Tabla incluida en script de base de prueba. |
| PONAL | Tabla staging de carga cruda desde Excel PONAL/CDT. |
| SISIPEC | Tabla staging de carga cruda desde Excel SISIPEC. |
| AURORA_10 | Tabla staging de migración/carga desde Aurora 1.0. |
| LOG_CARGA | Bitácora Oracle de procedimientos ETL. |

No se deben inferir relaciones no confirmadas por el MER o diccionario oficial.

## Relación general inferida desde el código

Desde las consultas se observa que:

- PERSONA se relaciona con SITUACION_CARCELARIA para construir listados y detalle.

- PERSONA se relaciona con GESTION_JURIDICA para historial y actuaciones.

- PERSONA se relaciona con ASIGNACION para defensor asignado.

- ASIGNACION puede relacionarse con DEFENSORES.

- CALIFICACION_CONDUCTA complementa información del formulario.

- PAG se usa para validar asignaciones.

- PONAL, SISIPEC y AURORA_10 alimentan procesos ETL que actualizan el modelo normalizado.

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
| --- | --- |
| personaRepository.js | Listados, detalle y datos consolidados de persona. |
| gestionRepository.js | Historial y creación/actualización de gestiones jurídicas. |
| asignacionRepository.js | Reemplazo o cierre de asignaciones activas. |
| defensoresRepository.js | Consulta y creación de defensores. |
| pagRepository.js | Validación por cédula PAG. |
| situacionRepository.js | Actualización de situación carcelaria. |
| calificacionConductaRepository.js | Escritura de calificaciones. |
| oracleConsolidado.repo.js | Fachada usada por rutas PPL. |
| oraclePool.js | Ejecución SQL y reemplazo de esquema. |

## Staging y ETL

Las tablas PONAL, SISIPEC y AURORA_10 se consideran tablas staging: reciben datos crudos desde archivos Excel y sirven como entrada para procedimientos ETL Oracle.

| Staging | Archivo fuente | Procedimiento |
| --- | --- | --- |
| PONAL | CONSOLIDADO_PPL_REGIONES.xlsx | PRC_CARGA_PONAL |
| SISIPEC | Consolidado_SISIPEC.xlsx | PRC_CARGA_SISIPEC |
| AURORA_10 | Aurora_1_0.xlsx | PRC_CARGA_AURORA10 |

La ejecución operativa se describe en `GUIA_DESPLIEGUE_AURORA.md`, `MANUAL_TECNICO_AURORA.md` y `scripts/cargas_bd/README.md`.

## Observaciones sobre Oracle

- El código contiene referencias DNDP. que se reemplazan por ORACLE_SCHEMA.

- ORACLE_SCHEMA permite apuntar a esquemas temporales de prueba.

- El script test-db:setup se niega a ejecutarse contra DNDP salvo autorización explícita.

- El endpoint /api/health/db valida conectividad con SELECT 1 AS DB_OK FROM dual.

## Observaciones sobre CSV

El repositorio incluye CSV con datos que podrían ser personales o institucionales. Se recomienda:

- Confirmar si son datos reales.

- Anonimizarlos si se usan en desarrollo.

- Excluirlos del repositorio si no son necesarios para operación.

- Evitar usarlos como evidencia pública.

## Recomendaciones para mantener el diccionario

- Actualizar el diccionario cuando cambien columnas usadas por el formulario.

- Registrar cambios de tablas y secuencias.

- Mantener una matriz entre campos frontend y columnas Oracle.

- Versionar scripts de migración o cambios de modelo si existen.

- Validar cada cambio con DBA antes de producción.

## Persistencia auxiliar fuera de Oracle

Aurora mantiene dos conjuntos de estado operativo en volúmenes Docker. El directorio interno de usuarios autorizados se almacena como JSON bajo `backend/storage/auth/` en el contenedor y contiene correo, nombre, roles, estado y fechas administrativas, sin contraseñas institucionales. Las cargas mensuales conservan registro, archivos recibidos y logs en `backend/storage/cargas_bd/`.

La depuración controlada registra auditoría en formato JSON Lines. Estos archivos requieren respaldo, permisos restringidos y retención institucional. No deben incorporarse al repositorio de código.

## Integridad transaccional

La asignación cierra las asignaciones activas anteriores antes de insertar la nueva relación. La operación usa transacción y revierte si falla alguna parte. La creación o actualización de actuaciones coordina `GESTION_JURIDICA`, los datos editables de `SITUACION_CARCELARIA` y las calificaciones cuando corresponde.

La depuración de datos ficticios obtiene primero un conteo, limita la operación a un defensor exacto configurado y elimina gestiones y asignaciones relacionadas dentro de una transacción. No expone una sentencia de borrado arbitraria.

El cálculo `MAX(ID)+1` solo funciona como alternativa cuando el ambiente no proporciona una secuencia configurada; la opción preferente es `ORACLE_GESTION_ID_SEQUENCE`. El DBA confirma llaves, restricciones y comportamiento concurrente.

## Compatibilidad con codificación heredada

Algunos nombres históricos pueden contener mojibake por una decodificación previa incorrecta. La búsqueda de defensores genera variantes limitadas del criterio —texto original, normalizado y reparaciones previsibles— y las envía como binds. Esta tolerancia mejora la localización y no altera los datos almacenados.

Cuando una asignación contiene cédula de defensor, el listado resuelve el nombre desde `DEFENSORES`. La cédula actúa como clave estable y evita depender exclusivamente del texto histórico. La limpieza definitiva en producción requiere respaldo, validación del DBA y un cambio controlado.

## Índices y rendimiento

Los listados consultan con frecuencia documento de persona, situación vigente, asignación activa, cédula de defensor y última gestión. El DBA confirma índices sobre llaves de unión y predicados de vigencia. Las búsquedas que aplican funciones de normalización sobre nombres pueden requerir índices basados en función si el volumen y el plan de ejecución lo justifican.

La API limita el tamaño de página y mantiene una caché breve para opciones de filtro. Estas medidas reducen transferencia, pero no sustituyen estadísticas actualizadas ni revisión del plan SQL.

## Limitaciones

- El MER y el diccionario aprobados determinan cardinalidades, nulabilidad y restricciones definitivas.

- La existencia, privilegios, índices y volúmenes de los objetos productivos se certifican con el DBA durante el despliegue.

- AURORA_10, PONAL y SISIPEC se usan como tablas staging para procesos de carga/ETL; no son consultadas directamente por las vistas de negocio ordinarias del frontend.

## Recomendaciones finales

- Usar este documento como mapa técnico del código y el diccionario aprobado como definición contractual del modelo.

- Mantener el MER y el diccionario de datos como referencia autorizada.

- Ejecutar pruebas de escritura solo contra esquemas temporales.
