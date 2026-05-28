# Despliegue Docker - Aurora

Fecha: 2026-05-28  
Alcance: guia operativa para desplegar Aurora con Docker/Compose en el servidor institucional.

## 1. Resumen

Aurora esta preparado para desplegarse como un unico servicio Docker. El `Dockerfile` realiza estas acciones:

- Construye el frontend React/Vite.
- Copia el resultado compilado a `backend/public/app`.
- Instala dependencias del backend Node.js.
- Instala Python y dependencias de `scripts/cargas_bd/requirements.txt` para el modulo de cargas.
- Expone el servicio HTTP en el puerto `7860`.
- Ejecuta el backend en modo produccion.

El backend sirve tanto la API como la aplicacion web desde el mismo puerto:

```text
Aplicacion: http://<servidor>:7860
API:        http://<servidor>:7860/api
```

## 2. Requisitos del servidor

El servidor institucional debe contar con:

- Docker instalado.
- Docker Compose disponible como `docker compose`.
- Acceso de red desde el servidor hacia Oracle.
- Puerto `7860` disponible o un puerto alterno definido en `HOST_PORT`.
- Variables de entorno reales entregadas por el equipo tecnico/DBA.
- Permisos para crear volumen Docker de cargas mensuales.

Validar instalacion:

```bash
docker --version
docker compose version
```

## 3. Preparar variables de entorno

Desde la raiz del proyecto:

```bash
cd /ruta/aurora
cp .env.example .env
```

Editar `.env` con los valores reales del ambiente. Como minimo revisar:

```env
HOST_PORT=7860
PORT=7860
NODE_ENV=production
VITE_API_BASE_URL=/api

AUTH_JWT_SECRET=<secreto-fuerte>
AUTH_LOCAL_ADMIN_ENABLED=false

AZURE_AD_TENANT_ID=<tenant-id-si-aplica>
AZURE_AD_CLIENT_ID=<client-id-si-aplica>
AZURE_AD_ALLOWED_EMAIL_DOMAINS=defensoria.gov.co

ORACLE_USER=<usuario-oracle>
ORACLE_PASSWORD=<password-oracle>
ORACLE_HOST=<host-oracle>
ORACLE_PORT=1521
ORACLE_SERVICE_NAME=<service-name>
ORACLE_SCHEMA=<schema>

AURORA_CARGAS_DIR=/app/backend/storage/cargas_bd
CARGUEBD_ADMIN_ROLES=admin,carguebd,cargas_bd
CARGUEBD_PYTHON=python3
CARGUEBD_AURORA10_ENABLED=true
```

Notas:

- No subir `.env` al repositorio.
- No documentar contrasenas ni secretos.
- En produccion, mantener `AUTH_LOCAL_ADMIN_ENABLED=false`, salvo excepcion temporal autorizada.

## 4. Evitar conflicto con prueba Node

Si previamente se levanto Aurora con Node para pruebas, detener ese proceso antes de usar Docker, porque ambos intentan usar el puerto `7860`:

```bash
pkill -f 'node index.js' || true
ss -ltnp | grep ':7860' || true
```

Si no aparece ningun proceso escuchando en `7860`, el puerto esta libre.

## 5. Construir y levantar con Docker Compose

Desde la raiz del proyecto:

```bash
docker compose up --build -d
```

Verificar contenedor:

```bash
docker compose ps
```

Ver logs:

```bash
docker compose logs -f aurora
```

Verificar que el puerto quedo publicado:

```bash
ss -ltnp | grep ':7860'
```

## 6. Validaciones de salud

Desde el servidor:

```bash
curl http://127.0.0.1:7860/api/health
curl http://127.0.0.1:7860/api/health/db
```

Resultado esperado:

```json
{"ok":true}
```

Desde un equipo cliente con acceso a la red/VPN:

```bash
curl http://<ip-o-dns-del-servidor>:7860/api/health
curl http://<ip-o-dns-del-servidor>:7860/api/health/db
```

Para el ambiente temporal revisado:

```bash
curl http://172.31.64.7:7860/api/health
curl http://172.31.64.7:7860/api/health/db
```

Si desde el servidor funciona pero desde el equipo cliente no, la aplicacion esta activa y el bloqueo esta en red/firewall/VPN/proxy/DNS.

## 7. Acceso desde navegador

URL interna del servidor:

```text
http://127.0.0.1:7860
```

URL temporal por IP privada, si la red lo permite:

```text
http://172.31.64.7:7860
```

URL institucional definitiva:

```text
https://<url-institucional-aurora>
```

La URL institucional definitiva debe ser asignada por Infraestructura mediante DNS, proxy inverso, balanceador o publicacion HTTPS.

## 8. Comandos operativos

Reiniciar:

```bash
docker compose restart aurora
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

Ver estado de salud del contenedor:

```bash
docker inspect --format='{{json .State.Health}}' $(docker compose ps -q aurora)
```

## 9. Evidencia sugerida para entrega

Registrar capturas o salidas de:

- `docker compose ps`
- `docker compose logs --tail=100 aurora`
- `curl http://127.0.0.1:7860/api/health`
- `curl http://127.0.0.1:7860/api/health/db`
- Navegador cargando Aurora.
- Navegador o `curl` desde un equipo cliente, si la red institucional permite acceso directo.

## 10. Texto sugerido para la documentacion formal

```text
El despliegue institucional recomendado para Aurora se realiza mediante Docker Compose. La imagen construye el frontend React/Vite, lo integra en el backend Express y publica un unico servicio HTTP en el puerto 7860. El archivo `.env` se configura manualmente en el servidor con variables autorizadas por la entidad y no se versiona en el repositorio.

Durante la validacion tecnica se comprobo que la aplicacion responde correctamente en `http://127.0.0.1:7860` desde el servidor. Para acceso de usuarios por red se requiere que Infraestructura habilite el puerto, proxy, DNS o URL HTTPS institucional correspondiente. Si se usa IP privada temporal, la URL sera `http://<ip-del-servidor>:7860`.
```
