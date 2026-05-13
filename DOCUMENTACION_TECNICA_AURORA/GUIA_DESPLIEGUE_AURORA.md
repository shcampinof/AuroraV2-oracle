# Guía de despliegue Aurora

Fecha de generación: 2026-05-12

## Introducción

Esta guía está pensada para apoyar el despliegue y mantenimiento técnico del sistema Aurora. La información parte del repositorio revisado y no incluye credenciales reales.

## Requisitos previos

- Node.js 20.
- npm 10 o compatible.
- Acceso al repositorio privado.
- Acceso de red a Oracle.
- Variables de entorno autorizadas por el administrador técnico o DBA.
- Docker y Docker Compose si se usa despliegue contenedorizado.

## Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd aurora
```

No se pudo validar en esta revisión una URL real del repositorio. Debe ser entregada por el responsable del repositorio privado.

## Configurar variables de entorno

El archivo `.env` real no debe subirse al repositorio. Para despliegue debe crearse manualmente en el servidor a partir de `.env.example`, usando los valores reales entregados por el administrador técnico o DBA autorizado.

```bash
cp .env.example .env
```

Variables críticas:

- `PORT`
- `NODE_ENV`
- `AUTH_JWT_SECRET`
- `AUTH_LOCAL_ADMIN_ENABLED`
- `AZURE_AD_TENANT_ID`
- `AZURE_AD_CLIENT_ID`
- `ORACLE_USER`
- `ORACLE_PASSWORD`
- `ORACLE_HOST`
- `ORACLE_PORT`
- `ORACLE_SERVICE_NAME`
- `ORACLE_SCHEMA`

Para ejecución tradicional del backend también puede usarse `backend/.env`, siguiendo la plantilla `backend/.env.example`.

## Instalación de dependencias

Desde la raíz:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

## Ejecución local de backend

```bash
npm --prefix backend run dev
```

Por defecto el backend usa `PORT=7860`.

Validación:

```bash
curl http://localhost:7860/api/health
curl http://localhost:7860/api/health/db
```

## Ejecución local de frontend

```bash
npm --prefix frontend run dev
```

El puerto por defecto configurado para Vite es `5174`. Si está ocupado:

```bash
VITE_DEV_PORT=5175 npm --prefix frontend run dev -- --host 127.0.0.1
```

En desarrollo, Vite proxifica `/api` y `/downloads` hacia `VITE_DEV_API_TARGET` o `http://localhost:7860`.

## Compilar frontend para producción

```bash
npm --prefix frontend run build
```

El backend puede servir el frontend si el build se ubica en `backend/public/app`. El `Dockerfile` del proyecto realiza esta copia automáticamente durante el build de imagen.

## Ejecutar backend en producción tradicional

```bash
NODE_ENV=production npm --prefix backend run start:prod
```

Antes de iniciar en producción:

- Definir `AUTH_JWT_SECRET`.
- Confirmar que `AUTH_LOCAL_ADMIN_ENABLED=false`, salvo excepción temporal documentada.
- Confirmar conectividad a Oracle.
- Confirmar que `.env` no está versionado.

## Despliegue con Docker

El repositorio cuenta con `Dockerfile` y `docker-compose.yml`. El despliegue Docker usa un solo servicio: compila el frontend y lo sirve desde el backend Express.

Preparar entorno:

```bash
cp .env.example .env
```

Construir y levantar:

```bash
docker compose up --build -d
```

Ver logs:

```bash
docker compose logs -f aurora
```

Validar:

```bash
curl http://localhost:7860/api/health
curl http://localhost:7860/api/health/db
```

Detener:

```bash
docker compose down
```

No se pudo validar en esta revisión la construcción Docker real porque Docker no estaba instalado en el ambiente local.

## Validar conexión a base de datos

El endpoint recomendado es:

```bash
curl http://localhost:7860/api/health/db
```

También existe el script:

```bash
npm --prefix backend run smoke:oracle
```

## Comandos útiles

| Acción | Comando |
|---|---|
| Prueba backend | `npm --prefix backend test` |
| Lint frontend | `npm --prefix frontend run lint` |
| Tests frontend | `npm --prefix frontend run test` |
| Build frontend | `npm --prefix frontend run build` |
| QA general | `npm run qa:smoke` |
| Smoke Oracle | `npm --prefix backend run smoke:oracle` |
| Regresión API | `npm --prefix backend run test:api` |

## Problemas comunes

| Síntoma | Revisión sugerida |
|---|---|
| `/api/health` no responde | Verificar proceso backend, puerto y logs. |
| `/api/health/db` falla | Revisar `ORACLE_*`, red, firewall, service name y permisos. |
| Login falla en producción | Revisar `AUTH_JWT_SECRET`, Azure AD o estado de login local. |
| Frontend no llama al backend | Revisar `VITE_API_BASE_URL`, proxy Vite o CORS. |
| Puerto `5174` ocupado | Usar `VITE_DEV_PORT`. |
| Advertencia de bundle Vite | No bloquea el build, pero conviene revisar code splitting. |

## Recomendaciones finales

- Ejecutar la validación post despliegue documentada en `VALIDACION_POST_DESPLIEGUE_AURORA.md`.
- Mantener los secretos fuera de Git.
- No ejecutar pruebas de escritura contra el esquema productivo.
- Documentar cada despliegue con fecha, versión, responsable técnico y resultado de pruebas.
