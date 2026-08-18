# Descripción del código fuente de Aurora

> Estado documental: vigente al 2026-07-30.

![Ilustración 1 de Descripción del código fuente de Aurora](assets/identidad_defensoria.png)

![Ilustración 2 de Descripción del código fuente de Aurora](assets/visual_derechos_humanos.png)

![Ilustración 3 de Descripción del código fuente de Aurora](assets/fondo_institucional.png)

## Control de cambios

| Versión | Fecha | Responsable | Descripción del cambio | Aprobación |
| --- | --- | --- | --- | --- |
| 1.0 | 2026-05-19 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Versión inicial de entrega técnica. | Equipo DNDP |
| 1.1 | 2026-05-28 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Ajuste de formato institucional, control documental, índice, repositorio institucional, despliegue, roles, URL de ambiente y pruebas. | Pendiente aprobación institucional |
| 1.2 | 2026-07-30 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Actualización integral de estructura, autenticación, administración de usuarios, pruebas, PWA y controles de operación. | Pendiente aprobación institucional |

## Tabla de contenido

Índice generado con la estructura de títulos del documento.

Objeto

Ubicación institucional

Estructura principal

Autenticación y roles

Trazabilidad de usuario y auditoría

Variables relevantes

Diagramas de apoyo

Diagrama de componentes de Aurora

Diagrama de autenticación y roles de Aurora


## Objeto

Este documento describe la estructura del código fuente consolidado para la versión cero de Aurora y las configuraciones relevantes para despliegue, autenticación, roles y operación.

## Ubicación institucional

La versión cero del código fuente se entrega en SharePoint: Documentos > Aurora > codigo_fuente_Aurora.zip. La entidad podrá usar este archivo como insumo para el repositorio institucional Azure DevOps.

## Estructura principal

| Ruta | Descripción |
| --- | --- |
| frontend/ | Aplicación de usuario React/Vite. |
| backend/ | API Express, autenticación, rutas funcionales y acceso a Oracle. |
| scripts/cargas_bd/ | Servicios Python para cargas Excel hacia staging y ETL. |
| Dockerfile | Imagen productiva de un solo servicio. |
| docker-compose.yml | Orquestación del contenedor Aurora. |
| .env.example | Plantilla de variables sin secretos. |
| scripts/ | Controles de codificación y entrypoint del contenedor. |
| backend/tutorial-videos/ | Tutoriales incluidos en la imagen y manifiesto de integridad SHA-256. |

## Autenticación y roles

Aurora soporta autenticación institucional mediante Microsoft Entra ID / Azure AD. El backend valida el token, emite una sesión propia de Aurora y conserva en la sesión los roles recibidos.

| Elemento | Configuración / comportamiento |
| --- | --- |
| Autenticación institucional | Microsoft Entra ID / Azure AD mediante App Registration y MSAL. |
| Rol user | Consulta, diligenciamiento de formularios, descarga de formatos y operación ordinaria. |
| Rol pag | Acceso a asignación y reasignación de casos y creación de defensores. |
| Rol admin | Administración del directorio interno de usuarios y actividades de soporte autorizadas. |
| Roles carguebd/cargas_bd | Operación de cargas mensuales cuando coinciden con `CARGUEBD_ADMIN_ROLES`. |
| Variables | AZURE_AD_REQUIRED_APP_ROLES, AZURE_AD_REQUIRED_GROUP_IDS y CARGUEBD_ADMIN_ROLES. |
| Azure DevOps | Repositorio institucional de código; no administra el ingreso funcional de usuarios finales. |

Para diferenciar administradores y usuarios se recomienda crear roles de aplicación con valores normalizados, por ejemplo admin y user. Los usuarios con rol admin pueden acceder a módulos administrativos si el rol está incluido en CARGUEBD_ADMIN_ROLES.

## Trazabilidad de usuario y auditoría

La sesión de Aurora contiene id, nombre, correo, proveedor y roles del usuario autenticado. El módulo de cargas registra el usuario que sube archivos en su bitácora operativa.

En el modelo Oracle documentado, GESTION_JURIDICA y ASIGNACION registran fechas de operación como FECHA_REGISTRO y FECHA_ASIGNACION. No se identifica una columna específica para almacenar el usuario autenticado que modifica cada formulario o asignación.

Para trazabilidad plena por usuario en base de datos, se recomienda incorporar columnas de auditoría o una tabla transaccional, previa aprobación del frente de base de datos.

La depuración administrativa de actuaciones ficticias sí genera una bitácora JSON Lines independiente. La operación exige rol de cargas, confirmación explícita, coincidencia con el defensor configurado, conteo previo y transacción Oracle. Esta función está deliberadamente acotada y no representa un borrado genérico.

## Variables relevantes

| Variable | Descripción |
| --- | --- |
| VITE_API_BASE_URL | En Docker debe ser /api. |
| AUTH_JWT_SECRET | Secreto de sesión Aurora. |
| AZURE_AD_TENANT_ID | Tenant institucional. |
| AZURE_AD_CLIENT_ID | Aplicación registrada para Aurora. |
| AZURE_AD_REQUIRED_APP_ROLES | Roles permitidos para usar Aurora. |
| AZURE_AD_REQUIRED_GROUP_IDS | Grupos autorizados si aplica. |
| CARGUEBD_ADMIN_ROLES | Roles que habilitan módulo de cargas. |
| ORACLE_* | Conexión a Oracle. |

## Mapa detallado del backend

| Ruta | Responsabilidad vigente |
| --- | --- |
| `backend/index.js` | Arranque HTTP/HTTPS, Helmet, CORS, límites JSON, rutas, frontend estático, sanitización de errores y cierre ordenado. |
| `backend/routes/auth.js` | Configuración pública de proveedores, login local/LDAP/Entra ID y consulta de sesión. |
| `backend/services/authService.js` | Validación de tokens institucionales, emisión de JWT Aurora, roles y control de usuarios. |
| `backend/services/ldapAuthService.js` | Normalización del identificador, validación de dominio y bind LDAP/LDAPS. |
| `backend/services/userDirectoryService.js` | Persistencia atómica del directorio interno, bootstrap de administradores y evaluación de acceso. |
| `backend/routes/adminUsers.js` | CRUD administrativo e importación CSV con vista previa y límites. |
| `backend/routes/ppl.js` | Listados, filtros, detalle, actuaciones, actualización y asignación. |
| `backend/services/pplService.js` | Reglas de aplicación, normalización y coordinación de repositorios. |
| `backend/repositories/oracle/` | SQL parametrizado por agregado funcional. |
| `backend/services/cargaBdService.js` | Recepción, registro, ejecución en segundo plano, logs, reintentos y reparación del registro de cargas. |
| `backend/services/actuacionCleanupService.js` | Vista previa y depuración transaccional controlada. |
| `backend/data/formatos.js` | Catálogo versionado de enlaces de Caja de Herramientas. |

## Mapa detallado del frontend

`App.jsx` administra la sesión, el aviso obligatorio de tratamiento de datos y la navegación por hash. `Sidebar.jsx` aplica visibilidad por rol. Las páginas funcionales son `FormularioAtencion.jsx`, `RegistrosAsignados.jsx`, `AsignacionDefensores.jsx`, `CajaHerramientas.jsx`, `ManualInteractivo.jsx`, `AdminCargasBD.jsx` y `AdminUsuarios.jsx`.

Las reglas de condenado y sindicado están separadas en `formRules.aurora.ts`, `formRules.celeste.ts`, `evaluateAuroraRules.ts` y `evaluateCelesteRules.ts`. `estadoActuaciones.rules.ts` convierte el estado lógico en etiqueta y semáforo. Esta separación permite probar las decisiones sin renderizar toda la pantalla.

`frontend/public/service-worker.js` implementa caché y cola offline. `authStorage.js` centraliza el almacenamiento de sesión. La cola persiste únicamente operaciones admitidas y conserva la identidad propietaria para impedir que un usuario reproduzca escrituras de otro.

## Compatibilidad de texto y datos heredados

La capa de datos reconoce variantes de nombres con tildes, sin tildes y secuencias típicas de mojibake. La comparación se amplía con variantes controladas y parámetros enlazados; no se modifica el contenido almacenado ni se construye SQL con entrada libre. La corrección definitiva corresponde a la fuente de datos, pero esta defensa mantiene localizables los registros históricos.

Los valores devueltos se normalizan para presentación. En asignaciones, la cédula enlaza el registro con `DEFENSORES` y permite mostrar el nombre canónico del catálogo aun cuando una copia histórica esté dañada.

## Pruebas y calidad

La raíz coordina lint, pruebas, build y backend mediante `npm run qa:smoke`. El backend incluye verificaciones de configuración de autenticación, acceso PAG, importación CSV, cargas, depuración, seguridad de asignaciones y búsqueda con texto mal codificado. El frontend prueba reglas de condenado, sindicado, estados, validaciones de actuaciones, PWA y manual interactivo.

`npm run qa:encoding` detecta secuencias sospechosas en archivos versionados. `npm run encoding:normalize` existe para una normalización deliberada, que debe revisarse antes de incorporarse. Los tres `npm audit` revisan dependencias raíz, backend y frontend.

## Convenciones de mantenimiento

- Las rutas validan entrada y delegan lógica; los repositorios concentran SQL.
- Las consultas usan binds Oracle. Los identificadores de esquema y secuencia pasan por validación explícita.
- Los errores públicos se reducen a mensajes controlados; los detalles quedan en logs técnicos.
- Las variables nuevas se agregan a `.env.example`, Docker Compose y la documentación correspondiente.
- Todo cambio en una regla funcional incluye o actualiza pruebas deterministas.
- Los artefactos generados, datos operativos y secretos permanecen fuera del repositorio.

## Diagramas de apoyo

### Diagrama de componentes de Aurora

![Ilustración 4 de Descripción del código fuente de Aurora](assets/diagrama_componentes_aurora.png)

Figura. Diagrama de componentes de Aurora.

### Diagrama de autenticación y roles de Aurora

![Ilustración 5 de Descripción del código fuente de Aurora](assets/diagrama_autenticacion_roles_aurora.png)

Figura. Diagrama de autenticación y roles de Aurora.
