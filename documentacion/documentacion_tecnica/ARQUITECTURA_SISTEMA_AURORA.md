# Arquitectura del sistema Aurora

Fecha de actualización: 2026-07-24

## Introducción

Este documento resume la arquitectura técnica de Aurora. La información se basa en el código fuente, `README.md`, archivos `package.json`, rutas del backend, configuración de Vite, archivos de entorno de ejemplo y `documentacion/soporte/pruebas/SET_PRUEBAS_AURORA.md`.

## Objetivo técnico del sistema

Aurora es una aplicación web para apoyar la gestión de atención jurídica de personas privadas de la libertad. El sistema permite consultar registros, revisar información jurídica, gestionar formularios de atención, consultar o registrar actuaciones y apoyar la asignación de defensores.

## Descripción general de la arquitectura

El proyecto cuenta con una arquitectura web separada en frontend y backend:

- Frontend: aplicación React construida con Vite.
- Backend: API Node.js con Express.
- Base de datos: conexión Oracle mediante el paquete `oracledb`.
- Datos complementarios: catálogo de formatos dentro de `backend/data/`.
- Cargas staging/ETL: módulo administrativo para cargar Excel mensuales hacia Oracle.
- Autenticación: JWT local y soporte para Azure AD si se configura.
- Autorización dinámica: los roles administrados se vuelven a consultar en cada petición autenticada.
- Multimedia: tutoriales MP4 locales servidos con soporte de solicitudes HTTP Range.

En producción, el backend puede servir el frontend compilado desde `backend/public/app`. El `Dockerfile` existente usa ese patrón: compila el frontend y copia el resultado al backend.

## Componentes principales

| Componente | Ubicación | Descripción |
|---|---|---|
| Frontend | `frontend/` | SPA React con navegación por hash y páginas funcionales. |
| Backend | `backend/` | API Express, autenticación, rutas de negocio y repositorios. |
| Oracle | `backend/db/oraclePool.js`, `backend/repositories/oracle/` | Fuente principal para consultas y escrituras de negocio. |
| Cargas staging/ETL | `scripts/cargas_bd/`, `backend/routes/adminCargas.js`, `backend/services/cargaBdService.js` | Carga Excel mensual a `PONAL`, `SISIPEC`, `AURORA_10` y ejecuta procedimientos ETL. |
| Formatos | `backend/data/formatos.mock.js` | Catálogo de documentos descargables desde la Caja de Herramientas. |
| Docker | `Dockerfile`, `docker-compose.yml` | Empaquetado de la aplicación en un servicio único. |
| Estados de actuaciones | `frontend/src/config/estadoActuaciones.rules.ts` | Derivación centralizada de etiquetas y semáforo para listados, historial y asignación. |
| Usuarios y roles | `backend/services/userDirectoryService.js`, `backend/routes/adminUsers.js` | Directorio administrado, vigencia inmediata de accesos e importación CSV. |
| Tutoriales | `backend/tutorial-videos/`, `frontend/src/pages/ManualInteractivo.jsx` | Catálogo local incluido en la imagen y reproducción desde `/tutorial-videos`. |

## Tecnologías utilizadas

| Capa | Tecnologías del proyecto |
|---|---|
| Frontend | React 19, Vite 7, Vitest, ESLint |
| Backend | Node.js 20, Express 5, CommonJS |
| Seguridad | Helmet, CORS, JWT, rate limit de login |
| Autenticación institucional | Azure AD mediante `@azure/msal-browser` y `jwks-rsa` |
| Datos | Oracle, `oracledb` |
| Despliegue | Docker, Docker Compose |

## Flujo general de comunicación

```text
Usuario
  -> Frontend React/Vite
  -> Servicios frontend en frontend/src/services/
  -> Backend Express bajo /api
  -> Repositorios Oracle y catálogo de formatos
  -> Oracle

Usuario admin
  -> Frontend /admin-cargas
  -> Backend /api/admin/cargas
  -> scripts/cargas_bd/loader_service.py
  -> Tablas staging y procedimientos ETL Oracle
```

Diagrama simple:

```text
Usuario -> Frontend -> Backend/API -> Oracle
```

## Rutas API principales

| Método | Ruta | Uso general | Protección |
|---|---|---|---|
| GET | `/api/health` | Salud básica del backend | Pública |
| GET | `/api/health/db` | Salud de conexión Oracle | Pública |
| GET | `/api/auth/config` | Configuración de autenticación | Pública |
| POST | `/api/auth/login` | Login local | Pública con rate limit |
| POST | `/api/auth/azure-ad` | Login con token Azure AD | Pública con rate limit |
| GET | `/api/auth/me` | Sesión actual | Requiere token |
| GET | `/api/ppl` | Listado general PPL | Requiere token |
| GET | `/api/ppl/condenados` | Listado filtrable para condenados/asignaciones | Requiere token |
| GET | `/api/ppl/condenados/filter-options` | Opciones de filtros | Requiere token |
| GET | `/api/ppl/pag/:cedula/validar` | Validación de PAG | Token + rol `pag` |
| POST | `/api/ppl/asignar-defensor` | Asignación de defensor | Token + rol `pag` |
| GET | `/api/ppl/:documento` | Consulta por documento | Requiere token |
| PUT | `/api/ppl/:documento` | Actualización de registro | Requiere token |
| GET | `/api/ppl/:documento/actuaciones` | Historial de actuaciones | Requiere token |
| POST | `/api/ppl/:documento/actuaciones` | Creación de actuación | Requiere token |
| GET | `/api/defensores` | Catálogo de defensores | Requiere token |
| POST | `/api/defensores` | Crear defensor | Token + rol `pag` |
| GET | `/api/formatos` | Listado de formatos | Requiere token |
| GET | `/api/formatos/:id/download` | Redirección de descarga | Requiere token |
| GET | `/api/admin/cargas/fuentes` | Fuentes de carga staging/ETL | Requiere token y rol admin |
| GET | `/api/admin/cargas` | Historial de cargas | Requiere token y rol admin |
| POST | `/api/admin/cargas` | Upload `.xlsx` e inicio de carga | Requiere token y rol admin |
| GET | `/api/admin/cargas/:id/log` | Log de carga | Requiere token y rol admin |
| POST | `/api/admin/cargas/:id/retry` | Reintento de carga | Requiere token y rol admin |
| GET/POST/PATCH/DELETE | `/api/admin/users` | Directorio administrado | Token + rol `admin` |
| POST | `/api/admin/users/import/preview` | Vista previa CSV | Token + rol `admin` |
| POST | `/api/admin/users/import` | Importación CSV | Token + rol `admin` |
| GET | `/tutorial-videos/:archivo` | Streaming de tutoriales | Público, mismo origen |

## Consideraciones de integración

- El frontend usa `VITE_API_BASE_URL`; para despliegue en el mismo origen se recomienda `/api`.
- En desarrollo, Vite proxifica `/api` hacia el backend.
- En desarrollo, Vite también proxifica `/tutorial-videos`; en producción Express sirve los MP4 incluidos en `backend/tutorial-videos/`.
- El backend usa `ORACLE_SCHEMA` para calificar objetos Oracle; si no se define, usa `ORACLE_USER`.
- El módulo de cargas usa `AURORA_CARGAS_DIR` para archivos y logs, y ejecuta Python con `CARGUEBD_PYTHON`.
- `CARGUEBD_AURORA10_ENABLED=false` deshabilita la fuente Aurora 1.0 cuando deje de operar.
- Azure AD solo queda habilitado si existen `AZURE_AD_TENANT_ID` y `AZURE_AD_CLIENT_ID`.
- Las rutas de negocio están protegidas por JWT mediante `requireAuth`.
- `requireAuth` combina los claims firmados con el registro administrado vigente. Una cuenta deshabilitada recibe `403` y una modificación de roles se aplica sin esperar a que expire el JWT.
- Las mutaciones PAG usan `requirePag`; consultar información general no concede por sí mismo capacidad de asignar o crear defensores.
- La etiqueta visible de estado se deriva en frontend con `getEstadoDisplayInfo`; los campos persistidos `Estado del trámite` y `Estado del caso` se mantienen por compatibilidad.
- El historial recalcula la actuación activa con el registro en memoria para evitar depender de recargas durante la edición.

## Alcances que deben confirmarse por ambiente

- La infraestructura real de despliegue debe confirmarse con el responsable del ambiente correspondiente.
- La configuración productiva de Azure AD depende del registro institucional de la aplicación: tenant, client ID, dominios, grupos o roles autorizados.
- La conectividad hacia Oracle desde contenedor debe probarse en el servidor de despliegue. Las variables y rutas usadas por la aplicación quedan descritas en este documento y en la guía de despliegue.
- El modelo de datos debe mantenerse alineado con la instancia Oracle productiva, el MER y el diccionario oficial aprobados por el equipo responsable.

## Recomendaciones finales

- Mantener actualizada esta arquitectura cuando cambien rutas, tablas o variables de entorno.
- Usar `GUIA_DESPLIEGUE_AURORA.md` para despliegues y `VALIDACION_POST_DESPLIEGUE_AURORA.md` para verificación operativa.
- Validar conectividad Oracle y SSO en cada ambiente antes de entregar a usuarios funcionales.
