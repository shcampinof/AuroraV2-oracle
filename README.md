# Aurora

Aurora es una aplicación web institucional para apoyar la consulta, registro y seguimiento de atención jurídica de personas privadas de la libertad en la Dirección Nacional de Defensoría Pública.

Fecha de actualización técnica: 2026-07-30.

La solución se compone de un frontend React/Vite y un backend Node.js/Express. Para despliegue institucional se recomienda ejecutar ambos componentes en un único contenedor mediante Docker Compose.

## Alcance del Repositorio

Este repositorio contiene el código fuente requerido para compilación, despliegue y operación técnica de Aurora:

- `frontend/`: aplicación web React/Vite.
- `backend/`: API Express, autenticación, rutas funcionales y acceso a Oracle.
- `scripts/cargas_bd/`: scripts Python para cargas mensuales hacia staging/ETL.
- `Dockerfile`: construcción del contenedor único.
- `docker-compose.yml`: definición de despliegue.
- `.env.example`: plantilla de variables de entorno.

La documentación local versionada comprende este README, la lista de validación para TICS, la guía operativa de despliegue y los README específicos de frontend y cargas. Los entregables Word/PDF, diagramas, evidencias e insumos institucionales se gestionan por el canal documental correspondiente y no se versionan.

## Capacidades Vigentes

La aplicación proporciona actualmente:

- Historial de actuaciones con una fila inicial pendiente cuando el PPL aún no tiene actuaciones, actualización de la última actuación disponible y control para no abrir una actuación adicional mientras la anterior siga incompleta desde la pregunta 29.
- Consolidado del caso en vista de impresión y descarga automática en PDF.
- Consulta de usuarios asignados bajo demanda, filtros precargados, caché temporal y paginación de 25 registros.
- Búsqueda de defensores tolerante a tildes y secuencias de codificación dañadas; cuando existe cédula de defensor se prioriza el nombre canónico del catálogo Oracle.
- Módulo PAG restringido al rol `pag`, con asignación y reasignación masiva, creación de defensores, filtros de categorización y administración de accesos PAG para cuentas que también tienen rol `admin`.
- Administración de usuarios autorizados individual o mediante CSV, con vista previa, detección de correos inválidos, duplicados y existentes.
- Aviso de tratamiento de datos obligatorio después de autenticar; rechazarlo cierra la sesión.
- Manual Interactivo habilitado con tres tutoriales locales incluidos en el código fuente y en la imagen Docker.
- Aplicación web instalable con service worker, caché del shell y cola limitada para escrituras sin conexión. La cola se vincula al usuario autenticado y se descarta al cerrar o cambiar de sesión.
- Depuración administrativa controlada de actuaciones ficticias y sus asignaciones activas, con confirmación de conteos, transacción y auditoría.

## Integraciones Vigentes

- Oracle mediante `node-oracledb`, pool compartido y consultas parametrizadas.
- Microsoft Entra ID mediante MSAL en el navegador y validación JWKS/RS256 en el backend.
- Active Directory por LDAP/LDAPS como alternativa de autenticación directa.
- SharePoint para los enlaces institucionales de la Caja de Herramientas.
- Python y `python-oracledb` para cargas mensuales PONAL, SISIPEC y Aurora 1.0.
- Docker Compose como mecanismo principal de empaquetado, persistencia y operación; PM2 como alternativa para Node directo.

## Despliegue Recomendado

Requisitos mínimos:

- Docker instalado en el servidor de aplicaciones.
- Docker Compose disponible como `docker compose`.
- Conectividad desde el servidor hacia Oracle.
- Archivo `.env` creado a partir de `.env.example`.
- Puerto publicado disponible, por defecto `443`.

Para ejecución directa, pruebas o PM2 se requiere Node.js `20.19` o superior dentro de la línea compatible indicada por las dependencias. La imagen Docker ya fija Node `20.19`.

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
- `AZURE_AD_REQUIRED_APP_ROLES`: roles permitidos, por ejemplo `admin,user,pag`.
- `AZURE_AD_ADMIN_GROUP_IDS`: grupos de Entra ID que reciben rol interno `admin`, si aplica.
- `AUTH_USER_ACCESS_MODE`: `open` permite ingresar a usuarios validos por Azure/dominio; `managed` exige que el correo este habilitado en la administracion interna de Aurora.
- `AUTH_BOOTSTRAP_ADMIN_EMAILS`: correos separados por coma que reciben rol `admin` para administrar usuarios desde Aurora.
- `AUTH_USER_STORE_PATH`: ruta opcional del archivo JSON local de usuarios autorizados.
- `AUTH_USER_IMPORT_MAX_MB`, `AUTH_USER_IMPORT_MAX_ROWS`: limites para la importacion CSV de usuarios autorizados.
- `AUTH_USER_SYNC_REQUIRED`: si es `true`, bloquea el ingreso cuando no puede sincronizarse el directorio interno.
- `AURORA_VIDEOS_DIR`: ubicación opcional del catálogo de tutoriales; la imagen usa `/app/backend/tutorial-videos`.
- `LDAP_ENABLED`, `LDAP_URL`, `LDAP_DOMAIN`: habilitan login LDAP por bind directo del usuario contra Active Directory.
- `LDAP_ALLOWED_EMAIL_DOMAINS`: dominios permitidos para usuarios LDAP.
- `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_HOST`, `ORACLE_PORT`, `ORACLE_SERVICE_NAME`: conexión Oracle.
- `CARGUEBD_ADMIN_ROLES`: roles autorizados para operar cargas mensuales.
- `AURORA_CARGAS_DIR`: almacenamiento persistente de archivos, registro y logs de cargas.
- `AURORA_CARGAS_TMP_DIR`: directorio temporal opcional para archivos recién recibidos.
- `CARGUEBD_ACTUACIONES_CLEANUP_DEFENSOR`: único defensor permitido para la depuración administrativa controlada.

## Roles

Aurora contempla tres perfiles funcionales:

- `user`: usuario funcional con acceso a módulos ordinarios de consulta, formularios, reportes y descargas.
- `admin`: usuario administrador con acceso adicional a administración y módulo de cargas mensuales.
- `pag`: acceso al módulo PAG para asignar o reasignar casos y administrar defensores. Puede combinarse con `admin` para gestionar los accesos PAG desde el mismo módulo.

La asignación institucional de roles debe realizarse en Microsoft Entra ID mediante grupos o app roles. Azure DevOps se usa para control de código fuente; no reemplaza el control de acceso funcional de la aplicación.

## Cargas Mensuales

El módulo de cargas permite procesar archivos `.xlsx` para staging y ejecución ETL según la configuración del ambiente.

Los archivos de carga, evidencias, logs operativos y datos personales no deben subirse al repositorio. El contenedor usa un volumen persistente para almacenamiento operativo:

```text
aurora_auth_users:/app/backend/storage/auth
aurora_cargas_bd:/app/backend/storage/cargas_bd
```

`aurora_auth_users` conserva la lista interna de usuarios autorizados cuando `AUTH_USER_ACCESS_MODE=managed`.

Después de cada ETL exitoso, Aurora recalcula y persiste `ACCION_REALIZAR` en la
última gestión de cada situación activa. El cargue permanece en ejecución hasta
que concluye esta reconciliación. Luego se invalidan las cachés del backend y
los clientes abiertos detectan la nueva versión de datos para actualizar sus
filtros y consultas sin reiniciar toda la aplicación.

Los videos institucionales de `backend/tutorial-videos/` se versionan y se copian dentro de la imagen. No requieren un volumen Docker. Si el ambiente necesita sustituir el catálogo completo, puede montar una carpeta de solo lectura y apuntar `AURORA_VIDEOS_DIR` a ella.

El historial se conserva por 2 dias y hasta 50 registros por defecto. Ambos limites pueden ajustarse con `CARGUEBD_REGISTRY_RETENTION_DAYS` (1 a 30) y `CARGUEBD_REGISTRY_MAX_RECORDS` (1 a 200). Los errores se limitan antes de persistir y el archivo se reemplaza de forma atomica.

Si `cargas.json` esta truncado o usa el formato anterior, el backend lo respalda y recupera automaticamente al arrancar; ya no depende de una bandera. `CARGUEBD_REPAIR_REGISTRY_ON_START` se mantiene solo por compatibilidad con despliegues anteriores.

Para limpiar todo el historial visual una sola vez, conservando un respaldo `.bak` del archivo anterior:

```env
CARGUEBD_CLEAR_REGISTRY_ON_START=true
```

Después del primer arranque exitoso, retire la bandera de limpieza o déjela en `false`.

Estas variables se propagan al contenedor mediante `docker-compose.yml`. La API limita por defecto a 1000 caracteres el mensaje de error publicado; `CARGUEBD_PUBLIC_ERROR_MAX_LENGTH` permite ajustarlo entre 100 y 2000 caracteres.

## Pruebas Técnicas

Comandos útiles:

```bash
npm ci
npm --prefix backend ci
npm --prefix frontend ci
npm run qa:smoke
npm run qa:encoding
npm audit
npm --prefix backend audit
npm --prefix frontend audit
```

Pruebas específicas disponibles:

```bash
npm --prefix frontend run test -- estadoActuaciones.rules.test.ts evaluateAuroraRules.test.ts
npm --prefix frontend run test -- pwaConfig.test.ts
npm --prefix backend run audit:homologation -- --tipo=all --limit=100
RUN_ORACLE_INTEGRATION=true npm --prefix backend run test:oracle:homologation
RUN_ORACLE_INTEGRATION=true npm --prefix backend run test:oracle:assigned-users
```

La auditoría de homologación es de solo lectura: prioriza centros y acciones históricas por número de registros, calcula cobertura y genera sugerencias que requieren aprobación humana. El procedimiento para incorporar alias está en `backend/catalogs/README.md`.

Validación recomendada antes de entregar código fuente o construir imagen Docker:

```bash
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend run test
npm --prefix frontend run build
docker compose config
docker compose build aurora
```

## Entrega de Código

Para una entrega limpia del repositorio:

- No incluir `node_modules/`.
- No incluir `dist/` ni salidas de compilación.
- No incluir `.env` ni secretos.
- No incorporar `backend/storage/` a Git ni a las capas Docker; contiene usuarios, cargas y logs operativos.
- Conservar la documentación Markdown técnica versionada; mantener fuera entregables binarios, evidencias y documentos institucionales no destinados al repositorio.
- No incluir archivos Excel, evidencias funcionales ni respaldos operativos.

El archivo `.gitignore` mantiene estas exclusiones para que el repositorio contenga únicamente el código y la configuración base necesaria para despliegue.
