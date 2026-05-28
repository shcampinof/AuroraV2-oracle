# Prueba de URL activa - Aurora

Fecha de prueba: 2026-05-28  
Servidor/IP detectada: `172.31.64.7`  
Puerto: `7860`  
URL temporal de aplicacion: `http://172.31.64.7:7860`

## Resultado de prueba en el servidor

Para esta prueba puntual, como el servidor revisado no tenia Docker instalado, el backend se levanto temporalmente con Node.js en segundo plano. El despliegue institucional recomendado sigue siendo Docker Compose, documentado en `documentacion/DESPLIEGUE_DOCKER_AURORA.md`.

El backend quedo escuchando en todas las interfaces:

```text
0.0.0.0:7860
```

Validaciones ejecutadas:

```bash
curl http://172.31.64.7:7860/api/health
```

Resultado:

```json
{"ok":true,"message":"Backend AURORA operativo (modo ORACLE v2 híbrido)"}
```

```bash
curl http://172.31.64.7:7860/api/health/db
```

Resultado:

```json
{"ok":true,"db":{"DB_OK":1}}
```

Tambien se valido que `http://172.31.64.7:7860/` entrega el HTML del frontend.

## Como probar desde navegador

Abrir:

```text
http://172.31.64.7:7860
```

Debe cargar la pantalla de Aurora.

Si no carga desde el computador del usuario, pero si carga desde el servidor, la aplicacion esta activa y el bloqueo esta en conectividad de red: firewall, VPN, reglas de seguridad, NAT o ausencia de ruta hacia la IP privada `172.31.64.7`.

## Como probar desde terminal

Desde otro equipo conectado a la misma red o VPN:

```bash
curl http://172.31.64.7:7860/api/health
curl http://172.31.64.7:7860/api/health/db
```

Los dos comandos deben responder con `ok: true`.

## Si se esta accediendo por SSH

Si el equipo local no tiene ruta directa a `172.31.64.7`, se puede probar con tunel SSH:

```bash
ssh -L 7860:127.0.0.1:7860 usuario@servidor
```

Mientras esa conexion SSH este abierta, en el navegador del computador local abrir:

```text
http://localhost:7860
```

En este caso `localhost` corresponde al tunel en el computador local, que redirige al puerto `7860` del servidor.

## Comandos utiles en el servidor

Ver si Aurora esta escuchando:

```bash
ss -ltnp | grep ':7860'
```

Ver log del proceso levantado para esta prueba:

```bash
tail -f /tmp/aurora-backend.log
```

Detener el proceso de prueba:

```bash
pkill -f 'node index.js'
```

Volver a levantarlo en segundo plano:

```bash
cd /home/dndp/proyectos_dndp/aurora
nohup npm --prefix backend start > /tmp/aurora-backend.log 2>&1 &
```

## Despliegue oficial con Docker

Para la entrega institucional no se recomienda dejar el proceso Node manual como mecanismo definitivo. En el servidor de preproduccion o produccion, la entidad debe desplegar con:

```bash
cd /ruta/aurora
cp .env.example .env
# editar .env con valores reales
docker compose up --build -d
docker compose ps
curl http://127.0.0.1:7860/api/health
curl http://127.0.0.1:7860/api/health/db
```

Antes de levantar Docker, detener cualquier prueba Node en el puerto `7860`:

```bash
pkill -f 'node index.js' || true
```
