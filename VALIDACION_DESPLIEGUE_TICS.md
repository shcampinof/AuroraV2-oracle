# Validacion de Despliegue AURORA - TICS e Infraestructura

Fecha de actualización: 2026-07-24

Este documento resume lo que se debe validar antes, durante y despues del despliegue de AURORA en ambiente productivo o de pruebas institucionales.

## 1. Arquitectura Esperada

AURORA corre como una aplicacion Node.js/Express que sirve:

- Frontend compilado React/Vite.
- API backend bajo `/api`.
- Autenticacion institucional por Microsoft Entra ID/Azure AD.
- Login alterno LDAP por bind directo, si se habilita.
- Conexion a Oracle.
- Manual Interactivo con tres videos incluidos en la imagen.

El backend escucha internamente en:

```text
PORT=7860
```

La publicacion externa recomendada es:

```text
https://aurora.defensoria.gov.co:443 -> AURORA interno :7860
```

`PORT=7860` no significa que usuarios deban entrar por `:7860` en produccion. Es el puerto interno del proceso.

## 2. Validaciones de Red y DNS

Desde un equipo en la red institucional:

```bash
nslookup aurora.defensoria.gov.co
nslookup auroratest.defensoria.gov.co
```

Validar que cada dominio apunte al servidor correcto.

Desde el servidor donde corre AURORA:

```bash
curl -k https://127.0.0.1:7860/api/health
curl -k https://127.0.0.1:7860/api/auth/config
curl -k https://127.0.0.1:7860/api/health/db
```

Desde un cliente de red/VPN:

```bash
curl -k https://aurora.defensoria.gov.co/api/health
curl -k https://aurora.defensoria.gov.co/api/auth/config
```

Interpretacion:

- Si `127.0.0.1:7860` funciona y el dominio no funciona, el problema es DNS, firewall, proxy, balanceador o publicacion `443 -> 7860`.
- Si `127.0.0.1:7860` tampoco funciona, el backend no esta corriendo o fallo al arrancar.
- Si `/api/health` funciona pero `/api/auth/config` no, revisar backend/rutas/autenticacion.
- Si `/api/auth/config` no devuelve JSON, Microsoft nunca abrira porque el frontend no puede leer `tenantId` y `clientId`.

## 3. Puertos y TLS

Variables relevantes:

```env
HOST_PORT=443
PORT=7860
HTTPS_KEY_PATH=
HTTPS_CERT_PATH=
```

Escenarios:

### TLS Terminado por AURORA

AURORA sirve HTTPS directamente en `7860`.

```env
PORT=7860
HTTPS_KEY_PATH=certs/aurora.key
HTTPS_CERT_PATH=certs/aurora.crt
```

El proxy/firewall publica:

```text
443 externo -> 7860 interno HTTPS
```

### TLS Terminado por Proxy/Balanceador

El proxy maneja certificado publico y reenvia a AURORA por HTTP interno.

```env
PORT=7860
HTTPS_KEY_PATH=
HTTPS_CERT_PATH=
```

El proxy publica:

```text
443 externo HTTPS -> 7860 interno HTTP
```

El equipo de infraestructura debe definir cual de los dos modelos se usara. No mezclar ambos sin validar.

## 4. Autenticacion Microsoft Entra ID / Azure AD

Variables minimas:

```env
AZURE_AD_TENANT_ID=<tenant-id>
AZURE_AD_CLIENT_ID=<client-id>
AZURE_AD_ALLOWED_EMAIL_DOMAINS=defensoria.gov.co
```

En la App Registration de Microsoft Entra ID deben existir Redirect URI de tipo **Single-page application (SPA)**, no Web:

```text
https://aurora.defensoria.gov.co
https://auroratest.defensoria.gov.co:7860
https://172.31.64.7:7860
https://localhost:7860
```

Solo deben quedar las URLs realmente usadas por cada ambiente.

El frontend usa:

```text
window.location.origin
```

Por eso la Redirect URI debe coincidir exactamente con el origen visible en navegador:

- Protocolo: `https`
- Host: `aurora.defensoria.gov.co`
- Puerto: sin puerto para 443, con `:7860` si se entra por ese puerto.

## 5. Control Interno de Usuarios AURORA

Variables:

```env
AUTH_USER_ACCESS_MODE=managed
AUTH_BOOTSTRAP_ADMIN_EMAILS=correo.admin@defensoria.gov.co
AUTH_USER_STORE_PATH=
AUTH_USER_IMPORT_MAX_MB=2
AUTH_USER_IMPORT_MAX_ROWS=5000
```

Modos:

- `open`: cualquier usuario validado por Azure/LDAP y dominio permitido puede entrar; Aurora lo registra.
- `managed`: solo entran usuarios existentes y habilitados en la pestaña `Usuarios autorizados`.

Recomendado para produccion:

```env
AUTH_USER_ACCESS_MODE=managed
AUTH_BOOTSTRAP_ADMIN_EMAILS=<correo-admin-inicial>
```

`AUTH_BOOTSTRAP_ADMIN_EMAILS` evita bloqueo inicial. Ese correo entra como admin aunque no exista en la tabla. Cuando ya existan admins estables, se puede retirar.

Usuarios autorizados se guardan por defecto en:

```text
backend/storage/auth-users.json
```

En Docker Compose se recomienda:

```env
AUTH_USER_STORE_PATH=/app/backend/storage/auth/auth-users.json
```

y volumen persistente:

```text
aurora_auth_users:/app/backend/storage/auth
```

Los roles internos vigentes son `user`, `pag`, `admin`, `carguebd` y `cargas_bd`. El rol `pag` controla las operaciones de asignación y creación de defensores; `admin` controla el directorio de usuarios. Las cuentas importadas por CSV se crean habilitadas con rol `user`, y los roles o deshabilitaciones administrados se aplican en la siguiente petición aunque el JWT haya sido emitido antes.

## 6. LDAP / Active Directory Direct Bind

LDAP esta implementado como alternativa a Azure. No es SSO transparente. El usuario escribe usuario y contrasena en AURORA, y AURORA valida contra AD/LDAP.

Variables:

```env
LDAP_ENABLED=false
LDAP_URL=
LDAP_DOMAIN=defensoria.gov.co
LDAP_ALLOWED_EMAIL_DOMAINS=defensoria.gov.co
LDAP_TIMEOUT_MS=8000
```

Para activar:

```env
LDAP_ENABLED=true
LDAP_URL=ldap://servidor-ad.defensoria.gov.co:389
LDAP_DOMAIN=defensoria.gov.co
LDAP_ALLOWED_EMAIL_DOMAINS=defensoria.gov.co
```

O con LDAPS:

```env
LDAP_URL=ldaps://servidor-ad.defensoria.gov.co:636
```

Validar conectividad desde el servidor:

```bash
nc -vz servidor-ad.defensoria.gov.co 389
nc -vz servidor-ad.defensoria.gov.co 636
```

Aunque LDAP valide credenciales, si `AUTH_USER_ACCESS_MODE=managed`, el correo debe estar habilitado en AURORA.

## 7. Variables de Entorno: `.env` vs `.env.test`

`.env` es el archivo de runtime real del ambiente.

`.env.test` es para pruebas tecnicas/regresion. No debe copiarse a produccion sin depuracion.

Diferencias importantes:

| Variable/Grupo | `.env` produccion | `.env.test` |
| --- | --- | --- |
| `NODE_ENV` | `production` | `test` |
| `PORT` | normalmente `7860` | normalmente `7862` |
| `AUTH_LOCAL_ADMIN_ENABLED` | `false` | puede ser `true` para pruebas |
| `AUTH_LOCAL_ADMIN_USERNAME/PASSWORD` | vacios o deshabilitados | credenciales de prueba |
| `API_BASE_URL`, `API_LOGIN_*`, `API_AUTH_TOKEN` | no son runtime productivo | usados por scripts de regresion |
| `CORS_ORIGIN` | vacio si mismo origen | localhost dev/test |
| `AUTH_USER_ACCESS_MODE` | recomendado `managed` | puede ser `open` |
| `LDAP_ENABLED` | segun decision institucional | normalmente `false` |
| Oracle | base/schema productivo o ambiente real | nunca apuntar a produccion si son pruebas destructivas |

Si se usa `.env.test` como base para produccion, se debe revisar obligatoriamente:

```env
NODE_ENV=production
PORT=7860
AUTH_LOCAL_ADMIN_ENABLED=false
AUTH_LOCAL_ADMIN_USERNAME=
AUTH_LOCAL_ADMIN_PASSWORD=
API_BASE_URL=
API_LOGIN_USERNAME=
API_LOGIN_PASSWORD=
API_AUTH_TOKEN=
CORS_ORIGIN=
AUTH_USER_ACCESS_MODE=managed
AUTH_BOOTSTRAP_ADMIN_EMAILS=<admin-real>
```

## 8. Docker Compose

Validar configuracion:

```bash
docker compose config
```

Construir y subir:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f aurora
```

Validar dentro del servidor:

```bash
curl -k https://127.0.0.1:7860/api/health
curl -k https://127.0.0.1:7860/api/auth/config
curl -k https://127.0.0.1:7860/api/health/db
curl -k -I -H 'Range: bytes=0-1023' \
  https://127.0.0.1:7860/tutorial-videos/defensor-publico-condenados-eron.mp4
docker compose exec aurora sh -c \
  'cd /app/backend/tutorial-videos && sha256sum --check SHA256SUMS'
```

Volumenes persistentes esperados:

```text
aurora_auth_users -> usuarios autorizados internos
aurora_cargas_bd  -> archivos/logs de cargas mensuales
```

Los videos no usan un volumen persistente: se versionan en `backend/tutorial-videos/` y el `Dockerfile` verifica su integridad durante el build. `AURORA_VIDEOS_DIR=/app/backend/tutorial-videos` es la ruta estándar; solo debe modificarse si infraestructura suministra y monta un catálogo externo completo.

## 9. PM2 / Node Directo

Si no se usa Docker:

```bash
npm run build
./node_modules/.bin/pm2 restart aurora --update-env
./node_modules/.bin/pm2 status
```

Validar proceso:

```bash
ss -ltnp | grep 7860
curl -k https://127.0.0.1:7860/api/health
curl -k https://127.0.0.1:7860/api/auth/config
```

Logs:

```bash
tail -f ~/.pm2/logs/aurora-out-0.log
tail -f ~/.pm2/logs/aurora-error-0.log
```

## 10. Diagnostico de Errores Frecuentes

### `Failed to fetch`

Ocurre antes de Microsoft. El navegador no pudo contactar la API AURORA.

Revisar:

```bash
curl -k https://aurora.defensoria.gov.co/api/auth/config
curl -k https://aurora.defensoria.gov.co/api/health
```

Causas tipicas:

- Dominio apunta a servidor incorrecto.
- Firewall cierra `443`.
- Proxy/balanceador no reenvia a `7860`.
- Backend no esta corriendo.
- Certificado/TLS mal configurado.

### `Usuario o contraseña inválidos`

El backend respondio, pero el login local/LDAP no valido credenciales y Azure no se inicio.

Revisar:

```bash
curl -k https://aurora.defensoria.gov.co/api/auth/config
```

Debe devolver:

```json
{
  "azureAd": {
    "enabled": true,
    "tenantId": "...",
    "clientId": "..."
  }
}
```

Si `azureAd.enabled` es `false`, faltan variables Azure en el `.env` cargado por el proceso real.

### Microsoft no abre

Primero validar `/api/auth/config`. Si no funciona, Microsoft no se abrira.

Luego revisar Redirect URI SPA exacta en Entra ID.

### Error al guardar defensor

Si aparece:

```text
ORA-01400: cannot insert NULL into DNDP.ASIGNACION.ID_ASIGNACION
```

La tabla `DNDP.ASIGNACION` no esta autogenerando `ID_ASIGNACION`. Esto es ajuste de BD: secuencia/trigger/default/identity.

## 11. Checklist de Reunion

TICS / Entra ID:

- Confirmar tenant ID.
- Confirmar client ID de App Registration.
- Confirmar Redirect URI SPA exactas.
- Confirmar si se usaran app roles/grupos o control interno AURORA.
- Confirmar dominios permitidos.

Infraestructura:

- Confirmar IP destino del DNS.
- Confirmar publicacion `443 -> 7860`.
- Confirmar modelo TLS: directo AURORA o proxy.
- Confirmar firewall desde clientes hacia `443`.
- Confirmar conectividad servidor AURORA -> Oracle.
- Confirmar conectividad servidor AURORA -> LDAP si se habilita.
- Confirmar persistencia de volumenes Docker.

Aplicacion:

- Confirmar `.env` real cargado por proceso.
- Confirmar `AUTH_USER_ACCESS_MODE`.
- Confirmar admin bootstrap inicial.
- Confirmar `/api/health`, `/api/auth/config`, `/api/health/db`.
- Confirmar login Microsoft.
- Confirmar pestaña `Usuarios autorizados`.
- Confirmar guardar formulario sin defensor.
- Confirmar comportamiento de asignacion de defensor segun estado de BD.
