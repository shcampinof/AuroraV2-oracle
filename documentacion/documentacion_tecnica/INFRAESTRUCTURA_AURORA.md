# Infraestructura Aurora

Fecha: 2026-05-19

## Introducción

Este documento describe la infraestructura técnica de Aurora. No incluye información contractual ni credenciales. Los valores sensibles deben ser administrados por el equipo técnico responsable del ambiente.

## Ambiente de referencia

Ambiente local usado como referencia técnica:

| Elemento | Valor |
|---|---|
| Sistema operativo | Linux localhost.localdomain 5.15.0-314.193.5.5.el9uek.x86_64 |
| Node.js | v20.19.6 |
| npm | 10.8.2 |
| Carpeta del proyecto | `/home/dndp/proyectos_dndp/aurora` |

El sistema operativo y la topología del servidor productivo deben documentarse por ambiente.

## Carpetas principales

| Carpeta / archivo | Uso |
|---|---|
| `frontend/` | Aplicación React + Vite. |
| `backend/` | API Express y acceso a datos. |
| `backend/routes/` | Rutas HTTP de autenticación, salud y negocio. |
| `backend/repositories/oracle/` | Consultas y escrituras Oracle. |
| `backend/db/` | Pool Oracle y repositorios de datos. |
| `backend/data/` | Catálogo local de formatos. |
| `backend/storage/` | Almacenamiento local ignorado por Git para cargas, logs y registro operativo. |
| `scripts/cargas_bd/` | Servicios Python de carga Excel a staging Oracle y ETL. |
| `documentacion/soporte/` | Documentación técnica previa del proyecto. |
| `documentacion/documentacion_tecnica/base_datos/` | Documentación técnica del modelo de base de datos. |
| `documentacion/documentacion_tecnica/` | Documentación técnica formal del proyecto. |
| `Dockerfile` | Build de frontend y backend en una imagen. |
| `docker-compose.yml` | Servicio Docker Compose `aurora`. |
| `.dockerignore` | Exclusión de dependencias, secretos, documentación pesada, builds y respaldos locales. |

## Puertos utilizados

| Puerto | Componente | Observación |
|---|---|---|
| `7860` | Backend Express | Puerto por defecto mediante `PORT`. |
| `5174` | Vite dev server | Puerto por defecto en `frontend/vite.config.js`. |
| `5175` | Vite alterno | Usado en pruebas cuando `5174` estaba ocupado. |
| `1521` | Oracle | Valor por defecto de `ORACLE_PORT`. |

## Dependencias necesarias

Para ejecución tradicional:

- Node.js 20.
- npm.
- Python 3 con dependencias de `scripts/cargas_bd/requirements.txt` para cargas staging/ETL.
- Acceso de red a Oracle si se usan datos reales.
- Variables de entorno completas para backend.

Para despliegue recomendado:

- Docker.
- Docker Compose.
- Acceso desde el host Docker hacia Oracle.

La imagen no incluye `node_modules` locales, `.env*`, `frontend/dist`, `backend/public/app`, `documentacion/soporte/`, `documentacion/documentacion_tecnica/base_datos/` ni `.cleanup-backups/`.

## Variables de entorno

Variables de configuración:

| Variable | Uso |
|---|---|
| `PORT` | Puerto del backend. |
| `NODE_ENV` | Modo de ejecución. En producción debe ser `production`. |
| `ENABLE_STARTUP_WARMUP` | Precarga opcional de datos al iniciar. |
| `CORS_ORIGIN` | Lista de orígenes permitidos. |
| `AUTH_JWT_SECRET` | Secreto de firma JWT. Obligatorio en producción. |
| `AUTH_LOCAL_ADMIN_ENABLED` | Habilita o deshabilita login local. |
| `AUTH_LOCAL_ADMIN_USERNAME` | Usuario local si se habilita. |
| `AUTH_LOCAL_ADMIN_PASSWORD` | Password local si se habilita. |
| `AUTH_TOKEN_TTL` | Duración de token. |
| `AUTH_REMEMBER_TOKEN_TTL` | Duración de token recordado. |
| `AUTH_TOKEN_ISSUER` | Emisor JWT. |
| `AUTH_TOKEN_AUDIENCE` | Audiencia JWT. |
| `AZURE_AD_TENANT_ID` | Tenant Azure AD. |
| `AZURE_AD_CLIENT_ID` | Client ID de Azure AD. |
| `AZURE_AD_ALLOWED_EMAIL_DOMAINS` | Dominios permitidos. |
| `AZURE_AD_REQUIRED_GROUP_IDS` | Grupos requeridos. |
| `AZURE_AD_REQUIRED_APP_ROLES` | Roles requeridos. |
| `ORACLE_USER` | Usuario Oracle. |
| `ORACLE_PASSWORD` | Password Oracle. |
| `ORACLE_HOST` | Host Oracle. |
| `ORACLE_PORT` | Puerto Oracle. |
| `ORACLE_SERVICE_NAME` | Service name Oracle. |
| `ORACLE_SCHEMA` | Esquema Oracle. |
| `ORACLE_GESTION_ID_SEQUENCE` | Secuencia opcional para gestión jurídica. |
| `ORACLE_POOL_MIN` | Mínimo del pool. |
| `ORACLE_POOL_MAX` | Máximo del pool. |
| `ORACLE_POOL_INCREMENT` | Incremento del pool. |
| `ORACLE_POOL_TIMEOUT` | Timeout del pool. |
| `AURORA_CARGAS_DIR` | Ruta persistente para archivos, logs y registro de cargas staging/ETL. |
| `AURORA_CARGAS_TMP_DIR` | Ruta temporal opcional para uploads. |
| `CARGUEBD_ADMIN_ROLES` | Roles autorizados para el módulo de cargas. |
| `CARGUEBD_PYTHON` | Ejecutable Python usado por el backend. |
| `CARGUEBD_SCRIPT_PATH` | Ruta opcional al servicio Python de carga. |
| `CARGUEBD_MAX_FILE_MB` | Tamaño máximo del Excel subido. |
| `CARGUEBD_BATCH_SIZE` | Tamaño de lote para inserción Oracle desde Python. |
| `CARGUEBD_AURORA10_ENABLED` | Habilita o deshabilita la fuente Aurora 1.0. |
| `CARGUEBD_SISIPEC_PROCEDURE` | Sobrescribe el procedimiento ETL de SISIPEC si el ambiente usa un nombre distinto. |
| `CARGUEBD_SKIP_ETL` | Omite procedimientos ETL; solo para diagnóstico controlado. |
| `VITE_API_BASE_URL` | Base de API para build frontend. |
| `VITE_DEV_API_TARGET` | Backend usado por proxy Vite. |
| `VITE_DEV_PORT` | Puerto de Vite en desarrollo. |
| `API_BASE_URL` | Base usada por scripts de regresión API. |
| `API_AUTH_TOKEN` | Token opcional para scripts API. |

El ambiente actual de desarrollo usa las variables `ORACLE_*` para conectarse a `DNDPDEV`. En producción, esas variables deben cambiarse al nuevo servidor de base de datos y al esquema productivo antes de habilitar el módulo de cargas mensuales. El código no requiere cambios para ese acople: la conexión se define por configuración.

## Consideraciones de red

- El backend debe poder resolver y alcanzar `ORACLE_HOST:ORACLE_PORT`.
- Si se despliega con Docker, la conectividad se debe validar desde el host o contenedor.
- Si el frontend se sirve desde el backend, las llamadas deben usar `/api` en el mismo origen.
- Si se separan frontend y backend en dominios distintos, se debe configurar `CORS_ORIGIN`.

## Desarrollo y producción

En desarrollo se puede ejecutar backend y frontend por separado:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

En producción se recomienda desplegar con Docker Compose. La ejecución tradicional queda como alternativa para diagnóstico o ambientes donde Docker no esté disponible.

- Definir `NODE_ENV=production`.
- Definir `AUTH_JWT_SECRET` fuerte.
- Mantener `AUTH_LOCAL_ADMIN_ENABLED=false`, salvo necesidad temporal controlada.

## Observaciones sobre fuentes de datos

Oracle es la fuente de datos de negocio mediante `backend/db/oraclePool.js` y `backend/repositories/oracle/`. El repositorio no debe depender de archivos locales para información de PPL, PAG o defensores.

El módulo de cargas mensuales guarda temporalmente archivos Excel operativos y logs en `AURORA_CARGAS_DIR`. Esa ruta no reemplaza Oracle: solo conserva evidencia operativa del upload y de la ejecución Python. Debe ser persistente, estar fuera de Git y tener permisos restringidos.

## Recomendaciones finales

- Documentar por ambiente los valores requeridos de Oracle sin incluir contraseñas en el repositorio.
- Validar conectividad Oracle antes de liberar el sistema.
- Mantener `.env` y `.env.*` fuera de control de versiones.
- Revisar periódicamente el tamaño del bundle frontend y las dependencias.
- Mantener respaldos operativos locales fuera de Git y Docker.
- Instalar dependencias Python de `scripts/cargas_bd/requirements.txt` en el ambiente que ejecute cargas.
