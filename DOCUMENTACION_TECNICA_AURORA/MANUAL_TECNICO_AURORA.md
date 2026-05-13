# Manual técnico Aurora

Fecha de generación: 2026-05-12

## Introducción

Este manual integra la información técnica básica de Aurora para apoyar instalación, despliegue, mantenimiento y validación. Fue elaborado a partir del repositorio, documentación existente y pruebas registradas.

## Objetivo del sistema

Aurora apoya la gestión de atención jurídica de personas privadas de la libertad. Desde el código se observan funciones de consulta, formulario de atención, gestión de actuaciones, asignación de defensores, validación PAG y descarga de formatos.

## Tecnologías utilizadas

| Capa | Tecnología |
|---|---|
| Frontend | React, Vite, JavaScript/TypeScript |
| Backend | Node.js, Express |
| Autenticación | JWT, Azure AD opcional |
| Base de datos | Oracle mediante `oracledb` |
| Datos complementarios | CSV y mock de formatos |
| Pruebas | Vitest, scripts Node |
| Despliegue | Docker y ejecución tradicional Node |

## Arquitectura general

```text
Usuario -> Frontend React -> Backend Express /api -> Oracle / CSV / formatos
```

En producción, el backend puede servir el frontend compilado. El despliegue Docker usa un contenedor único que compila `frontend/` y copia `dist` a `backend/public/app`.

## Estructura del proyecto

| Ruta | Uso |
|---|---|
| `frontend/` | Interfaz de usuario. |
| `backend/` | API y acceso a datos. |
| `docs/` | Documentos técnicos previos. |
| `BD Documentation/` | Documentos del modelo de datos. |
| `DOCUMENTACION_TECNICA_AURORA/` | Documentación técnica generada. |
| `SET_PRUEBAS_AURORA.md` | Evidencia de revisión y pruebas. |

## Configuración del backend

El backend se inicia desde `backend/index.js`. Carga variables con `dotenv`, usando `DOTENV_CONFIG_PATH` si se define o `backend/.env` por defecto.

Funciones principales:

- Configuración de Helmet.
- Configuración de CORS.
- Límite JSON de `256kb`.
- Rutas públicas de salud y autenticación.
- Rutas protegidas de negocio.
- Servicio estático de frontend compilado.
- Cierre ordenado del pool Oracle.

## Configuración del frontend

El frontend está en `frontend/` y se compila con Vite.

Variables relevantes:

- `VITE_API_BASE_URL`
- `VITE_DEV_API_TARGET`
- `VITE_DEV_PORT`

En desarrollo, Vite usa proxy para `/api` y `/downloads`. En producción con el backend como servidor único, se recomienda `VITE_API_BASE_URL=/api`.

## Configuración de base de datos

La conexión Oracle se configura en `backend/config/oracle.js` y `backend/db/oraclePool.js`.

Variables requeridas:

- `ORACLE_USER`
- `ORACLE_PASSWORD`
- `ORACLE_HOST`
- `ORACLE_PORT`
- `ORACLE_SERVICE_NAME`
- `ORACLE_SCHEMA`

El backend reemplaza referencias `DNDP.` por el esquema configurado en `ORACLE_SCHEMA`. Si no se define, usa `ORACLE_USER`.

## Variables de entorno

Mantener las variables reales fuera del repositorio. Usar `.env.example` o `backend/.env.example` como plantilla.

No incluir en documentación:

- Contraseñas.
- Tokens.
- Cadenas completas de conexión.
- Hosts sensibles si la política interna lo restringe.

## Ejecución local

Instalar dependencias:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

Backend:

```bash
npm --prefix backend run dev
```

Frontend:

```bash
npm --prefix frontend run dev
```

## Despliegue

Opción tradicional:

```bash
npm --prefix frontend run build
NODE_ENV=production npm --prefix backend run start:prod
```

Opción Docker:

```bash
cp .env.example .env
docker compose up --build -d
```

No se pudo validar en esta revisión el build Docker real porque Docker no estaba instalado en el ambiente de trabajo.

## Validaciones posteriores al despliegue

Validar:

```bash
curl http://localhost:7860/api/health
curl http://localhost:7860/api/health/db
```

También se debe validar:

- Login.
- Consulta de registros.
- Filtros.
- Formulario de atención.
- Descarga de formatos.
- Logs sin errores críticos.

## Pruebas disponibles

| Alcance | Comando |
|---|---|
| QA general | `npm run qa:smoke` |
| Backend | `npm --prefix backend test` |
| Oracle smoke | `npm --prefix backend run smoke:oracle` |
| API lectura | `npm --prefix backend run test:api` |
| API escritura controlada | `npm --prefix backend run test:api:write` |
| Frontend lint | `npm --prefix frontend run lint` |
| Frontend tests | `npm --prefix frontend run test` |
| Frontend build | `npm --prefix frontend run build` |

Las pruebas de escritura deben ejecutarse únicamente contra un esquema temporal distinto a `DNDP`.

## Logs y solución de problemas

| Situación | Acción sugerida |
|---|---|
| Backend no inicia | Revisar `PORT`, variables obligatorias y logs. |
| Oracle no responde | Revisar red, service name y credenciales. |
| Login local falla | Revisar estado de `AUTH_LOCAL_ADMIN_ENABLED`. |
| Azure AD falla | Revisar tenant, client ID, grupos y roles. |
| Frontend muestra errores de API | Revisar `VITE_API_BASE_URL`, CORS y backend. |

## Mantenimiento básico

- Mantener dependencias actualizadas con revisión previa.
- Ejecutar pruebas antes de desplegar.
- Actualizar documentación cuando cambien rutas o variables.
- Revisar periódicamente datos sensibles versionados.
- Mantener respaldos de base de datos gestionados por DBA.

## Recomendaciones técnicas

- Usar Docker para despliegues repetibles.
- Evitar escrituras de prueba sobre producción.
- Configurar Azure AD para acceso institucional.
- Registrar evidencias de cada despliegue.
- Mantener `SET_PRUEBAS_AURORA.md` como bitácora de validación.
