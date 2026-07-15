# Aurora

Aurora es una aplicación web institucional para apoyar la consulta, registro y seguimiento de atención jurídica de personas privadas de la libertad en la Dirección Nacional de Defensoría Pública.

La solución se compone de un frontend React/Vite y un backend Node.js/Express. Para despliegue institucional se recomienda ejecutar ambos componentes en un único contenedor mediante Docker Compose.

## Alcance del Repositorio

Este repositorio contiene el código fuente requerido para compilación, despliegue y operación técnica de Aurora:

- `frontend/`: aplicación web React/Vite.
- `backend/`: API Express, autenticación, rutas funcionales y acceso a Oracle.
- `scripts/cargas_bd/`: scripts Python para cargas mensuales hacia staging/ETL.
- `Dockerfile`: construcción del contenedor único.
- `docker-compose.yml`: definición de despliegue.
- `.env.example`: plantilla de variables de entorno.

La documentación formal de entrega no se versiona en este repositorio. Debe gestionarse por el canal institucional definido para la entrega documental.

## Cambios Incluidos en Esta Versión

Esta versión consolida los ajustes funcionales y de rendimiento aplicados después del último despliegue publicado:

- Historial de actuaciones: se corrige la aparición temporal de una actuación duplicada o "fantasma" al guardar una actuación inicial, conservando la lógica de consulta y actualización existente.
- Consolidado PDF: al generar el consolidado del caso, Aurora mantiene la apertura de la vista de impresión y además descarga automáticamente un archivo PDF del consolidado.
- PAG - Asignación de casos de condenados: se optimiza la interacción de la tabla y del selector de defensor para reducir congelamientos al seleccionar casos o escribir nombres de defensores.
- Filtros de condenados: las consultas filtradas usan una ruta rápida que evita conteos exactos costosos durante la interacción. Cuando hay más resultados que el límite mostrado, la interfaz lo informa y solicita precisar los filtros.
- Manual Interactivo: la pestaña queda oculta para esta entrega porque aún no hay video disponible. El componente se conserva y puede reactivarse cambiando `manualInteractivo` a `true` en `frontend/src/config/featureFlags.js`.

## Despliegue Recomendado

Requisitos mínimos:

- Docker instalado en el servidor de aplicaciones.
- Docker Compose disponible como `docker compose`.
- Conectividad desde el servidor hacia Oracle.
- Archivo `.env` creado a partir de `.env.example`.
- Puerto publicado disponible, por defecto `443`.

Ejemplo de despliegue:

```bash
cp .env.example .env
# editar .env con valores reales de ambiente
docker compose up --build -d
docker compose ps
docker compose logs -f aurora
```

El servicio publica frontend y backend en el mismo origen. La API queda disponible bajo `/api`.

Para operación diaria con Docker Compose:

```bash
docker compose up -d          # subir Aurora
docker compose down           # bajar Aurora
docker compose restart aurora # reiniciar Aurora
docker compose ps             # ver estado
docker compose logs -f aurora # ver logs
```

Docker Compose es el mecanismo recomendado para producción institucional. PM2 solo queda como alternativa tradicional cuando no se use Docker y se ejecute Node.js directamente:

```bash
npm run service:start
npm run service:status
npm run service:stop
```

## Validación de Servicio

Desde el servidor:

```bash
curl http://127.0.0.1:7860/api/health
curl http://127.0.0.1:7860/api/health/db
```

Desde red autorizada o VPN, usar la IP o URL asignada por infraestructura:

```text
https://<IP_O_HOST_INSTITUCIONAL>
https://<IP_O_HOST_INSTITUCIONAL>/api/health
```

`localhost` y `127.0.0.1` solo aplican dentro del servidor o mediante túnel SSH local.

Para una guía detallada de reunión con TICS e infraestructura, ver:

```text
VALIDACION_DESPLIEGUE_TICS.md
```

## Configuración Principal

Las variables se definen en `.env`. No se deben versionar credenciales, secretos ni archivos `.env` reales.

Variables principales:

- `HOST_PORT`: puerto publicado por Docker, por defecto `443`.
- `PORT`: puerto interno del servicio, por defecto `7860`.
- `AUTH_JWT_SECRET`: secreto para tokens de sesión Aurora.
- `AZURE_AD_TENANT_ID`: tenant institucional de Microsoft Entra ID.
- `AZURE_AD_CLIENT_ID`: identificador de la aplicación registrada.
- `AZURE_AD_REQUIRED_GROUP_IDS`: grupos permitidos, si aplica.
- `AZURE_AD_REQUIRED_APP_ROLES`: roles permitidos, por ejemplo `admin,user`.
- `AZURE_AD_ADMIN_GROUP_IDS`: grupos de Entra ID que reciben rol interno `admin`, si aplica.
- `AUTH_USER_ACCESS_MODE`: `open` permite ingresar a usuarios validos por Azure/dominio; `managed` exige que el correo este habilitado en la administracion interna de Aurora.
- `AUTH_BOOTSTRAP_ADMIN_EMAILS`: correos separados por coma que reciben rol `admin` para administrar usuarios desde Aurora.
- `AUTH_USER_STORE_PATH`: ruta opcional del archivo JSON local de usuarios autorizados.
- `LDAP_ENABLED`, `LDAP_URL`, `LDAP_DOMAIN`: habilitan login LDAP por bind directo del usuario contra Active Directory.
- `LDAP_ALLOWED_EMAIL_DOMAINS`: dominios permitidos para usuarios LDAP.
- `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_HOST`, `ORACLE_PORT`, `ORACLE_SERVICE_NAME`: conexión Oracle.
- `CARGUEBD_ADMIN_ROLES`: roles autorizados para operar cargas mensuales.

## Roles

Aurora contempla dos perfiles funcionales principales:

- `user`: usuario funcional con acceso a módulos ordinarios de consulta, formularios, asignaciones, reportes y descargas.
- `admin`: usuario administrador con acceso adicional a administración y módulo de cargas mensuales.

La asignación institucional de roles debe realizarse en Microsoft Entra ID mediante grupos o app roles. Azure DevOps se usa para control de código fuente; no reemplaza el control de acceso funcional de la aplicación.

## Cargas Mensuales

El módulo de cargas permite procesar archivos `.xlsx` para staging y ejecución ETL según la configuración del ambiente.

Los archivos de carga, evidencias, logs operativos y datos personales no deben subirse al repositorio. El contenedor usa un volumen persistente para almacenamiento operativo:

```text
aurora_auth_users:/app/backend/storage/auth
aurora_cargas_bd:/app/backend/storage/cargas_bd
```

`aurora_auth_users` conserva la lista interna de usuarios autorizados cuando `AUTH_USER_ACCESS_MODE=managed`.

Si el historial de cargas queda corrupto o se requiere limpiar la tabla operativa de cargas en un despliegue, el backend puede repararlo al arrancar:

```env
CARGUEBD_REPAIR_REGISTRY_ON_START=true
```

Para limpiar todo el historial visual una sola vez, conservando un respaldo `.bak` del archivo anterior:

```env
CARGUEBD_CLEAR_REGISTRY_ON_START=true
```

Después del primer arranque exitoso, retire la bandera de limpieza o déjela en `false`.

## Pruebas Técnicas

Comandos útiles:

```bash
npm --prefix backend test
npm --prefix frontend run test
npm --prefix frontend run build
```

Pruebas específicas disponibles:

```bash
npm --prefix frontend run test -- estadoActuaciones.rules.test.ts evaluateAuroraRules.test.ts
npm --prefix frontend run test -- pwaConfig.test.ts
```

Validación recomendada antes de entregar código fuente o construir imagen Docker:

```bash
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend run build
docker compose config
```

## Entrega de Código

Para una entrega limpia del repositorio:

- No incluir `node_modules/`.
- No incluir `dist/` ni salidas de compilación.
- No incluir `.env` ni secretos.
- No incluir documentación formal de entrega.
- No incluir archivos Excel, evidencias funcionales ni respaldos operativos.

El archivo `.gitignore` mantiene estas exclusiones para que el repositorio contenga únicamente el código y la configuración base necesaria para despliegue.
