# Ajuste de URL y ambiente real para documentacion Aurora

Fecha: 2026-05-28
Alcance: `GUIA_DESPLIEGUE_AURORA.docx`, `INFRAESTRUCTURA_AURORA.docx`, `MANUAL_TECNICO_AURORA.docx` y `VALIDACION_POST_DESPLIEGUE_AURORA.docx`.

## 1. Situacion actual

Aurora esta configurado para escuchar en todas las interfaces de red del servidor:

```text
0.0.0.0:7860
```

Esto significa que la aplicacion no queda limitada tecnicamente a `localhost`. Si el servicio esta levantado y el puerto esta permitido por firewall/red, se puede acceder desde otro equipo mediante la IP del servidor:

```text
http://172.31.64.7:7860
```

La IP detectada en este ambiente es:

```text
172.31.64.7
```

Importante: esta IP parece ser privada/interna. Solo funcionara para equipos que tengan conectividad a esa red, VPN o segmento institucional correspondiente. Si la entidad requiere una URL institucional, Infraestructura debe crear un DNS o proxy, por ejemplo:

```text
https://aurora-preproduccion.defensoria.gov.co
```

## 2. Como levantar y validar la URL por IP

Desde el servidor donde esta el codigo:

```bash
cd /home/dndp/proyectos_dndp/aurora
docker compose up --build -d
docker compose ps
```

Validar desde el mismo servidor:

```bash
curl http://127.0.0.1:7860/api/health
curl http://172.31.64.7:7860/api/health
```

Si responde correctamente, validar desde un equipo cliente conectado a la misma red/VPN:

```bash
curl http://172.31.64.7:7860/api/health
```

URL de aplicacion para navegador:

```text
http://172.31.64.7:7860
```

URL base API:

```text
http://172.31.64.7:7860/api
```

Si desde el servidor funciona pero desde otro equipo no funciona, no es un problema del codigo de Aurora; normalmente falta apertura de firewall, regla de seguridad, VPN, NAT, proxy o DNS institucional.

## 3. Uso correcto de `localhost` en la documentacion

`localhost` solo debe aparecer como referencia de desarrollo local o diagnostico desde el propio servidor.

No debe presentarse como URL del ambiente de pruebas/preproduccion, porque para un usuario externo `localhost` significa su propio computador, no el servidor Aurora.

Texto recomendado:

> Para ejecucion local o diagnostico desde el servidor puede usarse `http://localhost:7860`. Para validacion por usuarios o por la entidad debe usarse la URL del ambiente de pruebas: `http://172.31.64.7:7860`, o la URL institucional que sea asignada por Infraestructura.

## 4. Texto para `GUIA_DESPLIEGUE_AURORA.docx`

Reemplazar la seccion de validacion que hoy usa `localhost` por:

```text
Validacion de salud de la aplicacion

La aplicacion Aurora publica el servicio HTTP en el puerto 7860. En el ambiente temporal de pruebas revisado, la direccion de acceso por IP privada es:

Aplicacion: http://172.31.64.7:7860
API base: http://172.31.64.7:7860/api

Comandos de validacion:

curl http://172.31.64.7:7860/api/health
curl http://172.31.64.7:7860/api/health/db

Si la entidad asigna una URL institucional o un balanceador/proxy HTTPS, estas validaciones deben ejecutarse contra dicha URL, por ejemplo:

curl https://<url-institucional-aurora>/api/health
curl https://<url-institucional-aurora>/api/health/db

Nota: `http://localhost:7860` se conserva unicamente para diagnostico tecnico ejecutado desde el propio servidor.
```

Agregar en datos del ambiente:

```text
Ambiente: pruebas/preproduccion temporal
Servidor de aplicaciones: 172.31.64.7
Puerto publicado: 7860
URL temporal de aplicacion: http://172.31.64.7:7860
URL base API: http://172.31.64.7:7860/api
URL institucional definitiva: pendiente de asignacion por Infraestructura
```

## 5. Texto para `INFRAESTRUCTURA_AURORA.docx`

Agregar o reemplazar la seccion "Ambiente identificado" por:

```text
Ambiente de pruebas/preproduccion temporal

Durante la revision se identifico un ambiente tecnico accesible por IP privada del servidor. La aplicacion Aurora se configura para escuchar en 0.0.0.0:7860, lo que permite exponerla por la IP del servidor siempre que la red/firewall institucional permita el acceso.

Servidor de aplicaciones: 172.31.64.7
Puerto de aplicacion: 7860
URL temporal de aplicacion: http://172.31.64.7:7860
URL base API: http://172.31.64.7:7860/api
URL institucional definitiva: pendiente de asignacion por Infraestructura

El uso de localhost queda restringido a pruebas ejecutadas dentro del propio servidor. Para usuarios finales, revisores funcionales o validadores institucionales debe usarse la URL temporal por IP privada o la URL institucional que sea asignada.
```

Agregar una tabla de control:

| Elemento | Valor documentado | Estado |
|---|---|---|
| Servidor de aplicaciones | `172.31.64.7` | Identificado en ambiente actual |
| Puerto aplicacion | `7860` | Configurado en Docker Compose |
| URL temporal | `http://172.31.64.7:7860` | Pendiente validar desde red de usuarios |
| URL institucional | Pendiente por Infraestructura | Pendiente |
| Servidor de base de datos | Por confirmar con DBA/entidad | Pendiente |

## 6. Texto para `MANUAL_TECNICO_AURORA.docx`

En validaciones posteriores al despliegue, reemplazar los comandos con `localhost` por:

```text
Validar salud del servicio desde la URL del ambiente:

curl http://172.31.64.7:7860/api/health
curl http://172.31.64.7:7860/api/health/db

Si existe URL institucional:

curl https://<url-institucional-aurora>/api/health
curl https://<url-institucional-aurora>/api/health/db

El uso de `localhost` aplica solamente para diagnostico desde el servidor, no como URL de acceso para usuarios.
```

## 7. Texto para `VALIDACION_POST_DESPLIEGUE_AURORA.docx`

Agregar al bloque "Datos del despliegue":

```text
URL temporal de aplicacion: http://172.31.64.7:7860
URL base API: http://172.31.64.7:7860/api
URL institucional definitiva: pendiente de asignacion por Infraestructura
Equipo/red desde donde se valida: ______________________
```

Reemplazar los comandos de salud por:

```text
curl http://172.31.64.7:7860/api/health
curl http://172.31.64.7:7860/api/health/db
```

Agregar estos checks:

```text
☐ La URL temporal `http://172.31.64.7:7860` carga desde el servidor.
☐ La URL temporal `http://172.31.64.7:7860` carga desde un equipo de usuario conectado a la red/VPN autorizada.
☐ Si la entidad asigno URL institucional, la aplicacion carga por HTTPS.
☐ `localhost` no se usa como evidencia de acceso de usuario final; solo como evidencia tecnica local del servidor.
```

## 8. Nota para Sofía o la entidad

Texto sugerido para responder la observacion:

```text
Se ajustara la documentacion para diferenciar el uso tecnico de `localhost` frente a la URL del ambiente de pruebas. Actualmente Aurora esta configurado para escuchar en todas las interfaces del servidor y puede exponerse por la IP privada `http://172.31.64.7:7860`, siempre que la red/firewall institucional permita el acceso. La asignacion de una URL institucional con DNS y HTTPS queda pendiente de definicion por el equipo de Infraestructura de la entidad.
```
