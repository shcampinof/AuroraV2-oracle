# Descripción del código fuente Aurora

Fecha: 2026-05-14

## Introducción

Este documento describe la estructura del repositorio Aurora y los archivos principales identificados. Su objetivo es apoyar mantenimiento, revisión técnica y transferencia interna del proyecto.

## Estructura general del repositorio

| Ruta | Descripción |
|---|---|
| `README.md` | Resumen del proyecto, estado y validaciones previas. |
| `package.json` | Scripts generales de QA y codificación. |
| `frontend/` | Aplicación de usuario en React. |
| `backend/` | API, autenticación, repositorios Oracle y catálogo de formatos. |
| `docs/` | Documentación técnica existente. |
| `BD Documentation/` | Material recibido sobre el modelo de datos. |
| `Dockerfile` | Imagen de despliegue de un solo servicio. |
| `docker-compose.yml` | Ejecución local o productiva con Docker Compose. |
| `.env.example` | Plantilla de variables sin secretos. |
| `SET_PRUEBAS_AURORA.md` | Registro de pruebas técnicas y funcionales. |

## Frontend

El frontend está en `frontend/` y usa React con Vite. La navegación principal se gestiona en `frontend/src/App.jsx` con vistas por hash:

- `inicio`
- `formulario`
- `registros`
- `asignacion`
- `herramientas`
- `manual`

Páginas principales:

| Archivo | Uso observado |
|---|---|
| `LoginPage.jsx` | Ingreso local o institucional. |
| `Home.jsx` | Pantalla de bienvenida. |
| `FormularioAtencion.jsx` | Consulta y gestión del formulario de atención. |
| `RegistrosAsignados.jsx` | Tabla de usuarios asignados y filtros. |
| `AsignacionDefensores.jsx` | Validación PAG y asignación o reasignación de defensores. |
| `CajaHerramientas.jsx` | Consulta y descarga de formatos. |
| `ManualInteractivo.jsx` | Manual o apoyo interno en la interfaz. |

Componentes y reglas relevantes:

| Archivo | Uso observado |
|---|---|
| `components/HistorialActuacionesPPL.jsx` | Consulta historial, normaliza actuaciones y recalcula la fila activa con el registro vivo. |
| `config/estadoActuaciones.rules.ts` | Deriva estado lógico, etiqueta y clase visual de actuaciones. |
| `utils/evaluateAuroraRules.ts` | Evalúa reglas del flujo de condenados. |
| `utils/evaluateCelesteRules.ts` | Evalúa reglas del flujo de sindicados. |

Servicios frontend:

| Archivo | Uso |
|---|---|
| `frontend/src/services/api.js` | Cliente HTTP para rutas `/api`. |
| `frontend/src/services/auth.js` | Flujos de login y sesión. |
| `frontend/src/services/authStorage.js` | Persistencia local de token de sesión. |

## Backend

El backend está en `backend/` y usa Express. El archivo principal es `backend/index.js`.

Responsabilidades observadas:

- Configurar Helmet, CORS y JSON body parser.
- Exponer rutas bajo `/api`.
- Proteger rutas de negocio con `requireAuth`.
- Redirigir descargas de formatos a enlaces configurados.
- Servir el build frontend si existe `backend/public/app/index.html`.
- Cerrar el pool Oracle ante `SIGINT` o `SIGTERM`.

Rutas:

| Archivo | Rutas |
|---|---|
| `routes/auth.js` | `/api/auth/config`, `/login`, `/azure-ad`, `/me`. |
| `routes/health.js` | `/api/health/db`. |
| `routes/ppl.js` | Consulta PPL, condenados, actuaciones, asignación y actualización. |
| `routes/defensores.js` | Consulta y creación de defensores. |
| `routes/formatos.js` | Listado y descarga de formatos. |

## Acceso a datos

| Archivo | Descripción |
|---|---|
| `backend/db/oraclePool.js` | Crea y administra el pool Oracle. |
| `backend/config/oracle.js` | Lee y valida configuración Oracle. |
| `backend/db/oracleConsolidado.repo.js` | Repositorio consolidado sobre Oracle. |
| `backend/repositories/oracle/personaRepository.js` | Consultas principales de personas y resúmenes. |
| `backend/repositories/oracle/gestionRepository.js` | Gestión de actuaciones jurídicas. |
| `backend/repositories/oracle/asignacionRepository.js` | Asignaciones de defensores. |
| `backend/repositories/oracle/defensoresRepository.js` | Catálogo de defensores. |
| `backend/repositories/oracle/pagRepository.js` | Validación de PAG. |
| `backend/repositories/oracle/situacionRepository.js` | Actualización de situación carcelaria. |
| `backend/repositories/oracle/calificacionConductaRepository.js` | Calificaciones de conducta. |

## Scripts disponibles

Raíz:

| Script | Comando |
|---|---|
| `encoding:normalize` | Normaliza codificación. |
| `encoding:check` | Valida UTF-8 y mojibake. |
| `qa:smoke` | Ejecuta lint, tests, build frontend y test backend. |
| `qa:encoding` | Ejecuta revisión de codificación. |

Backend:

| Script | Uso |
|---|---|
| `start` / `start:prod` | Levanta Express. |
| `dev` | Levanta con Nodemon. |
| `test` | Prueba configuración de autenticación. |
| `smoke:oracle` | Valida conexión Oracle. |
| `test:api` | Regresión básica API de lectura. |
| `test:api:write` | Regresión preparada para escrituras controladas. |
| `test-db:setup` | Crea esquema de prueba, si no apunta a `DNDP`. |

Frontend:

| Script | Uso |
|---|---|
| `dev` | Servidor Vite. |
| `build` | Compilación de producción. |
| `lint` | Revisión ESLint. |
| `preview` | Vista previa del build. |
| `test` | Pruebas Vitest. |

## Dependencias principales

Backend:

- `express`
- `helmet`
- `cors`
- `jsonwebtoken`
- `jwks-rsa`
- `express-rate-limit`
- `oracledb`
- `dotenv`

Frontend:

- `react`
- `react-dom`
- `@azure/msal-browser`
- `vite`
- `vitest`
- `eslint`

## Convenciones observadas

- Backend CommonJS.
- Frontend con módulos ES.
- Rutas API agrupadas por dominio.
- Repositorios Oracle separados por entidad funcional.
- Variables de entorno mediante `.env` y `dotenv`.
- Protección JWT para rutas de negocio.
- Documentación técnica previa en `docs/`.

## Archivos que no deben versionarse

- `.env`
- `.env.*`
- `backend/.env`
- `backend/.env.*`
- `frontend/.env`
- `frontend/.env.*`
- `node_modules/`
- Builds locales como `frontend/dist` y `backend/public/app`.

## Recomendaciones para mantenimiento

- Mantener sincronizada la documentación de rutas cuando cambie `backend/routes/`.
- No modificar repositorios Oracle sin validar impacto en `FormularioAtencion` y `AsignacionDefensores`.
- No duplicar reglas de estado en componentes; usar `getEstadoDisplayInfo` como punto común.
- Ejecutar `npm run qa:smoke` antes de entregar cambios relevantes.
- Mantener fuera del repositorio cualquier exportación de datos sensible.
- Mantener `.env.example` actualizado cada vez que se agregue una variable de entorno.
