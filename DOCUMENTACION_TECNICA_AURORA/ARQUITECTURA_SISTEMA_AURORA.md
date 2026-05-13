# Arquitectura del sistema Aurora

Fecha de generación: 2026-05-12

## Introducción

Este documento resume la arquitectura técnica identificada durante la revisión del repositorio Aurora. La información se tomó del código fuente, `README.md`, archivos `package.json`, rutas del backend, configuración de Vite, archivos de entorno de ejemplo y `SET_PRUEBAS_AURORA.md`.

## Objetivo técnico del sistema

Aurora es una aplicación web para apoyar la gestión de atención jurídica de personas privadas de la libertad. El sistema permite consultar registros, revisar información jurídica, gestionar formularios de atención, consultar o registrar actuaciones y apoyar la asignación de defensores.

## Descripción general de la arquitectura

El proyecto cuenta con una arquitectura web separada en frontend y backend:

- Frontend: aplicación React construida con Vite.
- Backend: API Node.js con Express.
- Base de datos: conexión Oracle mediante el paquete `oracledb`.
- Datos complementarios: archivos CSV y mock de formatos dentro de `backend/data/`.
- Autenticación: JWT local y soporte para Azure AD si se configura.

En producción, el backend puede servir el frontend compilado desde `backend/public/app`. El `Dockerfile` existente usa ese patrón: compila el frontend y copia el resultado al backend.

## Componentes principales

| Componente | Ubicación | Descripción |
|---|---|---|
| Frontend | `frontend/` | SPA React con navegación por hash y páginas funcionales. |
| Backend | `backend/` | API Express, autenticación, rutas de negocio y repositorios. |
| Oracle | `backend/db/oraclePool.js`, `backend/repositories/oracle/` | Fuente principal para consultas y escrituras de negocio. |
| CSV | `backend/data/` | Archivos de datos usados por repositorios históricos o de respaldo. |
| Formatos | `backend/data/formatos.mock.js` | Catálogo de documentos descargables desde la Caja de Herramientas. |
| Docker | `Dockerfile`, `docker-compose.yml` | Empaquetado de la aplicación en un servicio único. |

## Tecnologías utilizadas

| Capa | Tecnologías observadas |
|---|---|
| Frontend | React 19, Vite 7, Vitest, ESLint |
| Backend | Node.js 20, Express 5, CommonJS |
| Seguridad | Helmet, CORS, JWT, rate limit de login |
| Autenticación institucional | Azure AD mediante `@azure/msal-browser` y `jwks-rsa` |
| Datos | Oracle, `oracledb`, CSV con `csv-parse` |
| Despliegue | Docker, Docker Compose opcional |

## Flujo general de comunicación

```text
Usuario
  -> Frontend React/Vite
  -> Servicios frontend en frontend/src/services/
  -> Backend Express bajo /api
  -> Repositorios Oracle o datos locales
  -> Oracle / CSV / formatos
```

Diagrama simple:

```text
Usuario -> Frontend -> Backend/API -> Oracle o fuente de datos
```

## Rutas API principales detectadas

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
| GET | `/api/ppl/pag/:cedula/validar` | Validación de PAG | Requiere token |
| POST | `/api/ppl/asignar-defensor` | Asignación de defensor | Requiere token |
| GET | `/api/ppl/:documento` | Consulta por documento | Requiere token |
| PUT | `/api/ppl/:documento` | Actualización de registro | Requiere token |
| GET | `/api/ppl/:documento/actuaciones` | Historial de actuaciones | Requiere token |
| POST | `/api/ppl/:documento/actuaciones` | Creación de actuación | Requiere token |
| GET | `/api/defensores` | Catálogo de defensores | Requiere token |
| POST | `/api/defensores` | Crear defensor | Requiere token |
| GET | `/api/formatos` | Listado de formatos | Requiere token |
| GET | `/api/formatos/:id/download` | Redirección de descarga | Requiere token |

## Consideraciones de integración

- El frontend usa `VITE_API_BASE_URL`; para despliegue en el mismo origen se recomienda `/api`.
- En desarrollo, Vite proxifica `/api` y `/downloads` hacia el backend.
- El backend usa `ORACLE_SCHEMA` para calificar objetos Oracle; si no se define, usa `ORACLE_USER`.
- Azure AD solo queda habilitado si existen `AZURE_AD_TENANT_ID` y `AZURE_AD_CLIENT_ID`.
- Las rutas de negocio están protegidas por JWT mediante `requireAuth`.

## Limitaciones o puntos no validados

- No se pudo validar en esta revisión la infraestructura real donde se despliega la aplicación.
- No se pudo validar en esta revisión la configuración productiva de Azure AD, porque depende de credenciales y registros externos.
- No se pudo validar en esta revisión la disponibilidad de Oracle desde un contenedor Docker, porque Docker no estaba instalado en el ambiente usado.
- No se pudo validar en esta revisión el MER completo más allá de los objetos detectados en código y documentación incluida.

## Recomendaciones finales

- Mantener actualizada esta arquitectura cuando cambien rutas, tablas o variables de entorno.
- Usar `GUIA_DESPLIEGUE_AURORA.md` para despliegues y `VALIDACION_POST_DESPLIEGUE_AURORA.md` para verificación operativa.
- Validar conectividad Oracle y SSO en cada ambiente antes de entregar a usuarios funcionales.
