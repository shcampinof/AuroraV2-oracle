# Guía de despliegue Aurora

Fecha de actualización: 2026-07-30

## 1. Objeto

Esta guía explica el despliegue operativo de Aurora desde una máquina limpia hasta una aplicación publicada y validada. Está escrita como un paso a paso para una persona que recibe el servidor sin Docker instalado y necesita saber exactamente qué instalar, de dónde sale la imagen Docker, qué variables configurar y qué evidencias entregar.

El despliegue recomendado para Aurora es Docker Compose. Aurora se ejecuta como un único servicio Docker: Node escucha en el puerto interno `7860` y Docker publica el puerto definido por `HOST_PORT` (`443` por defecto).

```text
Aplicación web: https://<ip-o-dns-del-servidor>
API:            https://<ip-o-dns-del-servidor>/api
Salud API:      https://<ip-o-dns-del-servidor>/api/health
Salud Oracle:   https://<ip-o-dns-del-servidor>/api/health/db
```

Si infraestructura publica un puerto temporal diferente o termina TLS en un proxy, se debe adaptar el protocolo y `HOST_PORT` sin cambiar el puerto interno `PORT=7860`.

## 2. Qué se debe recibir antes de iniciar

Antes de entrar al servidor, la persona responsable del despliegue debe tener estos insumos:

| Insumo | Quién lo entrega | Observación |
|---|---|---|
| IP o DNS del servidor | Infraestructura | Ejemplo: `10.10.10.20` o `aurora.defensoria.gov.co`. |
| Usuario SSH | Infraestructura | Ejemplo: `deploy`, `ubuntu`, `admin` o el usuario institucional asignado. |
| Clave SSH o llave privada | Infraestructura | No debe guardarse en el repositorio. |
| Permisos de administrador | Infraestructura | Se requiere `sudo` para instalar Docker y abrir puertos. |
| Código fuente de Aurora | Equipo técnico | Puede entregarse como `.zip` institucional o por repositorio autorizado. |
| Variables Oracle reales | DBA o administrador técnico | Incluye usuario, host, puerto, service name y esquema. |
| Variables de autenticación | Administrador Entra ID / Azure AD | Incluye tenant, client ID, dominios, grupos o roles si aplica. |
| URL institucional final | Infraestructura | Requiere DNS, proxy, HTTPS o publicación interna. |

Sin las variables reales de Oracle y autenticación no se debe hacer un despliegue productivo. La guía muestra dónde ponerlas, pero no inventa contraseñas, secretos ni datos de base de datos.

## 3. Abrir la conexión SSH al servidor

Desde Windows, abrir PowerShell.

Validar que el comando `ssh` existe:

```powershell
ssh -V
```

Conectarse al servidor:

```powershell
ssh <usuario>@<ip-o-dns-del-servidor>
```

Ejemplo:

```powershell
ssh deploy@10.10.10.20
```

Si se usa una llave privada:

```powershell
ssh -i "C:\ruta\a\llave.pem" <usuario>@<ip-o-dns-del-servidor>
```

Al entrar, validar quién es el usuario y en qué servidor quedó conectado:

```bash
whoami
hostname
pwd
```

Evidencia sugerida: captura de pantalla donde se vea la conexión SSH abierta y el resultado de `whoami` y `hostname`.

## 4. Identificar el sistema operativo del servidor

Ejecutar:

```bash
cat /etc/os-release
uname -m
```

El campo `ID` y `VERSION_ID` indican qué bloque de instalación usar:

| Resultado esperado | Bloque a usar |
|---|---|
| `ID=ubuntu` | Instalación Docker en Ubuntu |
| `ID=debian` | Instalación Docker en Debian |
| `ID="rhel"` o Red Hat Enterprise Linux | Instalación Docker en RHEL |
| `ID="rocky"` o `ID="almalinux"` | Usar el bloque RHEL como referencia y validar con Infraestructura |

La arquitectura debe ser compatible con las imágenes usadas por Aurora. Lo habitual es `x86_64` o `amd64`.

## 5. Instalar Docker en máquina limpia

Aurora usa Docker Engine y Docker Compose v2. El comando correcto es `docker compose`, con espacio. No se debe usar `docker-compose` v1 salvo que Infraestructura lo exija expresamente.

### 5.1 Instalación en Ubuntu

Ejecutar en el servidor:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git unzip
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

### 5.2 Instalación en Debian

Ejecutar en el servidor:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git unzip
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

### 5.3 Instalación en RHEL, Rocky Linux o AlmaLinux

Ejecutar en el servidor:

```bash
sudo dnf -y install dnf-plugins-core git unzip
sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Si el servidor es Rocky Linux o AlmaLinux y el repositorio RHEL no está permitido por política institucional, Infraestructura debe indicar el repositorio aprobado. El objetivo técnico es que queden instalados Docker Engine, Docker CLI, Buildx y Docker Compose Plugin.

### 5.4 Validar que Docker quedó instalado

Ejecutar:

```bash
docker --version
docker compose version
sudo systemctl status docker --no-pager
sudo docker run hello-world
```

Resultado esperado:

- `docker --version` muestra la versión de Docker Engine.
- `docker compose version` muestra la versión de Docker Compose v2.
- `systemctl status docker` aparece como `active (running)`.
- `hello-world` descarga una imagen de prueba y confirma que Docker puede ejecutar contenedores.

Evidencia sugerida: captura o salida de `docker --version`, `docker compose version` y `sudo docker run hello-world`.

Esta guía asume que la persona que realiza la instalación tiene permisos administrativos suficientes para ejecutar `sudo`, instalar paquetes, habilitar Docker como servicio del sistema y validar el puerto publicado. Si no se cuenta con esos permisos, detener el despliegue y solicitar intervención de Infraestructura.

## 6. Preparar la carpeta de Aurora en el servidor

Crear una carpeta institucional para el despliegue:

```bash
sudo mkdir -p /opt/aurora
sudo chown -R "$USER":"$USER" /opt/aurora
cd /opt/aurora
```

En esta guía se usará `/opt/aurora` como ruta de ejemplo. Si Infraestructura exige otra ruta, usar esa ruta de forma consistente en todos los comandos.

## 7. Cargar el código fuente de Aurora

Aurora puede llegar al servidor de dos formas. Usar solo una.

### 7.1 Opción A: código fuente entregado como ZIP institucional

Desde Windows, ubicarse donde esté el archivo `.zip` y enviarlo al servidor con `scp`:

```powershell
scp "C:\ruta\codigo_fuente_Aurora.zip" <usuario>@<ip-o-dns-del-servidor>:/opt/aurora/
```

Ejemplo:

```powershell
scp "C:\Users\Pc\Downloads\codigo_fuente_Aurora.zip" deploy@10.10.10.20:/opt/aurora/
```

En el servidor:

```bash
cd /opt/aurora
unzip codigo_fuente_Aurora.zip
ls -la
```

Si el ZIP crea una carpeta interna, entrar a ella:

```bash
cd /opt/aurora/<carpeta-descomprimida>
```

Validar que existen los archivos principales:

```bash
ls -la Dockerfile docker-compose.yml .env.example backend frontend
```

### 7.2 Opción B: código fuente desde repositorio autorizado

Si la entidad entrega acceso Git:

```bash
cd /opt/aurora
git clone <url-del-repositorio> AuroraV2-oracle
cd AuroraV2-oracle
```

Validar que existen los archivos principales:

```bash
ls -la Dockerfile docker-compose.yml .env.example backend frontend
```

### 7.3 Qué hacer si no existen los archivos esperados

Si `Dockerfile`, `docker-compose.yml`, `.env.example`, `backend` o `frontend` no aparecen, detener el despliegue y solicitar al equipo técnico un paquete completo del código fuente. Sin esos archivos no se puede construir la imagen de Aurora.

## 8. De dónde sale la imagen Docker de Aurora

No se descarga una imagen pública de Aurora desde Docker Hub.

La imagen se construye localmente en el servidor a partir del archivo `Dockerfile` incluido en el código fuente. El archivo `docker-compose.yml` define el nombre de la imagen:

```text
aurora-app:local
```

El servicio Docker Compose se llama:

```text
aurora
```

El `Dockerfile` usa como base:

```text
node:20.19-bookworm-slim
```

Para pruebas o ejecución directa fuera de Docker se requiere Node.js `20.19` o superior dentro de la línea compatible indicada por las dependencias.

Durante la construcción, Docker descarga esa imagen base oficial de Node.js, instala dependencias, compila el frontend React/Vite, copia el resultado al backend Express, instala dependencias Python para cargas mensuales, incorpora los tres tutoriales institucionales y valida sus sumas SHA-256.

Comando para construir la imagen sin levantar todavía el servicio:

```bash
docker compose build aurora
```

Comando para ver que la imagen quedó creada:

```bash
docker images | grep aurora-app
```

Resultado esperado:

```text
aurora-app   local   <id>   <fecha>   <tamaño>
```

## 9. Crear y configurar el archivo `.env`

Entrar a la carpeta raíz del proyecto, donde están `Dockerfile` y `docker-compose.yml`.

Crear el archivo real a partir del ejemplo:

```bash
cp .env.example .env
chmod 600 .env
```

Editarlo:

```bash
nano .env
```

También puede usarse `vi`:

```bash
vi .env
```

### 9.1 Plantilla mínima comentada

La estructura esperada es:

```env
# Docker / HTTP
HOST_PORT=7860
PORT=7860
NODE_ENV=production
ENABLE_STARTUP_WARMUP=true

# HTTPS / TLS
HTTPS_KEY_PATH=
HTTPS_CERT_PATH=

# Frontend
VITE_API_BASE_URL=/api

# CORS
# En producción normalmente queda vacío cuando frontend y backend usan el mismo origen.
CORS_ORIGIN=

# Seguridad de sesión
AUTH_JWT_SECRET=<secreto-largo-entregado-por-el-administrador>
AUTH_TOKEN_TTL=8h
AUTH_REMEMBER_TOKEN_TTL=7d
AUTH_TOKEN_ISSUER=aurora
AUTH_TOKEN_AUDIENCE=aurora-api

# Login local temporal
AUTH_LOCAL_ADMIN_ENABLED=false
AUTH_LOCAL_ADMIN_USERNAME=
AUTH_LOCAL_ADMIN_PASSWORD=

# Directorio administrado e importación CSV
AUTH_USER_ACCESS_MODE=managed
AUTH_BOOTSTRAP_ADMIN_EMAILS=<correo-admin-inicial>
AUTH_USER_STORE_PATH=/app/backend/storage/auth/auth-users.json
AUTH_USER_IMPORT_MAX_MB=2
AUTH_USER_IMPORT_MAX_ROWS=5000
AUTH_USER_SYNC_REQUIRED=false

# Manual Interactivo incluido en la imagen
AURORA_VIDEOS_DIR=/app/backend/tutorial-videos

# Microsoft Entra ID / Azure AD
AZURE_AD_TENANT_ID=<tenant-id>
AZURE_AD_CLIENT_ID=<client-id>
AZURE_AD_ALLOWED_EMAIL_DOMAINS=defensoria.gov.co
AZURE_AD_REQUIRED_GROUP_IDS=
AZURE_AD_REQUIRED_APP_ROLES=
AZURE_AD_ADMIN_GROUP_IDS=

# LDAP / Active Directory alterno
LDAP_ENABLED=false
LDAP_URL=
LDAP_DOMAIN=defensoria.gov.co
LDAP_ALLOWED_EMAIL_DOMAINS=defensoria.gov.co
LDAP_TIMEOUT_MS=8000

# Oracle
ORACLE_USER=<usuario-oracle>
ORACLE_PASSWORD=<password-oracle>
ORACLE_HOST=<host-o-ip-oracle>
ORACLE_PORT=1521
ORACLE_SERVICE_NAME=<service-name>
ORACLE_SCHEMA=<schema>
ORACLE_GESTION_ID_SEQUENCE=

# Pool Oracle
ORACLE_POOL_MIN=1
ORACLE_POOL_MAX=8
ORACLE_POOL_INCREMENT=1
ORACLE_POOL_TIMEOUT=60

# Cargas mensuales
AURORA_CARGAS_DIR=/app/backend/storage/cargas_bd
AURORA_CARGAS_TMP_DIR=
CARGUEBD_ADMIN_ROLES=admin,carguebd,cargas_bd
CARGUEBD_PYTHON=python3
CARGUEBD_AURORA10_ENABLED=true
CARGUEBD_SISIPEC_PROCEDURE=
CARGUEBD_SKIP_ETL=false
CARGUEBD_MAX_FILE_MB=120
CARGUEBD_PUBLIC_ERROR_MAX_LENGTH=1000
CARGUEBD_REPAIR_REGISTRY_ON_START=false
CARGUEBD_CLEAR_REGISTRY_ON_START=false
CARGUEBD_ACTUACIONES_CLEANUP_DEFENSOR=PRUEBA PILOTO
```

### 9.2 Variables que normalmente sí cambian por ambiente

| Variable | Valor esperado | Quién la define |
|---|---|---|
| `HOST_PORT` | Puerto publicado en el servidor. Por defecto `443`; puede usarse uno alterno en pruebas. | Infraestructura |
| `HTTPS_KEY_PATH` | Ruta de la llave privada `.key` o PEM para habilitar HTTPS. Vacío sirve HTTP. | Infraestructura |
| `HTTPS_CERT_PATH` | Ruta del certificado `.crt` o `fullchain.crt` para habilitar HTTPS. Vacío sirve HTTP. | Infraestructura |
| `AUTH_JWT_SECRET` | Secreto largo, aleatorio y privado. | Administrador técnico |
| `AUTH_LOCAL_ADMIN_ENABLED` | `false` en producción. | Administrador técnico |
| `AUTH_USER_ACCESS_MODE` | `managed` cuando solo pueden ingresar cuentas aprobadas en Aurora. | Administrador funcional |
| `AUTH_BOOTSTRAP_ADMIN_EMAILS` | Correo real que administrará el directorio inicial. | Administrador funcional |
| `AUTH_USER_STORE_PATH` | `/app/backend/storage/auth/auth-users.json` con Docker Compose. | Equipo técnico |
| `AUTH_USER_SYNC_REQUIRED` | `true` bloquea el ingreso si falla la sincronización del directorio interno. | Administrador técnico |
| `AURORA_VIDEOS_DIR` | `/app/backend/tutorial-videos`; solo cambia si se monta un catálogo externo. | Equipo técnico |
| `AZURE_AD_TENANT_ID` | Tenant de Microsoft Entra ID. | Administrador Entra ID |
| `AZURE_AD_CLIENT_ID` | Client ID de la aplicación registrada. | Administrador Entra ID |
| `AZURE_AD_ALLOWED_EMAIL_DOMAINS` | Dominio permitido, por ejemplo `defensoria.gov.co`. | Administrador Entra ID |
| `AZURE_AD_REQUIRED_GROUP_IDS` | IDs de grupos requeridos, si la entidad lo usa. | Administrador Entra ID |
| `AZURE_AD_REQUIRED_APP_ROLES` | Roles requeridos, si la entidad lo usa. | Administrador Entra ID |
| `AZURE_AD_ADMIN_GROUP_IDS` | IDs de grupos que reciben rol interno `admin`, si la entidad lo usa. | Administrador Entra ID |
| `LDAP_ENABLED`, `LDAP_URL`, `LDAP_DOMAIN` | Habilitan autenticación directa LDAP/LDAPS como alternativa. | Administrador AD / Infraestructura |
| `ORACLE_USER` | Usuario de conexión a Oracle. | DBA |
| `ORACLE_PASSWORD` | Contraseña Oracle. | DBA |
| `ORACLE_HOST` | Host o IP de Oracle. | DBA / Infraestructura |
| `ORACLE_PORT` | Normalmente `1521`. | DBA |
| `ORACLE_SERVICE_NAME` | Service name Oracle. | DBA |
| `ORACLE_SCHEMA` | Esquema dueño o esquema funcional. | DBA |
| `ORACLE_GESTION_ID_SEQUENCE` | Secuencia Oracle si aplica al ambiente. | DBA / Equipo técnico |
| `AURORA_CARGAS_DIR` | Dentro de Docker se recomienda `/app/backend/storage/cargas_bd`. | Equipo técnico |
| `AURORA_CARGAS_TMP_DIR` | Directorio temporal opcional para archivos recién recibidos. | Equipo técnico |
| `CARGUEBD_ADMIN_ROLES` | Roles autorizados para cargas. | Administrador funcional / Entra ID |
| `CARGUEBD_SISIPEC_PROCEDURE` | Procedimiento Oracle para completar la carga SISIPEC, si difiere del predeterminado. | DBA / Equipo técnico |
| `CARGUEBD_ACTUACIONES_CLEANUP_DEFENSOR` | Único defensor permitido en la depuración administrativa controlada. | Administrador funcional / DBA |

### 9.3 Dónde van las credenciales y datos de Azure AD / Microsoft Entra ID

Aurora usa Microsoft Entra ID, antes Azure AD, para el login institucional. Los datos de Entra ID se escriben en el archivo `.env` del servidor, en las variables que empiezan por `AZURE_AD_`.

Bloque dentro de `.env`:

```env
AZURE_AD_TENANT_ID=<tenant-id>
AZURE_AD_CLIENT_ID=<client-id>
AZURE_AD_ALLOWED_EMAIL_DOMAINS=defensoria.gov.co
AZURE_AD_REQUIRED_GROUP_IDS=
AZURE_AD_REQUIRED_APP_ROLES=
```

Qué debe entregar el administrador de Entra ID:

| Dato | Dónde se obtiene | Dónde se escribe en Aurora |
|---|---|---|
| Directory tenant ID | Microsoft Entra ID > Overview > Tenant ID | `AZURE_AD_TENANT_ID` |
| Application client ID | App registrations > Aurora > Overview > Application client ID | `AZURE_AD_CLIENT_ID` |
| Dominio permitido | Dominio institucional autorizado | `AZURE_AD_ALLOWED_EMAIL_DOMAINS` |
| IDs de grupos autorizados | Entra ID > Groups > Object ID de cada grupo | `AZURE_AD_REQUIRED_GROUP_IDS` |
| Roles de aplicación | App registrations > Aurora > App roles | `AZURE_AD_REQUIRED_APP_ROLES` |
| Redirect URI | App registrations > Aurora > Authentication | No va en `.env`; se configura en Entra ID |

La Redirect URI debe configurarse en Microsoft Entra ID como plataforma `Single-page application` y debe coincidir con la URL desde donde los usuarios abrirán Aurora. No debe quedar solamente en plataforma `Web`, porque MSAL.js canjea el código desde el navegador. Ejemplos:

```text
http://<ip-o-dns-del-servidor>:7860
https://localhost:7860
http://localhost:17860
https://<url-institucional-aurora>
```

Para pruebas internas puede usarse la URL temporal por IP, DNS interno o un puerto reenviado por SSH/VS Code. Si la prueba se abre en el navegador como `https://localhost:7860` o `http://localhost:17860`, esa URL exacta, incluyendo protocolo y puerto, debe estar registrada como Redirect URI de tipo `Single-page application` en Microsoft Entra ID. Para producción debe quedar registrada la URL institucional HTTPS definitiva.

Notas importantes:

- En este flujo Aurora no requiere guardar un `client secret` de Azure en el `.env`.
- El frontend usa MSAL para pedir el login a Microsoft Entra ID.
- El backend recibe el `idToken`, valida la firma contra Microsoft y revisa tenant, dominio, grupos o roles según la configuración.
- Si `AZURE_AD_TENANT_ID` y `AZURE_AD_CLIENT_ID` están vacíos, el login institucional no queda habilitado.
- Si `AZURE_AD_ALLOWED_EMAIL_DOMAINS` está vacío, no se restringe por dominio de correo.
- Si `AZURE_AD_REQUIRED_GROUP_IDS` está vacío, no se exige pertenencia a un grupo específico.
- Si `AZURE_AD_REQUIRED_APP_ROLES` está vacío, no se exige rol de aplicación específico.
- No documentar secretos, llaves privadas ni contraseñas en capturas. Aunque `Tenant ID` y `Client ID` no son contraseñas, deben tratarse como datos de configuración institucional.

Ejemplo con roles de aplicación:

```env
AZURE_AD_TENANT_ID=11111111-2222-3333-4444-555555555555
AZURE_AD_CLIENT_ID=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
AZURE_AD_ALLOWED_EMAIL_DOMAINS=defensoria.gov.co
AZURE_AD_REQUIRED_GROUP_IDS=
AZURE_AD_REQUIRED_APP_ROLES=admin,user,pag
```

Ejemplo con grupo autorizado:

```env
AZURE_AD_TENANT_ID=11111111-2222-3333-4444-555555555555
AZURE_AD_CLIENT_ID=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
AZURE_AD_ALLOWED_EMAIL_DOMAINS=defensoria.gov.co
AZURE_AD_REQUIRED_GROUP_IDS=99999999-8888-7777-6666-555555555555
AZURE_AD_REQUIRED_APP_ROLES=
```

Después de cambiar estas variables, recrear el contenedor para que Docker Compose tome los nuevos valores del `.env`:

```bash
docker compose up -d --force-recreate aurora
```

Validar que el backend está exponiendo la configuración pública necesaria para el frontend:

```bash
curl http://127.0.0.1:7860/api/auth/config
```

El resultado debe indicar `azureAd.enabled` en `true` y mostrar `tenantId` y `clientId`.

Resultado cuando Azure no está configurado:

```json
{"localAdminEnabled":false,"azureAd":{"enabled":false,"tenantId":null,"clientId":null}}
```

Ese resultado significa que el contenedor no recibió `AZURE_AD_TENANT_ID` o `AZURE_AD_CLIENT_ID`. En ese caso revisar el `.env`, recrear el contenedor y volver a consultar `/api/auth/config`.

Resultado esperado cuando Azure sí está configurado:

```json
{"localAdminEnabled":false,"azureAd":{"enabled":true,"tenantId":"<tenant-id>","clientId":"<client-id>"}}
```

Si `azureAd.enabled` está en `false`, la pantalla de login no abrirá Microsoft Entra ID y el usuario verá el flujo local. No debe interpretarse como falla de contraseña institucional, sino como configuración incompleta del ambiente.

#### Autenticación LDAP/LDAPS alternativa

LDAP no es SSO transparente. El usuario escribe sus credenciales institucionales y Aurora realiza un bind directo contra Active Directory. Para habilitarlo:

```env
LDAP_ENABLED=true
LDAP_URL=ldaps://servidor-ad.defensoria.gov.co:636
LDAP_DOMAIN=defensoria.gov.co
LDAP_ALLOWED_EMAIL_DOMAINS=defensoria.gov.co
LDAP_TIMEOUT_MS=8000
```

Validar conectividad desde el servidor antes de recrear el contenedor:

```bash
nc -vz servidor-ad.defensoria.gov.co 636
```

El endpoint `/api/auth/config` debe responder `ldap.enabled: true`. Si `AUTH_USER_ACCESS_MODE=managed`, una autenticación LDAP correcta no reemplaza la habilitación del correo en `Usuarios autorizados`.

### 9.4 Generar un secreto JWT si no fue entregado

Si el administrador técnico autoriza generarlo en el servidor:

```bash
openssl rand -hex 32
```

Copiar el resultado en:

```env
AUTH_JWT_SECRET=<resultado-del-comando>
```

No enviar este secreto por chat ni incluirlo en actas, capturas públicas o repositorios.

### 9.5 Validar que el `.env` quedó guardado

Ejecutar:

```bash
ls -l .env
grep -E '^(HOST_PORT|PORT|NODE_ENV|VITE_API_BASE_URL|AUTH_LOCAL_ADMIN_ENABLED|ORACLE_HOST|ORACLE_PORT|ORACLE_SERVICE_NAME|ORACLE_SCHEMA|AURORA_CARGAS_DIR)=' .env
```

No ejecutar comandos que impriman `ORACLE_PASSWORD`, `AUTH_JWT_SECRET` o contraseñas en pantalla si se van a tomar capturas.

## 10. Validar conectividad básica antes de construir

Validar salida a internet para descargar imágenes base y paquetes:

```bash
curl -I https://registry-1.docker.io/v2/
curl -I https://registry.npmjs.org/
```

Validar que el servidor ve Oracle por red:

```bash
nc -vz <host-oracle> <puerto-oracle>
```

Ejemplo:

```bash
nc -vz 10.20.30.40 1521
```

Si `nc` no existe:

```bash
sudo apt install -y netcat-openbsd
```

o en RHEL:

```bash
sudo dnf install -y nmap-ncat
```

Si esta prueba falla, no es un problema de Aurora todavía. Debe revisarse red, firewall, VPN, rutas o listener Oracle.

## 11. Construir y levantar Aurora

Desde la carpeta raíz del proyecto:

```bash
pwd
ls -la Dockerfile docker-compose.yml .env
```

Construir la imagen:

```bash
docker compose config --quiet
docker compose build aurora
```

Levantar el servicio en segundo plano:

```bash
docker compose up -d
```

También puede hacerse en un solo paso:

```bash
docker compose up --build -d
```

Ver estado:

```bash
docker compose ps
```

Resultado esperado:

```text
NAME              SERVICE   STATUS
<proyecto>-aurora aurora    Up
```

Ver logs:

```bash
docker compose logs --tail=100 aurora
```

Seguir logs en vivo:

```bash
docker compose logs -f aurora
```

Salir de logs en vivo:

```text
Ctrl + C
```

## 12. Validar puerto y salud de la aplicación

Validar que el puerto publicado está escuchando. Con el valor predeterminado:

```bash
ss -ltnp | grep ':443' || true
```

Validar salud desde el servidor usando el protocolo y `HOST_PORT` reales. Si Aurora termina TLS directamente en el puerto predeterminado:

```bash
curl -k https://127.0.0.1/api/health
curl -k https://127.0.0.1/api/health/db
curl -k https://127.0.0.1/api/auth/config
curl -k -I -H 'Range: bytes=0-1023' \
  https://127.0.0.1/tutorial-videos/defensor-publico-condenados-eron.mp4
docker compose exec aurora sh -c \
  'cd /app/backend/tutorial-videos && sha256sum --check SHA256SUMS'
```

Si se publica temporalmente `HOST_PORT=7860` sin TLS, sustituir las URL anteriores por `http://127.0.0.1:7860/...`.

Resultado esperado para salud general:

```json
{"ok":true}
```

La validación de base de datos debe responder correctamente. Si `/api/health` funciona y `/api/health/db` falla, la aplicación está levantada pero hay un problema de variables Oracle, permisos, service name, red o firewall hacia Oracle.

La consulta del tutorial debe responder `206 Partial Content` y el comando de integridad debe informar `OK` para los tres MP4. Los tutoriales forman parte de la imagen; no existe un volumen obligatorio para ellos. Los volúmenes persistentes del despliegue estándar son `aurora_auth_users` y `aurora_cargas_bd`.

Validar desde un equipo cliente con acceso a la red:

```powershell
curl http://<ip-o-dns-del-servidor>:7860/api/health
curl http://<ip-o-dns-del-servidor>:7860/api/health/db
```

Abrir en navegador:

```text
http://<ip-o-dns-del-servidor>:7860
```

Si desde el servidor funciona pero desde el equipo cliente no, revisar con Infraestructura:

- Firewall del servidor.
- Reglas de seguridad de la red.
- VPN.
- Proxy inverso.
- DNS.
- Publicación HTTPS institucional.

### 12.1 Prueba desde Windows o VS Code por túnel SSH

Cuando se ejecuta `curl http://127.0.0.1:7860` dentro del servidor, `127.0.0.1` significa el servidor. Cuando se abre `http://127.0.0.1:7860` en el navegador de Windows, `127.0.0.1` significa el equipo Windows.

Si se trabaja desde VS Code conectado por SSH, usar la vista **Ports / Puertos** y reenviar el puerto publicado por Aurora. Por ejemplo, si Aurora se levantó en el puerto alterno `17860`, reenviar `17860` y abrir en Windows:

```text
http://127.0.0.1:17860
```

También puede hacerse con PowerShell:

```powershell
ssh -L 17860:127.0.0.1:17860 <usuario>@<ip-o-dns-del-servidor>
```

Con esa terminal SSH abierta, abrir en el navegador:

```text
http://127.0.0.1:17860
```

Si se usa Azure / Entra ID durante esa prueba, registrar `http://localhost:17860` como Redirect URI temporal en la App Registration.

### 12.2 Prueba con puerto alterno

Si el puerto `7860` ya está ocupado por otro proceso, levantar Aurora temporalmente en otro puerto sin modificar el código:

```bash
HOST_PORT=17860 docker compose up -d aurora
docker compose ps
curl http://127.0.0.1:17860/api/health
```

Validar qué proceso usa el puerto oficial:

```bash
ss -ltnp | grep ':7860' || true
```

Cuando termine la prueba temporal:

```bash
HOST_PORT=17860 docker compose down
```

Para producción, liberar el puerto oficial o definir el puerto autorizado por Infraestructura en `HOST_PORT`.

## 13. Comandos operativos diarios

| Acción | Comando |
|---|---|
| Ver estado | `docker compose ps` |
| Validar sintaxis Compose | `docker compose config --quiet` |
| Ver logs recientes | `docker compose logs --tail=100 aurora` |
| Ver logs en vivo | `docker compose logs -f aurora` |
| Reiniciar Aurora | `docker compose restart aurora` |
| Recrear por cambio de `.env` | `docker compose up -d --force-recreate aurora` |
| Detener Aurora | `docker compose down` |
| Levantar Aurora | `docker compose up -d` |
| Levantar en puerto alterno temporal | `HOST_PORT=17860 docker compose up -d aurora` |
| Reconstruir imagen | `docker compose build --no-cache aurora` |
| Reconstruir y levantar | `docker compose up --build -d` |
| Ver imagen local | `docker images | grep aurora-app` |
| Ver uso de disco Docker | `docker system df` |
| Validar API | `curl http://127.0.0.1:7860/api/health` |
| Validar Oracle | `curl http://127.0.0.1:7860/api/health/db` |

## 14. Subir, bajar y reiniciar el servicio Aurora

En el despliegue institucional recomendado, Docker Compose es el administrador operativo del servicio. No se debe ejecutar PM2 dentro del contenedor, porque Docker ya controla el ciclo de vida del proceso mediante `restart: unless-stopped` en `docker-compose.yml`.

### 14.1 Subir la aplicación

Usar este comando cuando el contenedor no está arriba:

```bash
cd /opt/aurora/<carpeta-del-proyecto>
docker compose up -d
```

Validar:

```bash
docker compose ps
curl http://127.0.0.1:7860/api/health
```

### 14.2 Bajar la aplicación

Para detener y remover el contenedor de Aurora sin borrar la imagen ni el volumen de cargas:

```bash
cd /opt/aurora/<carpeta-del-proyecto>
docker compose down
```

Validar que quedó abajo:

```bash
docker compose ps
ss -ltnp | grep ':7860' || true
```

Si `ss` no muestra el puerto `7860`, la aplicación ya no está escuchando en ese puerto.

### 14.3 Pausar sin remover el contenedor

Si se necesita detener el servicio temporalmente y conservar el contenedor creado:

```bash
docker compose stop aurora
```

Para volverlo a subir:

```bash
docker compose start aurora
```

### 14.4 Reiniciar la aplicación

Usar cuando se reinicia conexión de red o se requiere reciclar el proceso sin cambiar variables:

```bash
docker compose restart aurora
```

Validar:

```bash
docker compose ps
docker compose logs --tail=100 aurora
curl http://127.0.0.1:7860/api/health
```

Si se cambió el archivo `.env`, no basta con `restart`, porque las variables de entorno quedan fijadas cuando se crea el contenedor. En ese caso recrear el servicio:

```bash
docker compose up -d --force-recreate aurora
```

Validar la configuración efectiva después de recrear:

```bash
docker compose exec -T aurora env | grep -E '^(AUTH_LOCAL_ADMIN_ENABLED|AZURE_AD_TENANT_ID|AZURE_AD_CLIENT_ID|AZURE_AD_ALLOWED_EMAIL_DOMAINS)='
curl http://127.0.0.1:7860/api/auth/config
```

No imprimir en pantalla variables sensibles como `AUTH_JWT_SECRET`, `ORACLE_PASSWORD` o contraseñas locales cuando se toman capturas.

### 14.5 Reconstruir después de cambios de código

Cuando cambia el código fuente, no basta con reiniciar. Se debe reconstruir la imagen:

```bash
docker compose up --build -d
```

Si se sospecha caché corrupta o dependencias antiguas:

```bash
docker compose build --no-cache aurora
docker compose up -d
```

### 14.6 Arranque automático después de reinicio del servidor

Validar que Docker inicia con el sistema operativo:

```bash
sudo systemctl is-enabled docker
sudo systemctl status docker --no-pager
```

Si no está habilitado:

```bash
sudo systemctl enable --now docker
```

El archivo `docker-compose.yml` tiene `restart: unless-stopped`, por lo que Docker intentará levantar Aurora nuevamente después de reiniciar el servidor, siempre que el servicio Docker arranque correctamente.

### 14.7 Uso de PM2

PM2 es válido únicamente como alternativa tradicional cuando el ambiente no usa Docker. No es el camino recomendado para producción institucional si Docker Compose está disponible.

Usar PM2 solo para diagnóstico, pruebas controladas o servidores donde Infraestructura haya decidido operar Node.js directamente. En ese caso:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
cp .env.example .env
nano .env
npm run service:start
npm run service:status
```

Comandos PM2 disponibles:

| Acción | Comando |
|---|---|
| Subir con PM2 | `npm run service:start` |
| Ver estado PM2 | `npm run service:status` |
| Ver logs PM2 | `npm run service:logs` |
| Reiniciar con PM2 | `npm run service:restart` |
| Detener con PM2 | `npm run service:stop` |
| Eliminar proceso PM2 | `npm run service:delete` |

En operación PM2, `ecosystem.config.cjs` inicia `backend/index.js`, usa `PORT=7860` y carga variables desde el `.env` ubicado en la raíz del proyecto mediante `DOTENV_CONFIG_PATH=../.env`.

Para persistir PM2 después de reiniciar el servidor, Infraestructura debe configurar el startup script con PM2:

```bash
npx pm2 startup
npx pm2 save
```

La salida de `npx pm2 startup` puede pedir ejecutar un comando con `sudo`. Ese comando debe ser revisado y ejecutado por la persona administradora del servidor.

## 15. Actualizar Aurora a una nueva versión

Entrar por SSH:

```bash
ssh <usuario>@<ip-o-dns-del-servidor>
```

Entrar a la carpeta del proyecto:

```bash
cd /opt/aurora/<carpeta-del-proyecto>
```

Guardar evidencia de la versión actual:

```bash
docker compose ps
docker images | grep aurora-app
```

Si la nueva versión llega por Git:

```bash
git pull
```

Si la nueva versión llega por ZIP, subir el ZIP, descomprimirlo en una carpeta nueva y copiar o recrear el archivo `.env` con las variables reales del ambiente.

Reconstruir y levantar:

```bash
docker compose up --build -d
```

Validar:

```bash
docker compose ps
curl http://127.0.0.1:7860/api/health
curl http://127.0.0.1:7860/api/health/db
```

## 16. Evidencias sugeridas para entregar

Tomar capturas o guardar salidas de:

1. Conexión SSH al servidor.
2. `cat /etc/os-release`.
3. `docker --version`.
4. `docker compose version`.
5. `sudo docker run hello-world`.
6. Carpeta del proyecto con `Dockerfile`, `docker-compose.yml` y `.env.example`.
7. `docker compose build aurora` finalizado sin errores.
8. `docker compose ps` con el servicio `aurora` arriba.
9. `docker images | grep aurora-app`.
10. Consulta de `/api/health` usando el protocolo y puerto publicados.
11. Consulta de `/api/health/db`.
12. Consulta de `/api/auth/config`, ocultando valores si la evidencia se comparte fuera del equipo técnico.
13. Respuesta `206` de un tutorial y verificación SHA-256 de los tres MP4.
14. Resultado de `npm run qa:smoke`, `npm run qa:encoding` y auditorías de dependencias.
15. Navegador cargando Aurora.
16. Caja de Herramientas abriendo un enlace institucional autorizado.
17. Login Entra ID y, si está habilitado, login LDAP seguido de `/api/auth/me`.
18. Validación desde equipo cliente o evidencia de solicitud a Infraestructura si falta publicación de red.
19. Si se usó puerto alterno, evidencia de `HOST_PORT=<puerto> docker compose ps` y URL de prueba.

No incluir capturas donde se vean contraseñas, `AUTH_JWT_SECRET`, `ORACLE_PASSWORD` o llaves privadas.

## 17. Problemas comunes

| Síntoma | Causa probable | Acción |
|---|---|---|
| `docker: command not found` | Docker no está instalado. | Ejecutar el bloque de instalación según el sistema operativo. |
| `docker compose` no existe | Falta Docker Compose Plugin. | Instalar `docker-compose-plugin`. |
| Permiso denegado al ejecutar Docker | Usuario sin permisos para Docker. | Usar `sudo docker ...` o pedir a Infraestructura agregar el usuario al grupo `docker`. |
| Falla al descargar `node:20.19-bookworm-slim` | Sin internet o Docker Hub bloqueado. | Pedir salida a internet o repositorio espejo institucional. |
| `docker compose build` falla en `npm ci` | Sin acceso a npm o dependencias. | Validar salida a `https://registry.npmjs.org/`. |
| `docker compose ps` muestra `Restarting` | La aplicación falla al iniciar. | Revisar `docker compose logs --tail=200 aurora`. |
| `Bind for 0.0.0.0:7860 failed` o puerto ocupado | Otro proceso usa el puerto oficial. | Revisar `ss -ltnp | grep ':7860'`; detener el proceso autorizado o usar `HOST_PORT` temporal. |
| `/api/health` no responde | Contenedor caído o puerto no publicado. | Revisar `docker compose ps`, logs y `ss -ltnp`. |
| `/api/health` funciona pero navegador remoto no abre | Bloqueo de red externo al contenedor. | Revisar firewall, proxy, DNS o VPN. |
| `/api/health/db` falla | Problema con Oracle. | Revisar `ORACLE_*`, service name, permisos, firewall y conectividad al puerto 1521. |
| En navegador `127.0.0.1` no abre desde Windows | `127.0.0.1` apunta al equipo cliente, no al servidor. | Usar IP/DNS del servidor o túnel SSH/VS Code Ports. |
| Login muestra usuario o contraseña inválidos y no abre Microsoft | Azure no está configurado o `azureAd.enabled` está en `false`. | Revisar `.env`, `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, recrear contenedor y consultar `/api/auth/config`. |
| Microsoft rechaza el login por Redirect URI | La URL del navegador no está registrada en Entra ID. | Registrar exactamente `http://localhost:<puerto>` para prueba o la URL HTTPS institucional para producción. |
| `AADSTS9002326` o `Cross-origin token redemption` | La Redirect URI existe como plataforma `Web` o no está registrada como `Single-page application`. | En Entra ID > App registrations > Authentication, agregar la URL exacta en `Single-page application`, por ejemplo `https://localhost:7860`. |
| Cambio de `.env` no se ve reflejado | El contenedor fue reiniciado pero no recreado. | Ejecutar `docker compose up -d --force-recreate aurora`. |
| Cargas mensuales no funcionan | Roles, Python o carpeta de cargas. | Revisar `CARGUEBD_*`, `AURORA_CARGAS_DIR` y logs del backend. |
| Un nombre de defensor con caracteres dañados no filtra | Datos históricos con codificación inconsistente y ausencia de vínculo por cédula. | Confirmar la versión actual, verificar `CEDULA_DEFENSOR` y probar el nombre correcto y el visible. Corregir el dato en origen cuando sea posible. |
| Una escritura pendiente desaparece al cambiar de usuario | Protección de identidad de la cola sin conexión. | Es el comportamiento esperado: las operaciones autenticadas no se transfieren entre sesiones. Repetir la operación con la cuenta autorizada y conexión disponible. |

## 18. Recomendaciones de seguridad

- No subir `.env` a Git.
- No enviar contraseñas por chat.
- No tomar capturas donde aparezcan secretos.
- Mantener `AUTH_LOCAL_ADMIN_ENABLED=false` en producción.
- Usar HTTPS para la URL institucional definitiva.
- Restringir el puerto `7860` o publicarlo detrás de proxy inverso según política de Infraestructura.
- No versionar `node_modules`, `.env`, archivos temporales de entorno, datos de carga ni almacenamiento operativo.
- Probar cierre y cambio de sesión cuando se habilite operación sin conexión.
- Documentar fecha, responsable, versión desplegada y resultado de pruebas.

## 19. Referencias técnicas

- Docker Engine para Ubuntu: `https://docs.docker.com/engine/install/ubuntu/`
- Docker Engine para Debian: `https://docs.docker.com/engine/install/debian/`
- Docker Engine para RHEL: `https://docs.docker.com/installation/rhel/`
- Docker Compose Plugin para Linux: `https://docs.docker.com/compose/install/linux/`
