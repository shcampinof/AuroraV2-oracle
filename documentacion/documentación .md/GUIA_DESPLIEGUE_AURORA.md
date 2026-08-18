# Guía de despliegue de Aurora

> Estado documental: vigente al 2026-07-30.

Defensoría del Pueblo  
Dirección Nacional de Defensoría Pública (DNDP)  
Grupo de Transformación Digital

Guía de despliegue Aurora

| Campo | Valor |
| --- | --- |
| Proyecto | Aurora |
| Fecha | 2026-07-30 |
| Versión documental | 1.2 |
| Responsable | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital |

## Control de cambios

| Versión | Fecha | Responsable | Descripción del cambio | Aprobación |
| --- | --- | --- | --- | --- |
| 1.0 | 2026-05-19 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Versión inicial de entrega técnica. | Equipo DNDP |
| 1.1 | 2026-05-28 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Ajuste de formato institucional, control documental, índice, repositorio institucional, despliegue, roles, URL de ambiente y pruebas. | Pendiente aprobación institucional |
| 1.2 | 2026-07-30 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Sincronización con Docker Compose, autenticación, persistencia, pruebas y seguridad de la versión final. | Pendiente aprobación institucional |

## Tabla de contenido

## Objeto

Esta guía describe el despliegue operativo de Aurora en ambiente institucional. El mecanismo recomendado para preproducción y producción es Docker Compose.

## Fuente oficial de código

El código fuente de versión cero se entrega en SharePoint en la ruta Documentos > Aurora > codigo_fuente_Aurora.zip. Desde allí la entidad podrá realizar la publicación inicial en Azure DevOps y ejecutar el despliegue institucional.

No se reconoce un repositorio externo como canal oficial de la entidad para preproducción o producción.

## Requisitos previos

- Servidor con Docker instalado.

- Docker Compose disponible como docker compose.

- Acceso de red desde el servidor hacia Oracle.

- Archivo .env configurado con variables reales y custodiado fuera del repositorio.

- Puerto interno `7860` disponible en el contenedor y puerto publicado definido en `HOST_PORT`, por defecto `443`.

- URL institucional o direccionamiento temporal validado por Infraestructura.

## Despliegue con Docker Compose

```bash
cp .env.example .env
# editar .env con valores reales
docker compose up --build -d
docker compose ps
docker compose logs -f aurora
```

El Dockerfile construye el frontend React/Vite, lo integra al backend Express y publica un único servicio HTTP en el puerto configurado.

## URL de ambiente y validación

| Uso | URL |
| --- | --- |
| Validación interna desde servidor | http://127.0.0.1:7860 |
| URL temporal por IP privada si red/firewall lo permite | http://172.31.64.7:7860 |
| Acceso de prueba por túnel SSH | http://localhost:8787 |
| URL institucional definitiva | Pendiente de asignación por Infraestructura |

```bash
curl http://127.0.0.1:7860/api/health
curl http://127.0.0.1:7860/api/health/db
```

Localhost o 127.0.0.1 aplica solamente a validaciones ejecutadas desde el servidor o mediante túnel SSH. Para usuarios finales se debe habilitar una URL institucional o direccionamiento autorizado.

## Validación posterior

1. Confirmar docker compose ps con servicio aurora activo.

2. Confirmar /api/health con ok:true.

3. Confirmar /api/health/db con conexión exitosa.

4. Abrir la aplicación en navegador.

5. Validar login institucional o acceso temporal autorizado.

6. Ejecutar pruebas funcionales definidas.

## Diagramas de apoyo

### Diagrama de despliegue de Aurora

![Ilustración 1 de Guía de despliegue de Aurora](assets/diagrama_despliegue_aurora.png)

Figura. Diagrama de despliegue de Aurora.

## Anexo A. Paso a paso detallado para despliegue en máquina limpia

Este anexo complementa la guía existente sin reemplazar su contenido original. Incluye instrucciones operativas para instalar Docker, construir la imagen local de Aurora, configurar variables y entregar evidencias.

Fecha: 2026-06-01

### 1. Objeto

Esta guía explica el despliegue operativo de Aurora desde una máquina limpia hasta una aplicación publicada y validada. Está escrita como un paso a paso para una persona que recibe el servidor sin Docker instalado y necesita saber exactamente qué instalar, de dónde sale la imagen Docker, qué variables configurar y qué evidencias entregar.

El despliegue recomendado para Aurora es Docker Compose. Aurora se ejecuta como un único servicio que escucha internamente en `7860` y publica el puerto indicado por `HOST_PORT`, por defecto `443`.

```text
Aplicación web: https://<ip-o-dns-institucional>
API: https://<ip-o-dns-institucional>/api
Salud API: https://<ip-o-dns-institucional>/api/health
Salud Oracle: https://<ip-o-dns-institucional>/api/health/db
```

### 2. Qué se debe recibir antes de iniciar

Antes de entrar al servidor, la persona responsable del despliegue debe tener estos insumos:

| Insumo | Quién lo entrega | Observación |
| --- | --- | --- |
| IP o DNS del servidor | Infraestructura | Ejemplo: 10.10.10.20 o aurora.defensoria.gov.co. |
| Usuario SSH | Infraestructura | Ejemplo: deploy, ubuntu, admin o el usuario institucional asignado. |
| Clave SSH o llave privada | Infraestructura | No debe guardarse en el repositorio. |
| Permisos de administrador | Infraestructura | Se requiere sudo para instalar Docker y abrir puertos. |
| Código fuente de Aurora | Equipo técnico | Puede entregarse como .zip institucional o por repositorio autorizado. |
| Variables Oracle reales | DBA o administrador técnico | Incluye usuario, host, puerto, service name y esquema. |
| Variables de autenticación | Administrador Entra ID / Azure AD | Incluye tenant, client ID, dominios, grupos o roles si aplica. |
| URL institucional final | Infraestructura | Requiere DNS, proxy, HTTPS o publicación interna. |

Sin las variables reales de Oracle y autenticación no se debe hacer un despliegue productivo. La guía muestra dónde ponerlas, pero no inventa contraseñas, secretos ni datos de base de datos.

### 3. Abrir la conexión SSH al servidor

Desde Windows, abrir PowerShell.

Validar que el comando ssh existe:

```bash
ssh -V
```

Conectarse al servidor:

```bash
ssh <usuario>@<ip-o-dns-del-servidor>
```

Ejemplo:

```bash
ssh deploy@10.10.10.20
```

Si se usa una llave privada:

```bash
ssh -i "C:\ruta\a\llave.pem" <usuario>@<ip-o-dns-del-servidor>
```

Al entrar, validar quién es el usuario y en qué servidor quedó conectado:

```text
whoami
hostname
pwd
```

Evidencia sugerida: captura de pantalla donde se vea la conexión SSH abierta y el resultado de whoami y hostname.

### 4. Identificar el sistema operativo del servidor

Ejecutar:

```text
cat /etc/os-release
uname -m
```

El campo ID y VERSION_ID indican qué bloque de instalación usar:

| Resultado esperado | Bloque a usar |
| --- | --- |
| ID=ubuntu | Instalación Docker en Ubuntu |
| ID=debian | Instalación Docker en Debian |
| ID="rhel" o Red Hat Enterprise Linux | Instalación Docker en RHEL |
| ID="rocky" o ID="almalinux" | Usar el bloque RHEL como referencia y validar con Infraestructura |

La arquitectura debe ser compatible con las imágenes usadas por Aurora. Lo habitual es x86_64 o amd64.

### 5. Instalar Docker en máquina limpia

Aurora usa Docker Engine y Docker Compose v2. El comando correcto es docker compose, con espacio. No se debe usar docker-compose v1 salvo que Infraestructura lo exija expresamente.

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

`docker --version` muestra la versión de Docker Engine.

`docker compose version` muestra la versión de Docker Compose v2.

`systemctl status docker` aparece como `active (running)`.

`hello-world` descarga una imagen de prueba y confirma que Docker puede ejecutar contenedores.

Evidencia sugerida: captura o salida de docker --version, docker compose version y sudo docker run hello-world.

### 6. Preparar la carpeta de Aurora en el servidor

Crear una carpeta institucional para el despliegue:

```bash
sudo mkdir -p /opt/aurora
sudo chown -R "$USER":"$USER" /opt/aurora
cd /opt/aurora
```

En esta guía se usará /opt/aurora como ruta de ejemplo. Si Infraestructura exige otra ruta, usar esa ruta de forma consistente en todos los comandos.

### 7. Cargar el código fuente de Aurora

Aurora puede llegar al servidor de dos formas. Usar solo una.

### 7.1 Opción A: código fuente entregado como ZIP institucional

Desde Windows, ubicarse donde esté el archivo .zip y enviarlo al servidor con scp:

```bash
scp "C:\ruta\codigo_fuente_Aurora.zip" <usuario>@<ip-o-dns-del-servidor>:/opt/aurora/
```

Ejemplo:

```bash
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

```text
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

```text
ls -la Dockerfile docker-compose.yml .env.example backend frontend
```

### 7.3 Qué hacer si no existen los archivos esperados

Si Dockerfile, docker-compose.yml, .env.example, backend o frontend no aparecen, detener el despliegue y solicitar al equipo técnico un paquete completo del código fuente. Sin esos archivos no se puede construir la imagen de Aurora.

### 8. De dónde sale la imagen Docker de Aurora

No se descarga una imagen pública de Aurora desde Docker Hub.

La imagen se construye localmente en el servidor a partir del archivo Dockerfile incluido en el código fuente. El archivo docker-compose.yml define el nombre de la imagen:

```text
aurora-app:local
```

El servicio Docker Compose se llama:

```text
aurora
```

El Dockerfile usa como base:

```text
node:20.19-bookworm-slim
```

Durante la construcción, Docker descarga esa imagen base oficial de Node.js, instala dependencias, compila el frontend React/Vite, copia el resultado al backend Express, instala dependencias Python para cargas mensuales y deja la aplicación lista para ejecutarse en producción.

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
aurora-app local <id> <fecha> <tamaño>
```

### 9. Crear y configurar el archivo `.env`

Entrar a la carpeta raíz del proyecto, donde están Dockerfile y docker-compose.yml.

Crear el archivo real a partir del ejemplo:

```bash
cp .env.example .env
chmod 600 .env
```

Editarlo:

```text
nano .env
```

También puede usarse vi:

```text
vi .env
```

### 9.1 Plantilla mínima comentada

La estructura esperada es:

```dotenv
# Docker / HTTP
HOST_PORT=443
PORT=7860
NODE_ENV=production
ENABLE_STARTUP_WARMUP=true

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

# Directorio interno de usuarios
AUTH_USER_ACCESS_MODE=managed
AUTH_BOOTSTRAP_ADMIN_EMAILS=<correo-admin-inicial>
AUTH_USER_STORE_PATH=/app/backend/storage/auth/auth-users.json
AUTH_USER_IMPORT_MAX_MB=2
AUTH_USER_IMPORT_MAX_ROWS=5000
AUTH_USER_SYNC_REQUIRED=false

# LDAP alternativo
LDAP_ENABLED=false
LDAP_URL=
LDAP_DOMAIN=defensoria.gov.co
LDAP_ALLOWED_EMAIL_DOMAINS=defensoria.gov.co
LDAP_TIMEOUT_MS=8000

# Microsoft Entra ID / Azure AD
AZURE_AD_TENANT_ID=<tenant-id>
AZURE_AD_CLIENT_ID=<client-id>
AZURE_AD_ALLOWED_EMAIL_DOMAINS=defensoria.gov.co
AZURE_AD_REQUIRED_GROUP_IDS=
AZURE_AD_REQUIRED_APP_ROLES=

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
CARGUEBD_SKIP_ETL=false
CARGUEBD_MAX_FILE_MB=120
CARGUEBD_PUBLIC_ERROR_MAX_LENGTH=1000
CARGUEBD_REPAIR_REGISTRY_ON_START=false
CARGUEBD_CLEAR_REGISTRY_ON_START=false
CARGUEBD_ACTUACIONES_CLEANUP_DEFENSOR=PRUEBA PILOTO
```

### 9.2 Variables que normalmente sí cambian por ambiente

| Variable | Valor esperado | Quién la define |
| --- | --- | --- |
| HOST_PORT | Puerto publicado en el servidor. Por defecto 443. | Infraestructura |
| AUTH_JWT_SECRET | Secreto largo, aleatorio y privado. | Administrador técnico |
| AUTH_LOCAL_ADMIN_ENABLED | false en producción. | Administrador técnico |
| AZURE_AD_TENANT_ID | Tenant de Microsoft Entra ID. | Administrador Entra ID |
| AZURE_AD_CLIENT_ID | Client ID de la aplicación registrada. | Administrador Entra ID |
| AZURE_AD_ALLOWED_EMAIL_DOMAINS | Dominio permitido, por ejemplo defensoria.gov.co. | Administrador Entra ID |
| AZURE_AD_REQUIRED_GROUP_IDS | IDs de grupos requeridos, si la entidad lo usa. | Administrador Entra ID |
| AZURE_AD_REQUIRED_APP_ROLES | Roles requeridos, si la entidad lo usa. | Administrador Entra ID |
| ORACLE_USER | Usuario de conexión a Oracle. | DBA |
| ORACLE_PASSWORD | Contraseña Oracle. | DBA |
| ORACLE_HOST | Host o IP de Oracle. | DBA / Infraestructura |
| ORACLE_PORT | Normalmente 1521. | DBA |
| ORACLE_SERVICE_NAME | Service name Oracle. | DBA |
| ORACLE_SCHEMA | Esquema dueño o esquema funcional. | DBA |
| ORACLE_GESTION_ID_SEQUENCE | Secuencia Oracle si aplica al ambiente. | DBA / Equipo técnico |
| AURORA_CARGAS_DIR | Dentro de Docker se recomienda /app/backend/storage/cargas_bd. | Equipo técnico |
| CARGUEBD_ADMIN_ROLES | Roles autorizados para cargas. | Administrador funcional / Entra ID |
| AUTH_USER_ACCESS_MODE | `managed` en producción cuando se exige lista cerrada. | Seguridad / administrador funcional |
| AUTH_BOOTSTRAP_ADMIN_EMAILS | Administrador inicial; se retira después de estabilizar la gestión de usuarios. | Administrador funcional |
| LDAP_* | Proveedor alternativo por bind directo, si se habilita. | Active Directory / Infraestructura |

### 9.3 Generar un secreto JWT si no fue entregado

Si el administrador técnico autoriza generarlo en el servidor:

```text
openssl rand -hex 32
```

Copiar el resultado en:

```dotenv
AUTH_JWT_SECRET=<resultado-del-comando>
```

No enviar este secreto por chat ni incluirlo en actas, capturas públicas o repositorios.

### 9.4 Validar que el `.env` quedó guardado

Ejecutar:

```text
ls -l .env
grep -E '^(HOST_PORT|PORT|NODE_ENV|VITE_API_BASE_URL|AUTH_LOCAL_ADMIN_ENABLED|ORACLE_HOST|ORACLE_PORT|ORACLE_SERVICE_NAME|ORACLE_SCHEMA|AURORA_CARGAS_DIR)=' .env
```

No ejecutar comandos que impriman ORACLE_PASSWORD, AUTH_JWT_SECRET o contraseñas en pantalla si se van a tomar capturas.

### 10. Validar conectividad básica antes de construir

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

Si nc no existe:

```bash
sudo apt install -y netcat-openbsd
```

o en RHEL:

```bash
sudo dnf install -y nmap-ncat
```

Si esta prueba falla, no es un problema de Aurora todavía. Debe revisarse red, firewall, VPN, rutas o listener Oracle.

### 11. Construir y levantar Aurora

Desde la carpeta raíz del proyecto:

```text
pwd
ls -la Dockerfile docker-compose.yml .env
```

Construir la imagen:

```bash
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
NAME SERVICE STATUS
<proyecto>-aurora aurora Up
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

### 12. Validar puerto y salud de la aplicación

Validar el puerto publicado y el puerto interno:

```bash
ss -ltnp | grep -E ':(443|7860)' || true
```

Validar salud desde el servidor:

```bash
curl -k https://127.0.0.1:443/api/health
curl -k https://127.0.0.1:443/api/health/db
```

Resultado esperado para salud general:

```text
{"ok":true}
```

La validación de base de datos debe responder correctamente. Si /api/health funciona y /api/health/db falla, la aplicación está levantada pero hay un problema de variables Oracle, permisos, service name, red o firewall hacia Oracle.

Validar desde un equipo cliente con acceso a la red:

```bash
curl https://<ip-o-dns-institucional>/api/health
curl https://<ip-o-dns-institucional>/api/health/db
```

Abrir en navegador:

```text
https://<ip-o-dns-institucional>
```

Si desde el servidor funciona pero desde el equipo cliente no, revisar con Infraestructura:

Firewall del servidor.

Reglas de seguridad de la red.

VPN.

Proxy inverso.

DNS.

Publicación HTTPS institucional.

### 13. Comandos operativos diarios

| Acción | Comando |
| --- | --- |
| Ver estado | docker compose ps |
| Ver logs recientes | docker compose logs --tail=100 aurora |
| Ver logs en vivo | docker compose logs -f aurora |
| Reiniciar Aurora | docker compose restart aurora |
| Detener Aurora | docker compose down |
| Levantar Aurora | docker compose up -d |
| Reconstruir imagen | docker compose build --no-cache aurora |
| Reconstruir y levantar | docker compose up --build -d |
| Ver imagen local | docker images |
| Ver uso de disco Docker | docker system df |
| Validar API | curl http://127.0.0.1:7860/api/health |
| Validar Oracle | curl http://127.0.0.1:7860/api/health/db |

### 14. Actualizar Aurora a una nueva versión

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

Si la nueva versión llega por ZIP, subir el ZIP, descomprimirlo en una carpeta nueva y copiar o recrear el archivo .env con las variables reales del ambiente.

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

### 15. Evidencias sugeridas para entregar

Tomar capturas o guardar salidas de:

Conexión SSH al servidor.

`cat /etc/os-release`.

`docker --version`.

`docker compose version`.

`sudo docker run hello-world`.

Carpeta del proyecto con `Dockerfile`, `docker-compose.yml` y `.env.example`.

`docker compose build aurora` finalizado sin errores.

`docker compose ps` con el servicio `aurora` arriba.

`docker images | grep aurora-app`.

`curl http://127.0.0.1:7860/api/health`.

`curl http://127.0.0.1:7860/api/health/db`.

Navegador cargando Aurora.

Validación desde equipo cliente o evidencia de solicitud a Infraestructura si falta publicación de red.

No incluir capturas donde se vean contraseñas, AUTH_JWT_SECRET, ORACLE_PASSWORD o llaves privadas.

### 16. Problemas comunes

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| docker: command not found | Docker no está instalado. | Ejecutar el bloque de instalación según el sistema operativo. |
| docker compose no existe | Falta Docker Compose Plugin. | Instalar docker-compose-plugin. |
| Permiso denegado al ejecutar Docker | Usuario sin permisos para Docker. | Usar sudo docker ... o pedir a Infraestructura agregar el usuario al grupo docker. |
| Falla al descargar node:20.19-bookworm-slim | Sin internet o Docker Hub bloqueado. | Pedir salida a internet o repositorio espejo institucional. |
| docker compose build falla en npm ci | Sin acceso a npm o dependencias. | Validar salida a https://registry.npmjs.org/. |
| docker compose ps muestra Restarting | La aplicación falla al iniciar. | Revisar docker compose logs --tail=200 aurora. |
| /api/health no responde | Contenedor caído o puerto no publicado. | Revisar docker compose ps, logs y ss -ltnp. |
| /api/health funciona pero navegador remoto no abre | Bloqueo de red externo al contenedor. | Revisar firewall, proxy, DNS o VPN. |
| /api/health/db falla | Problema con Oracle. | Revisar ORACLE_*, service name, permisos, firewall y conectividad al puerto 1521. |
| Login falla | Variables de autenticación incompletas. | Revisar AZURE_AD_*, roles, grupos, dominios permitidos y AUTH_JWT_SECRET. |
| Cargas mensuales no funcionan | Roles, Python o carpeta de cargas. | Revisar CARGUEBD_*, AURORA_CARGAS_DIR y logs del backend. |

### 17. Recomendaciones de seguridad

No subir `.env` a Git.

No enviar contraseñas por chat.

No tomar capturas donde aparezcan secretos.

Mantener `AUTH_LOCAL_ADMIN_ENABLED=false` en producción.

Usar HTTPS para la URL institucional definitiva.

Restringir el puerto `7860` o publicarlo detrás de proxy inverso según política de Infraestructura.

Documentar fecha, responsable, versión desplegada y resultado de pruebas.

### 18. Referencias técnicas

Docker Engine para Ubuntu: `https://docs.docker.com/engine/install/ubuntu/`

Docker Engine para Debian: `https://docs.docker.com/engine/install/debian/`

Docker Engine para RHEL: `https://docs.docker.com/installation/rhel/`

Docker Compose Plugin para Linux: `https://docs.docker.com/compose/install/linux/`

## Actualización 2026-06-01 - Operación del servicio Aurora

El despliegue institucional recomendado usa Docker Compose. En este modo, Docker Compose es el mecanismo para subir, bajar, reiniciar y validar Aurora. PM2 no se ejecuta dentro del contenedor y solo aplica como alternativa Node.js tradicional cuando el servidor no usará Docker.

### Operación recomendada con Docker Compose

### Subir Aurora con Docker Compose

```bash
cd /opt/aurora/<carpeta-del-proyecto>
docker compose up -d
docker compose ps
curl http://127.0.0.1:7860/api/health
```

### Bajar Aurora con Docker Compose

```bash
cd /opt/aurora/<carpeta-del-proyecto>
docker compose down
docker compose ps
ss -ltnp | grep ':7860' || true
```

### Pausar sin remover contenedor

docker compose stop aurora

### Volver a iniciar contenedor pausado

docker compose start aurora

### Reiniciar Aurora

```bash
docker compose restart aurora
docker compose logs --tail=100 aurora
curl http://127.0.0.1:7860/api/health
```

### Reconstruir después de cambios

docker compose up --build -d

### Reconstrucción limpia

```bash
docker compose build --no-cache aurora
docker compose up -d
```

El archivo docker-compose.yml define restart: unless-stopped. Por eso, si Docker queda habilitado al arranque del sistema operativo, Aurora debe volver a levantarse después de reiniciar el servidor.

```bash
sudo systemctl is-enabled docker
sudo systemctl status docker --no-pager
sudo systemctl enable --now docker
```

### Uso alternativo de PM2

PM2 es válido únicamente para operación Node.js directa, sin Docker. Este camino puede usarse para diagnóstico, pruebas controladas o por decisión explícita de Infraestructura. En operación PM2, ecosystem.config.cjs inicia backend/index.js con PORT=7860 y carga variables desde el .env de la raíz mediante DOTENV_CONFIG_PATH=../.env.

| Acción | Comando |
| --- | --- |
| Subir servicio Node.js con PM2 | npm run service:start |
| Ver estado | npm run service:status |
| Ver logs | npm run service:logs |
| Reiniciar servicio | npm run service:restart |
| Detener servicio | npm run service:stop |
| Eliminar proceso PM2 | npm run service:delete |

Para persistir PM2 después de reiniciar el servidor:

```bash
npx pm2 startup
npx pm2 save
```

La salida de npx pm2 startup puede pedir ejecutar un comando con sudo. Ese comando debe revisarlo y ejecutarlo la persona administradora del servidor.

## Controles finales de la versión vigente

Antes de construir:

```bash
npm ci
npm --prefix backend ci
npm --prefix frontend ci
npm run qa:smoke
npm run qa:encoding
npm audit
npm --prefix backend audit
npm --prefix frontend audit
docker compose config
```

El despliegue conserva los volúmenes `aurora_auth_users` y `aurora_cargas_bd`. No se utiliza `docker compose down -v` durante una actualización ordinaria. El directorio `backend/certs` se monta en modo solo lectura y solo contiene certificados del ambiente; el repositorio no transporta llaves privadas productivas.

Después de desplegar se validan `/api/health`, `/api/health/db`, `/api/auth/config`, login, aviso de tratamiento de datos, roles `user`, `pag`, `admin` y cargas, consulta, búsqueda de defensor con caracteres heredados, guardado, PDF, formatos, usuarios autorizados, manual interactivo y persistencia después de recrear el contenedor.

La reversión usa la imagen o etiqueta anterior y conserva volúmenes. Si la versión incluye cambios Oracle, el DBA ejecuta el plan de reversión acordado. Los logs y la identificación exacta de la versión se preservan como evidencia.
