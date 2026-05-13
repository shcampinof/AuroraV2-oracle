# Manual de usuario Aurora

Fecha de generación: 2026-05-12

## Introducción

Este manual describe el uso funcional de Aurora a partir de los módulos visibles en el frontend. No reemplaza capacitación institucional ni procedimientos internos.

## Objetivo del sistema

Aurora permite apoyar la gestión de atención jurídica de personas privadas de la libertad mediante consulta de registros, formularios de atención, asignación de defensores, seguimiento de actuaciones y acceso a formatos.

## Perfil de usuarios

Por la interfaz y textos del login, el sistema está orientado a personal autorizado de la entidad. No se pudo validar en esta revisión el listado real de roles o perfiles institucionales.

## Ingreso al sistema

La pantalla de ingreso solicita usuario y contraseña institucional. El código también contempla ingreso con Azure AD si está configurado.

Pasos generales:

1. Abrir la URL del sistema.
2. Ingresar usuario institucional.
3. Ingresar contraseña.
4. Seleccionar `Iniciar Sesión`.

Si el ingreso no avanza, se debe validar que la cuenta esté activa y autorizada.

## Módulos principales detectados

| Módulo | Descripción |
|---|---|
| Inicio | Pantalla de bienvenida. |
| Formulario de atención | Consulta y gestión de información de una persona. |
| Usuarios asignados | Listado de registros con filtros. |
| PAG - Asignación de casos de condenados | Asignación o reasignación de defensores. |
| Caja de Herramientas | Consulta y descarga de formatos. |
| Manual Interactivo | Material de apoyo dentro de la aplicación. |

## Consulta de información

Desde el módulo `Formulario de atención` se puede consultar un registro por número de documento. Desde `Usuarios asignados` se observan listados y selección de registros para abrir el formulario.

No se pudo validar en esta revisión el comportamiento completo de todos los campos del formulario, porque algunas reglas dependen de datos y estados reales.

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

No se pudo validar en esta revisión el procedimiento institucional completo para autorizar asignaciones.

## Descarga de documentos

La `Caja de Herramientas` consulta formatos desde `/api/formatos` y redirige la descarga mediante `/api/formatos/:id/download`.

Formatos detectados en código:

- Solicitudes ante INPEC y JEPMS.
- Documentos relacionados con libertad condicional, prisión domiciliaria, acumulación jurídica de penas y otros trámites.
- Formato de entrevista o pruebas tipo para arraigo.

La descarga final depende de la URL configurada en `FORMATOS_BASE_URL` o del valor por defecto del backend.

## Mensajes de error comunes

| Mensaje o situación | Posible causa |
|---|---|
| `Usuario o contraseña inválidos` | Credenciales incorrectas o usuario no autorizado. |
| `Registro no encontrado` | Documento no existe o no está disponible para el usuario. |
| `Error consultando PPL` | Falla de backend o base de datos. |
| `Error guardando registro` | Falla de validación, red o base de datos. |
| `No fue posible validar la cédula del PAG` | Cédula no encontrada o error de consulta. |

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
| ¿Puedo asignar defensores sin validar PAG? | El flujo observado exige validar la cédula PAG para asignaciones. |
| ¿Qué hago si falla una descarga? | Reportar el formato, fecha y mensaje observado. |

## Recomendaciones finales

- Usar Aurora únicamente para fines institucionales.
- Confirmar información antes de guardar cambios.
- Solicitar soporte si una acción de edición o asignación no coincide con el procedimiento funcional vigente.
