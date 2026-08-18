# Línea base del caso de negocio de Aurora

> Estado documental: vigente al 2026-07-30.

![Ilustración 1 de Línea base del caso de negocio de Aurora](assets/identidad_defensoria.png)

![Ilustración 2 de Línea base del caso de negocio de Aurora](assets/visual_derechos_humanos.png)

![Ilustración 3 de Línea base del caso de negocio de Aurora](assets/fondo_institucional.png)

## Control de cambios

| Versión | Fecha | Responsable | Descripción del cambio | Aprobación |
| --- | --- | --- | --- | --- |
| 1.0 | 2026-05-19 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Versión inicial de entrega técnica. | Equipo DNDP |
| 1.1 | 2026-05-28 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Ajuste de formato institucional, control documental, índice, repositorio institucional, despliegue, roles, URL de ambiente y pruebas. | Pendiente aprobación institucional |
| 1.2 | 2026-07-30 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Ampliación de alcance, actores, historias, criterios de aceptación, riesgos y requisitos no funcionales. | Pendiente aprobación institucional |

## Tabla de contenido

Índice generado con la estructura de títulos del documento.

Antecedentes

Necesidad institucional

Objetivos

Usuarios beneficiarios

Historias de usuario

Supuestos y restricciones


## Antecedentes

Aurora surge como herramienta de apoyo para organizar, consultar y registrar actuaciones asociadas a la atención jurídica de personas privadas de la libertad, fortaleciendo la oportunidad, trazabilidad y consistencia de la gestión realizada por la Dirección Nacional de Defensoría Pública.

## Necesidad institucional

La operación requiere consolidar información de diferentes fuentes, apoyar la asignación de defensores, registrar actuaciones, consultar estados y facilitar el seguimiento funcional de casos. La solución permite disminuir reprocesos y entregar una vista organizada para los usuarios autorizados.

## Objetivos

- Centralizar la consulta funcional de personas y casos.

- Apoyar el diligenciamiento de formularios de atención.

- Facilitar asignación y reasignación de defensores.

- Permitir cargas mensuales de información externa hacia staging/ETL.

- Habilitar descarga de formatos institucionales.

- Generar evidencias de atención y seguimiento.

## Usuarios beneficiarios

| Usuario | Beneficio operativo |
| --- | --- |
| PAG | Asignación y seguimiento de usuarios y defensores. |
| Defensor público | Consulta y registro de actuaciones. |
| Administrador funcional | Cargas mensuales y seguimiento operativo. |
| Equipo técnico | Despliegue, soporte, validación y mantenimiento. |

## Historias de usuario

| ID | Historia de usuario | Beneficio |
| --- | --- | --- |
| HU-001 | Como usuario autorizado quiero ingresar con mi cuenta institucional para operar Aurora de forma segura. | Control de acceso y trazabilidad. |
| HU-002 | Como defensor quiero consultar una persona por documento para revisar su información jurídica. | Agilidad en consulta. |
| HU-003 | Como defensor quiero diligenciar el formulario de atención para registrar avances del caso. | Seguimiento estructurado. |
| HU-004 | Como PAG quiero asignar o reasignar defensores a usuarios seleccionados. | Gestión operativa de carga laboral. |
| HU-005 | Como usuario quiero filtrar registros para ubicar casos por criterios funcionales. | Búsqueda y priorización. |
| HU-006 | Como administrador quiero cargar archivos .xlsx mensuales para alimentar staging y ETL. | Actualización periódica de información. |
| HU-007 | Como usuario quiero descargar formatos institucionales para soportar trámites. | Estandarización documental. |
| HU-008 | Como equipo funcional quiero generar consolidaciones PDF de atención. | Soporte y evidencia de gestión. |
| HU-009 | Como administrador quiero habilitar, deshabilitar e importar usuarios autorizados para controlar el acceso. | Gobierno operativo de cuentas. |
| HU-010 | Como PAG quiero crear defensores y administrar accesos PAG autorizados. | Continuidad de asignación. |
| HU-011 | Como usuario quiero consultar tutoriales desde Aurora. | Adopción y soporte funcional. |
| HU-012 | Como responsable de cargas quiero consultar logs, reintentar y depurar datos ficticios de forma controlada. | Recuperación operativa con trazabilidad. |

## Supuestos y restricciones

- La autenticación institucional depende de configuración Microsoft Entra ID.

- La publicación por URL institucional depende de Infraestructura.

- La conexión Oracle y objetos ETL dependen de DBA/entidad.

- La auditoría nominal por edición requiere soporte del modelo de datos si se exige persistencia por usuario.

## Alcance funcional vigente

Aurora cubre dos flujos jurídicos: condenados y sindicados. Presenta datos consolidados, conduce el formulario por bloques dependientes, calcula el estado de la actuación y mantiene historial. El sistema apoya la decisión y el seguimiento; no sustituye el criterio jurídico del defensor ni modifica las competencias institucionales.

Usuarios asignados ofrece paginación y filtros por defensor, identificación, estado, nombre y ubicación. La localización de defensores tolera tildes y variantes previsibles de texto histórico mal decodificado. La identificación del defensor sigue siendo el vínculo estable cuando el nombre presenta inconsistencias.

El módulo PAG permite asignación masiva, reasignación y creación de defensores únicamente a cuentas con rol `pag`. Usuarios autorizados permite a administradores gestionar el directorio interno e importar CSV con vista previa. Cargas mensuales procesa PONAL, SISIPEC y Aurora 1.0 mediante staging y procedimientos ETL.

## Fuera de alcance

- Corrección masiva de calidad de datos directamente en producción.
- Administración de usuarios, grupos o credenciales dentro de Entra ID o Active Directory.
- Sustitución del MER y del diccionario de datos gobernados por DBA.
- Custodia documental de PDF o Excel fuera de los canales institucionales.
- Alta disponibilidad, réplica de Oracle o recuperación de infraestructura no configurada.
- Auditoría nominal de cada columna modificada mientras el modelo Oracle no la incorpore.

## Criterios de aceptación

| Capacidad | Criterio verificable |
| --- | --- |
| Acceso | Una cuenta válida y habilitada ingresa; una cuenta deshabilitada o sin rol requerido no obtiene privilegios. |
| Consulta | Documento y filtros devuelven registros coherentes con Oracle y respetan paginación. |
| Datos heredados | Un defensor con nombre acentuado o mojibake puede localizarse y sus casos muestran el nombre canónico cuando existe cédula. |
| Formulario | Reglas, dependencias, fechas, cierre y estados corresponden al flujo condenado o sindicado. |
| Historial | Una actuación incompleta se continúa sin crear duplicados indebidos. |
| Asignación | Solo rol PAG asigna; la nueva asignación queda activa y la anterior se cierra. |
| PDF | El consolidado contiene los datos visibles y se genera sin exponer información de otro registro. |
| Cargas | La fuente válida registra estado y log; un error es legible, acotado y reintentable cuando aplica. |
| Usuarios | El CRUD y CSV respetan permisos, límites, duplicados, correo y estado. |
| Despliegue | Contenedor saludable, Oracle disponible, login y funciones críticas comprobadas. |

## Requisitos no funcionales

Seguridad exige HTTPS, control de acceso en backend, secretos fuera del código, consultas parametrizadas, errores saneados y tratamiento restringido de datos. Mantenibilidad exige archivos de bloqueo, pruebas automatizadas, documentación por versión y separación entre rutas, servicios y repositorios.

La disponibilidad se supervisa con healthcheck de aplicación y comprobación separada de Oracle. La recuperación conserva volúmenes y vincula cada despliegue a una versión. El rendimiento se controla con pool Oracle, paginación y caché breve de filtros; los índices productivos son responsabilidad conjunta del equipo técnico y DBA.

## Riesgos y mitigaciones

| Riesgo | Efecto | Mitigación |
| --- | --- | --- |
| Datos con codificación dañada | Filtros incompletos y nombres inconsistentes. | Búsqueda tolerante, resolución por cédula y corrección controlada en origen. |
| Dependencia de Oracle | Interrupción de consulta y escritura. | Healthcheck separado, pool, monitoreo y plan DBA. |
| Configuración incorrecta de identidad | Bloqueo o acceso indebido. | Matriz de roles, modo administrado, pruebas por perfil y bootstrap temporal. |
| Pérdida de volúmenes | Pérdida de usuarios internos o evidencias de cargas. | Respaldos y restauración probados; evitar `down -v`. |
| Excel no conforme | Falla de staging o ETL. | Validación de fuente, tamaño, columnas, log y reintento controlado. |
| Trabajo sin conexión compartido | Escritura bajo identidad incorrecta. | Cola vinculada a identidad y descarte en logout o cambio de usuario. |

## Indicadores operativos

La operación puede medir disponibilidad de `/api/health`, porcentaje de cargas exitosas, tiempo de recuperación, casos asignados, actuaciones por estado, fallos de autenticación y antigüedad de tareas según semáforo. Los indicadores se interpretan con contexto funcional y no reemplazan la revisión de calidad de datos.
