# Manual de usuario Aurora

Fecha: 2026-05-19

## Introducción

Este manual describe el uso funcional de Aurora a partir de los módulos visibles en el frontend. No reemplaza capacitación institucional ni procedimientos internos.

## Objetivo del sistema

Aurora permite apoyar la gestión de atención jurídica de personas privadas de la libertad mediante consulta de registros, formularios de atención, asignación de defensores, seguimiento de actuaciones y acceso a formatos.

## Perfil de usuarios

El sistema está orientado a personal autorizado de la entidad. Los roles o perfiles institucionales deben definirse en la matriz de acceso correspondiente.

## Ingreso al sistema

La pantalla de ingreso solicita usuario y contraseña institucional. El código también contempla ingreso con Azure AD si está configurado.

Pasos generales:

1. Abrir la URL del sistema.
2. Ingresar usuario institucional.
3. Ingresar contraseña.
4. Seleccionar `Iniciar Sesión`.

Si el ingreso no avanza, se debe validar que la cuenta esté activa y autorizada.

## Módulos principales

| Módulo | Descripción |
|---|---|
| Inicio | Pantalla de bienvenida. |
| Formulario de atención | Consulta y gestión de información de una persona. |
| Usuarios asignados | Listado de registros con filtros. |
| PAG - Asignación de casos de condenados | Asignación o reasignación de defensores. |
| Caja de Herramientas | Consulta y descarga de formatos. |
| Manual Interactivo | Material de apoyo dentro de la aplicación. |
| Cargas mensuales | Módulo administrativo para subir Excel de PONAL, SISIPEC y Aurora 1.0. |

## Consulta de información

Desde el módulo `Formulario de atención` se puede consultar un registro por número de documento. Desde `Usuarios asignados` se observan listados y selección de registros para abrir el formulario.

El comportamiento completo de los campos del formulario depende de los datos del caso, la situación jurídica y las reglas funcionales vigentes.

## Uso de filtros o búsqueda

En `Usuarios asignados` y `PAG - Asignación de casos de condenados` se identificaron filtros por criterios como:

- Documento.
- Departamento.
- Municipio.
- Defensor.
- Estado.

La disponibilidad de opciones depende de los datos entregados por el backend.

## Visualización de registros

La vista de registros presenta información como:

- Número de identificación.
- Nombre.
- Lugar de reclusión.
- Departamento y municipio.
- Situación jurídica.
- Defensor asignado.
- Acción o estado asociado.

Al seleccionar un registro, la aplicación puede abrir el formulario de atención asociado.

## Edición o gestión de información

El código del frontend y backend contempla actualización de registros mediante `PUT /api/ppl/:documento` y creación de actuaciones mediante `POST /api/ppl/:documento/actuaciones`.

Se recomienda que el usuario diligencie los campos siguiendo las reglas funcionales definidas por la entidad. Si un campo obligatorio falta o una fecha no es válida, la interfaz puede impedir guardar o mostrar un mensaje de error.

## Asignación de defensores

El módulo de asignación permite:

- Validar cédula PAG.
- Consultar personas condenadas.
- Consultar catálogo de defensores.
- Asignar o reasignar defensor a uno o varios documentos.
- Crear defensor si el flujo lo permite.

La autorización institucional para asignaciones debe seguir el procedimiento definido por la entidad.

## Descarga de documentos

La `Caja de Herramientas` consulta formatos desde `/api/formatos` y redirige la descarga mediante `/api/formatos/:id/download`.

Formatos disponibles:

- Solicitudes ante INPEC y JEPMS.
- Documentos relacionados con libertad condicional, prisión domiciliaria, acumulación jurídica de penas y otros trámites.
- Formato de entrevista o pruebas tipo para arraigo.

La descarga final depende del enlace configurado para cada formato.

## Cargas mensuales

El módulo `Cargas mensuales` solo está disponible para usuarios con rol autorizado. Permite:

- Seleccionar la fuente de datos: PONAL, SISIPEC o Aurora 1.0.
- Subir un archivo `.xlsx`.
- Iniciar la carga hacia la base de datos.
- Consultar el historial de cargas.
- Revisar logs técnicos.
- Reintentar una carga fallida.

El usuario debe confirmar que el archivo corresponde a la fuente seleccionada antes de subirlo. Si Aurora 1.0 deja de usarse, esa fuente puede deshabilitarse por configuración y no aparecerá como opción operativa.

## Mensajes de error comunes

| Mensaje o situación | Posible causa |
|---|---|
| `Usuario o contraseña inválidos` | Credenciales incorrectas o usuario no autorizado. |
| `Registro no encontrado` | Documento no existe o no está disponible para el usuario. |
| `Error consultando PPL` | Falla de backend o base de datos. |
| `Error guardando registro` | Falla de validación, red o base de datos. |
| `No fue posible validar la cédula del PAG` | Cédula no encontrada o error de consulta. |
| `No tiene permisos para administrar cargas de base de datos` | El usuario no cuenta con rol autorizado para cargas mensuales. |
| `Solo se permiten archivos .xlsx` | Se intentó subir un formato diferente a Excel `.xlsx`. |

## Buenas prácticas de uso

- Usar solo cuentas autorizadas.
- Cerrar sesión al terminar.
- No compartir capturas con datos personales por canales no autorizados.
- Verificar documento y datos antes de guardar.
- Reportar errores con fecha, hora, módulo y acción realizada.

## Preguntas frecuentes básicas

| Pregunta | Respuesta |
|---|---|
| ¿Puedo ingresar sin cuenta autorizada? | No. El sistema es de acceso restringido. |
| ¿Qué hago si no aparece un registro? | Validar el documento y reportar al soporte funcional o técnico. |
| ¿Dónde descargo formatos? | En el módulo Caja de Herramientas. |
| ¿Puedo asignar defensores sin validar PAG? | El flujo actual exige validar la cédula PAG para asignaciones. |
| ¿Qué hago si falla una descarga? | Reportar el formato, fecha y mensaje mostrado. |

## Recomendaciones finales

- Usar Aurora únicamente para fines institucionales.
- Confirmar información antes de guardar cambios.
- Solicitar soporte si una acción de edición o asignación no coincide con el procedimiento funcional vigente.
