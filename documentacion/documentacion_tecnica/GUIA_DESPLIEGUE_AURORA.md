# Guía de despliegue Aurora

Fecha: 2026-05-19

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
- Python 3 y dependencias de `scripts/cargas_bd/requirements.txt` si se usará el módulo de cargas mensuales.

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
- `AURORA_CARGAS_DIR`
- `CARGUEBD_PYTHON`
- `CARGUEBD_ADMIN_ROLES`
- `CARGUEBD_AURORA10_ENABLED`

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

## Validación previa al despliegue

Antes de construir la imagen, ejecutar:

```bash
npm --prefix frontend run test -- estadoActuaciones.rules.test.ts evaluateAuroraRules.test.ts
npm --prefix frontend run build
npm --prefix backend test
python -m py_compile scripts/cargas_bd/*.py
```

Para cambios en formularios o actuaciones, validar manualmente que el historial actualiza la `Acción a impulsar` de la actuación activa sin recargar y que la vista de asignación usa la misma etiqueta derivada.

Para cambios en cargas mensuales, validar que `/api/admin/cargas/fuentes` responde con un usuario autorizado, que el rol no autorizado recibe `403` y que el ambiente tiene instaladas las dependencias Python.

Si el despliegue corresponde al paso de desarrollo a producción, reemplazar explícitamente las variables `ORACLE_*` y `ORACLE_SCHEMA` para apuntar al nuevo servidor de base de datos productivo. No habilitar cargas mensuales reales mientras el contenedor o servicio siga conectado a `DNDPDEV` o a otro ambiente de desarrollo.

## Despliegue alternativo tradicional con Node.js

Este camino se conserva solo para desarrollo, diagnóstico o ambientes donde Docker no esté disponible.

Instalar dependencias:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
pip install -r scripts/cargas_bd/requirements.txt
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
| Compilación Python cargas | `python -m py_compile scripts/cargas_bd/*.py` |

## Problemas comunes

| Síntoma | Revisión sugerida |
|---|---|
| `/api/health` no responde | Verificar `docker compose ps`, puerto publicado y logs. |
| `/api/health/db` falla | Revisar `ORACLE_*`, red, firewall, service name y permisos. |
| Login falla en producción | Revisar `AUTH_JWT_SECRET`, Azure AD o estado de login local. |
| Frontend no llama al backend | Revisar que el build use `/api` y que el contenedor esté sirviendo el mismo origen. |
| Estado visible no coincide con campos diligenciados | Confirmar que la pantalla esté usando `getEstadoDisplayInfo` y que la actuación activa tenga `actuacionId`. |
| Carga mensual no inicia | Revisar `CARGUEBD_PYTHON`, dependencias Python, permisos de `AURORA_CARGAS_DIR` y roles de usuario. |
| Carga mensual falla al conectar Oracle | Revisar `ORACLE_*`, conectividad desde el host/contenedor y service name. |
| Carga SISIPEC falla con `PLS-00201` o estado `INVALID` | Confirmar que `PRC_CARGA_SISIPEC` existe en el esquema destino, está `VALID` y el usuario configurado tiene permiso `EXECUTE` o sinónimo válido. Si el ambiente usa `PRC_CARGA_SISIPEC_V3`, configurar `CARGUEBD_SISIPEC_PROCEDURE`. |

## Recomendaciones finales

- Ejecutar la validación post despliegue documentada en `VALIDACION_POST_DESPLIEGUE_AURORA.md`.
- Mantener los secretos fuera de Git.
- No ejecutar pruebas de escritura contra el esquema productivo.
- Documentar cada despliegue con fecha, versión, responsable técnico y resultado de pruebas.
