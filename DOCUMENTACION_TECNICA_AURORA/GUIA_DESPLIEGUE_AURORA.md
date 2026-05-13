# Guía de despliegue Aurora

Fecha: 2026-05-13

## Introducción

Esta guía describe el despliegue operativo de Aurora. El despliegue recomendado para Aurora es mediante Docker Compose, usando el archivo `.env` creado manualmente en el servidor.

El repositorio oficial es:

```text
https://github.com/shcampinof/AuroraV2-oracle
```

El repositorio debe tratarse como privado. Se mantiene público de manera temporal para facilitar el despliegue.

## Requisitos previos

- Docker.
- Docker Compose.
- Acceso al repositorio.
- Acceso de red desde el servidor hacia Oracle.
- Variables de entorno autorizadas por el administrador técnico o DBA.

## Clonar el repositorio

```bash
git clone https://github.com/shcampinof/AuroraV2-oracle
cd AuroraV2-oracle
```

## Configurar variables de entorno

El archivo `.env` real no debe subirse al repositorio. Debe crearse manualmente en el servidor a partir de `.env.example`, usando valores reales del ambiente.

```bash
cp .env.example .env
```

Variables críticas:

- `HOST_PORT`
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

## Despliegue principal con Docker

Construir y levantar el servicio:

```bash
docker compose up --build -d
```

Verificar estado del contenedor:

```bash
docker compose ps
```

Revisar logs:

```bash
docker compose logs -f aurora
```

Reiniciar el servicio:

```bash
docker compose restart aurora
```

Validar salud de la aplicación:

```bash
curl http://localhost:7860/api/health
curl http://localhost:7860/api/health/db
```

Abrir la aplicación:

```text
http://localhost:7860
```

Detener el servicio:

```bash
docker compose down
```

Reconstruir después de cambios:

```bash
docker compose build --no-cache aurora
docker compose up -d
```

## Despliegue alternativo tradicional con Node.js

Este camino se conserva solo para desarrollo, diagnóstico o ambientes donde Docker no esté disponible.

Instalar dependencias:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

Compilar frontend:

```bash
npm --prefix frontend run build
```

Iniciar backend:

```bash
NODE_ENV=production npm --prefix backend run start:prod
```

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
| Estado Docker | `docker compose ps` |
| Logs Docker | `docker compose logs -f aurora` |
| Reiniciar Docker | `docker compose restart aurora` |
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
| `/api/health` no responde | Verificar `docker compose ps`, puerto publicado y logs. |
| `/api/health/db` falla | Revisar `ORACLE_*`, red, firewall, service name y permisos. |
| Login falla en producción | Revisar `AUTH_JWT_SECRET`, Azure AD o estado de login local. |
| Frontend no llama al backend | Revisar que el build use `/api` y que el contenedor esté sirviendo el mismo origen. |

## Recomendaciones finales

- Ejecutar la validación post despliegue documentada en `VALIDACION_POST_DESPLIEGUE_AURORA.md`.
- Mantener los secretos fuera de Git.
- No ejecutar pruebas de escritura contra el esquema productivo.
- Documentar cada despliegue con fecha, versión, responsable técnico y resultado de pruebas.
