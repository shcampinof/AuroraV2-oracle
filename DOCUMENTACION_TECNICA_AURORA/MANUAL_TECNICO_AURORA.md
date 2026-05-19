# Manual técnico Aurora

Fecha: 2026-05-19

## Introducción

Este manual integra la información técnica básica de Aurora para apoyar instalación, despliegue, mantenimiento y validación. Fue elaborado a partir del repositorio, documentación existente y pruebas registradas.

## Objetivo del sistema

Aurora apoya la gestión de atención jurídica de personas privadas de la libertad. Desde el código se observan funciones de consulta, formulario de atención, gestión de actuaciones, asignación de defensores, validación PAG y descarga de formatos.

## Tecnologías utilizadas

| Capa | Tecnología |
|---|---|
| Frontend | React, Vite, JavaScript/TypeScript, PWA |
| Backend | Node.js, Express |
| Autenticación | JWT, Azure AD opcional |
| Base de datos | Oracle mediante `oracledb` |
| Datos complementarios | Catálogo local de formatos |
| Cargas ETL | Python (`pandas`, `openpyxl`, `oracledb`) orquestado desde backend |
| Pruebas | Vitest, scripts Node |
| Despliegue | Docker Compose como camino principal |

## Arquitectura general

```text
Usuario -> Frontend React -> Backend Express /api -> Oracle
```

En producción, el backend puede servir el frontend compilado. El despliegue Docker usa un contenedor único que compila `frontend/` y copia `dist` a `backend/public/app`.

## Estructura del proyecto

| Ruta | Uso |
|---|---|
| `frontend/` | Interfaz de usuario. |
| `backend/` | API y acceso a datos. |
| `CargueBD/` | Servicios de carga Excel hacia staging Oracle y ejecución ETL. |
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
- Rutas administrativas para carga mensual de archivos Excel a staging/ETL.
- Servicio estático de frontend compilado.
- Cierre ordenado del pool Oracle.

## Configuración del frontend

El frontend está en `frontend/` y se compila con Vite.

Variables relevantes:

- `VITE_API_BASE_URL`
- `VITE_DEV_API_TARGET`
- `VITE_DEV_PORT`

En desarrollo, Vite usa proxy para `/api`. En producción con el backend como servidor único, se recomienda `VITE_API_BASE_URL=/api`.

### Estados e historial de actuaciones

- `frontend/src/config/estadoActuaciones.rules.ts` es el punto común para derivar etiquetas de estado.
- `FormularioAtencion.jsx` sincroniza `Estado del trámite` y `Estado del caso` al guardar.
- `HistorialActuacionesPPL.jsx` recalcula la fila activa con el registro vivo del formulario, por lo que la UI puede mostrar cambios de estado antes de guardar o recargar.
- `AsignacionDefensores.jsx` usa el mismo derivador para `Acción a impulsar`.

### PWA y operacion offline

Aurora incluye manifest y service worker de produccion. El build de frontend ejecuta `frontend/scripts/inject-pwa-assets.mjs` para precachear los assets hash generados por Vite en `dist/assets`.

El service worker cachea el shell de la aplicacion y excluye las consultas `/api` para evitar datos de negocio obsoletos. Las escrituras criticas se pueden guardar en una cola IndexedDB acotada y reintentar con Background Sync o cuando el navegador emite `online`.

Escrituras cubiertas:

- `PUT /api/ppl/:documento`
- `POST /api/ppl/:documento/actuaciones`
- `POST /api/ppl/asignar-defensor`
- `POST /api/defensores`

Limites de la cola:

- Maximo 75 solicitudes pendientes.
- Maximo 256 KB por cuerpo.
- El token de autenticacion se mantiene en memoria del service worker y no se persiste en IndexedDB.

La documentacion detallada esta en `docs/15_pwa_operacion_offline.md`.

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

### Cargas mensuales staging/ETL

Aurora incorpora una vista administrativa `Cargas mensuales` para subir archivos Excel de `PONAL`, `SISIPEC` y `Aurora 1.0`, cargarlos a tablas staging y ejecutar los procedimientos ETL de Oracle.

Componentes:

- `frontend/src/pages/AdminCargasBD.jsx`: UI de carga, historial, log y reintento.
- `backend/routes/adminCargas.js`: endpoints `/api/admin/cargas`.
- `backend/services/cargaBdService.js`: almacenamiento, registro y ejecución en segundo plano.
- `CargueBD/loader_service.py`: lectura de Excel, validación, carga Oracle y llamada a procedimiento ETL.

Variables relevantes:

- `AURORA_CARGAS_DIR`
- `CARGUEBD_ADMIN_ROLES`
- `CARGUEBD_PYTHON`
- `CARGUEBD_AURORA10_ENABLED`
- `CARGUEBD_SKIP_ETL`
- `CARGUEBD_MAX_FILE_MB`

La guía detallada está en `docs/16_cargas_staging_etl_bd.md`.

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
pip install -r CargueBD/requirements.txt
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

El despliegue recomendado para Aurora es mediante Docker Compose, usando el archivo `.env` creado manualmente en el servidor.

Despliegue principal:

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
docker compose logs -f aurora
docker compose restart aurora
```

Despliegue alternativo tradicional:

```bash
npm --prefix frontend run build
NODE_ENV=production npm --prefix backend run start:prod
```

No se pudo validar en esta revisión el build Docker real porque Docker no estaba instalado en el ambiente de trabajo.

El contexto Docker excluye `.cleanup-backups/`, documentación pesada y secretos. Si se generan respaldos locales por limpiezas controladas, no deben subirse al repositorio ni copiarse a la imagen.

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
| PWA | `npm --prefix frontend run test -- pwaConfig.test.ts` |
| Reglas de estado | `npm --prefix frontend run test -- estadoActuaciones.rules.test.ts evaluateAuroraRules.test.ts` |
| Frontend build | `npm --prefix frontend run build` |
| Python cargas | `python -m py_compile CargueBD/*.py` |

Las pruebas de escritura deben ejecutarse únicamente contra un esquema temporal distinto a `DNDP`.

## Logs y solución de problemas

| Situación | Acción sugerida |
|---|---|
| Backend no inicia | Revisar `PORT`, variables obligatorias y logs. |
| Oracle no responde | Revisar red, service name y credenciales. |
| Carga mensual falla | Revisar log en `Cargas mensuales`, variables `ORACLE_*`, dependencias Python y formato del Excel. |
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
