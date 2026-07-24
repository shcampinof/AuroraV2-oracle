# Manual de usuario Aurora

Fecha de actualización: 2026-07-24

## Introducción

Este manual describe el uso funcional de Aurora a partir de los módulos visibles en el frontend. No reemplaza capacitación institucional ni procedimientos internos.

## Objetivo del sistema

Aurora permite apoyar la gestión de atención jurídica de personas privadas de la libertad mediante consulta de registros, formularios de atención, asignación de defensores, seguimiento de actuaciones y acceso a formatos.

## Perfil de usuarios

El sistema está orientado a personal autorizado de la entidad. El perfil `user` permite la operación general; `pag` habilita exclusivamente el módulo PAG y sus operaciones de asignación; `admin` permite administrar usuarios; y `carguebd` o los roles configurados en `CARGUEBD_ADMIN_ROLES` habilitan las cargas mensuales. Una cuenta puede combinar perfiles.

## Ingreso al sistema

La pantalla de ingreso solicita usuario y contraseña institucional. El código también contempla ingreso con Azure AD si está configurado.

Pasos generales:

1. Abrir la URL del sistema.
2. Ingresar usuario institucional.
3. Ingresar contraseña.
4. Seleccionar `Iniciar Sesión`.
5. Leer el aviso de tratamiento de datos y seleccionar `Aceptar y continuar`. La opción `No aceptar` cierra la sesión.

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
| Usuarios autorizados | Administración individual o masiva de cuentas y perfiles. |

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

La disponibilidad de opciones depende de los datos entregados por el backend. `Usuarios asignados` inicia sin consultar filas; el usuario define los criterios y selecciona `Buscar`. La tabla presenta 25 registros por página y conserva temporalmente resultados y opciones para agilizar la navegación.

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
- Filtrar mujeres potenciales beneficiarias únicamente de Utilidad Pública.

La pestaña y las operaciones de validación PAG, asignación y creación de defensor requieren rol `pag`. Un administrador que también tenga rol `pag` dispone de la pestaña `Accesos PAG`, desde la que habilita o retira ese perfil a usuarios existentes.

## Historial de actuaciones

Cuando un PPL no tiene actuaciones guardadas, el historial muestra una actuación inicial pendiente con la acción `Analizar el caso`; al seleccionarla se abre el formulario sobre el registro actual sin crear anticipadamente una fila adicional.

Para personas condenadas, Aurora solo permite crear una actuación adicional cuando la última actuación real tiene información diligenciada desde la pregunta 29. Guardar una actuación actualiza el historial y el estado visible con los datos persistidos.

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

La depuración disponible dentro de este módulo está limitada al defensor de prueba configurado. La vista previa informa actuaciones y asignaciones activas; la confirmación elimina ambas dentro de una transacción, sin eliminar personas ni situaciones jurídicas.

## Usuarios autorizados

El rol `admin` permite:

- Registrar un correo, seleccionar sus roles y habilitarlo.
- Habilitar o deshabilitar el ingreso general.
- Asignar o retirar los roles `user`, `pag`, `admin` y `carguebd`.
- Eliminar una cuenta administrada.
- Importar un CSV con encabezado `correo`.

La importación muestra una vista previa antes de guardar. Los correos nuevos se crean habilitados con rol `user`; los existentes no se modifican; y los duplicados o inválidos se informan por separado. El nombre queda pendiente hasta el primer ingreso institucional.

## Manual Interactivo

El módulo ofrece tres tutoriales reproducibles dentro de Aurora:

- Defensor(a) público(a) para condenados.
- Defensor(a) público(a) en Ley 906.
- PAG de programa condenados.

Los videos se sirven desde el mismo origen de la aplicación, permiten adelantar la reproducción y no dependen de enlaces externos.

## Mensajes de error comunes

| Mensaje o situación | Posible causa |
|---|---|
| `Usuario o contraseña inválidos` | Credenciales incorrectas o usuario no autorizado. |
| `Registro no encontrado` | Documento no existe o no está disponible para el usuario. |
| `Error consultando PPL` | Falla de backend o base de datos. |
| `Error guardando registro` | Falla de validación, red o base de datos. |
| `No fue posible validar la cédula del PAG` | Cédula no encontrada o error de consulta. |
| `No tiene permisos para administrar cargas de base de datos` | El usuario no cuenta con rol autorizado para cargas mensuales. |
| `No tiene permisos para acceder al módulo PAG` | La cuenta no tiene el rol `pag` vigente. |
| `Su usuario no se encuentra habilitado` | Un administrador deshabilitó la cuenta; las sesiones existentes también dejan de autorizar peticiones. |
| `El archivo CSV supera el tamaño permitido` | La importación supera `AUTH_USER_IMPORT_MAX_MB`. |
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
