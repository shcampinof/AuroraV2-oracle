# Guia de despliegue - Aurora

El despliegue recomendado para Aurora es mediante Docker Compose, usando el archivo `.env` creado manualmente en el servidor.

Repositorio:

```text
https://github.com/shcampinof/AuroraV2-oracle
```

El repositorio es privado por definicion del proyecto, pero se deja publico de manera temporal para el despliegue.

## Arquitectura del contenedor

Aurora se despliega como una aplicacion web de un solo contenedor:

- `frontend/`: React + Vite. Se compila durante el build Docker.
- `backend/`: Node.js + Express. Expone la API bajo `/api`.
- El build del frontend se copia a `backend/public/app` y Express lo sirve como archivos estaticos.
- El puerto HTTP por defecto es `7860`.
- La conexion de datos se realiza contra Oracle mediante variables `ORACLE_*`. No se levanta una base de datos adicional en Docker.

Endpoints utiles de verificacion:

- `GET /api/health`
- `GET /api/health/db`

## Archivos Docker

Archivos principales:

- `Dockerfile`: construye el frontend y prepara el backend en modo produccion.
- `docker-compose.yml`: levanta el servicio `aurora`.
- `.dockerignore`: excluye dependencias, builds locales, documentacion pesada, respaldos locales y archivos `.env`.
- `.env.example`: plantilla de configuracion sin secretos.

El `Dockerfile` usa una imagen Debian slim de Node.js 20 para mayor compatibilidad con la dependencia `oracledb`.

## Preparar variables de entorno

No versionar el archivo `.env` real. Para configurar un ambiente:

```bash
cp .env.example .env
```

Luego editar `.env` con los valores del ambiente. No incluir credenciales reales en `.env.example`, documentacion, capturas o tickets.

Variables minimas para produccion:

| Variable | Uso |
|---|---|
| `HOST_PORT` | Puerto publicado en el host. Ejemplo: `7860`. |
| `PORT` | Puerto interno usado por Express. Default: `7860`. |
| `NODE_ENV` | Usar `production` en despliegue. |
| `AUTH_JWT_SECRET` | Secreto fuerte para firmar tokens JWT. Obligatorio en produccion. |
| `AUTH_LOCAL_ADMIN_ENABLED` | Mantener `false` salvo acceso local temporal controlado. |
| `AZURE_AD_TENANT_ID` | Tenant de Azure AD si se usa SSO institucional. |
| `AZURE_AD_CLIENT_ID` | Client ID de la aplicacion registrada en Azure AD. |
| `ORACLE_USER` | Usuario Oracle del ambiente. |
| `ORACLE_PASSWORD` | Password Oracle del ambiente. |
| `ORACLE_HOST` | Host o IP de Oracle accesible desde el contenedor. |
| `ORACLE_PORT` | Puerto Oracle. Default: `1521`. |
| `ORACLE_SERVICE_NAME` | Service name Oracle. |
| `ORACLE_SCHEMA` | Esquema que contiene los objetos. Si se omite, se usa `ORACLE_USER`. |
| `ORACLE_GESTION_ID_SEQUENCE` | Secuencia opcional para `ID_GESTION` si aplica. |

Variables opcionales:

| Variable | Uso |
|---|---|
| `VITE_API_BASE_URL` | Base de API usada al compilar el frontend. Para este despliegue dejar `/api`. |
| `CORS_ORIGIN` | Allowlist CORS separada por comas si se consume la API desde otro origen. |
| `ENABLE_STARTUP_WARMUP` | Precarga consultas al iniciar si se define `true`. |
| `ORACLE_POOL_MIN`, `ORACLE_POOL_MAX`, `ORACLE_POOL_INCREMENT`, `ORACLE_POOL_TIMEOUT` | Ajustes del pool Oracle. |

## Despliegue principal con Docker

Construir y levantar:

```bash
docker compose up --build -d
```

Ver estado:

```bash
docker compose ps
```

Ver logs:

```bash
docker compose logs -f aurora
```

Reiniciar:

```bash
docker compose restart aurora
```

Verificar:

```bash
curl http://localhost:7860/api/health
curl http://localhost:7860/api/health/db
```

Abrir el frontend:

```text
http://localhost:7860
```

Detener:

```bash
docker compose down
```

Reconstruir despues de cambios:

```bash
docker compose build --no-cache aurora
docker compose up -d
```

## Validacion previa al despliegue

Antes de construir la imagen, ejecutar al menos:

```bash
npm --prefix frontend run test -- estadoActuaciones.rules.test.ts evaluateAuroraRules.test.ts
npm --prefix frontend run build
npm --prefix backend test
```

Para cambios en estados o historial, verificar manualmente que:

- la columna `Accion a impulsar` en historial cambia al diligenciar el formulario activo;
- `PAG - Asignacion de casos de condenados` muestra la misma etiqueta de estado derivada que `Usuarios asignados`;
- despues de guardar, el historial persiste la actuacion correcta mediante `actuacionId`.

## Despliegue alternativo tradicional con Node.js

Este camino se conserva para desarrollo, diagnostico o ambientes donde Docker no este disponible.

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

Ejecutar backend:

```bash
NODE_ENV=production npm --prefix backend run start:prod
```

## Oracle y red

El contenedor necesita conectividad TCP hacia Oracle. Antes de desplegar, confirmar:

- El host definido en `ORACLE_HOST` resuelve desde el servidor Docker.
- El puerto `ORACLE_PORT` esta permitido por firewall o VPN.
- El `ORACLE_SERVICE_NAME` corresponde al ambiente correcto.
- El usuario tiene permisos sobre el esquema configurado en `ORACLE_SCHEMA`.

Si Oracle esta en una red privada institucional, el servidor donde corre Docker debe estar en esa red o conectado por VPN. No colocar credenciales Oracle en la imagen ni en archivos versionados.

## Seguridad operativa

- Mantener `.env` fuera de Git.
- Usar un `AUTH_JWT_SECRET` largo, aleatorio y distinto por ambiente.
- En produccion, preferir SSO Azure AD y dejar `AUTH_LOCAL_ADMIN_ENABLED=false`.
- Si se habilita el usuario local temporalmente, definir usuario y password no predeterminados.
- Revisar que `CORS_ORIGIN` solo incluya dominios necesarios cuando la API sea consumida desde otro origen.
- No copiar `backend/.env`, `backend/.env.test` ni otros archivos de secretos dentro de la imagen.

## Solucion de problemas

Si `/api/health` responde y `/api/health/db` falla, el servidor Express esta arriba pero Oracle no esta disponible o esta mal configurado. Revisar logs con:

```bash
docker compose logs -f aurora
```

Si el frontend carga pero las consultas fallan, confirmar que `VITE_API_BASE_URL=/api` al construir la imagen y que el backend responde en el mismo host.

Si el contenedor se reinicia en produccion, validar primero que `AUTH_JWT_SECRET` no este vacio y que no se hayan dejado credenciales locales predeterminadas con `AUTH_LOCAL_ADMIN_ENABLED=true`.
