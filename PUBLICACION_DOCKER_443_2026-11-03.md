# Publicación de Aurora — 3 de noviembre de 2026

## Ajuste de negrita en reportes — 06:34, hora de Bogotá

Publicado en `docker-443`: las cuatro indicaciones «obligatoria/obligatorio» del
reporte usan peso de fuente 400. Los títulos conservan el peso 800. Se verificó
el estilo calculado en el navegador de la candidata y del servicio publicado;
los campos siguen siendo obligatorios, ERON sigue siendo opcional y el checkbox
conserva texto, estilo y selección.

Imagen actual en `aurora-app:local` y `aurora-app:docker-443`:
`sha256:7a46db593ea78c04d28fb376a8b273a8f1eeaadd9eb984ba79ee22d22e58ae4c`.
Estado final **healthy**, cero reinicios. Lint, seis pruebas del reporte y
compilación con Node 24.22.2 aprobados. Seis comprobaciones en la candidata y
siete en el servicio publicado aprobadas, incluyendo generación y descarga real
del PDF en este último, sin errores JavaScript ni solicitudes de escritura.
Los 3.618 archivos del manifiesto y los 13 archivos del frontend servidos por
HTTPS coinciden por SHA256. Configuración, puertos, certificados y volúmenes
conservados; directorio de usuarios sin cambios de contenido.

Respaldo inmediato: `aurora-app:before-report-style-20261103-063300` (imagen
`sha256:8628fcc697d02bb45deeb4665eab49e09dc1ce2b08b068bd5647adbf50bd54d2`).
Para revertir únicamente este ajuste, etiquetar ese respaldo como
`aurora-app:local` y `aurora-app:docker-443`, y ejecutar
`docker compose up -d --no-build --no-deps --wait --wait-timeout 120 aurora`.
Evidencias: `/tmp/aurora-report-style-20261103-063300`, con acceso restringido.
La candidata temporal fue retirada después de verificar la publicación.

## Actualización visual — 06:29, hora de Bogotá

Publicados los dos ajustes solicitados en el entorno de pruebas `docker-443`:
se retiran de la tabla de usuarios las columnas Cédula PAG y Regional PAG;
el reporte identifica regional, defensor y ambas fechas como obligatorios,
y establecimiento (ERON) como opcional. El checkbox conserva su presentación.
El registro PAG sigue incluyendo cédula y regional, y las reglas del reporte
se conservan.

Imagen actual en `aurora-app:local` y `aurora-app:docker-443`:
`sha256:8628fcc697d02bb45deeb4665eab49e09dc1ce2b08b068bd5647adbf50bd54d2`.
El servicio quedó **healthy**, con cero reinicios. La imagen se deriva de la
publicación inicial y reemplaza exclusivamente el frontend compilado. Se
verificaron por SHA256 los 3.618 archivos del manifiesto, conservando los archivos
del backend, y los 13 archivos del frontend servidos por HTTPS.

Lint, 27 pruebas relacionadas en cuatro archivos y compilación con Node 24.22.2:
aprobados. La candidata y el servicio publicado aprobaron cada uno 23
comprobaciones de API/navegador: seis columnas en la tabla, apertura y cancelación
del registro PAG con sus campos, indicadores de obligatoriedad, checkbox,
consulta de ficha, navegación, generación y descarga de PDF, filtro inválido y
tutoriales. Cero errores JavaScript y cero solicitudes de escritura en estas
comprobaciones. Salud, conexión Oracle y configuración de acceso respondieron
HTTP 200. Se conservaron configuración, puertos, certificados y volúmenes;
el hash del directorio de usuarios permaneció igual. SISIPEC continúa bajo la
gestión del responsable de Oracle, según la aclaración registrada más abajo.

Respaldo inmediato: `aurora-app:before-visual-20261103-062442`, correspondiente a
la imagen inicial `sha256:b5f7f50be66542c90f4191a09600c88376358b4699efbd4a5511d7bfec6fc6ff`.
Para revertir esta actualización visual:

```sh
docker image tag aurora-app:before-visual-20261103-062442 aurora-app:local
docker image tag aurora-app:before-visual-20261103-062442 aurora-app:docker-443
docker compose up -d --no-build --no-deps --wait --wait-timeout 120 aurora
```

Evidencias y manifiestos: `/tmp/aurora-visual-20261103-062442`, con acceso
restringido. La candidata temporal se retiró después de verificar la publicación.

## Publicación inicial — 06:06, hora de Bogotá

Publicada a las **06:06, hora de Bogotá**, en `aurora-aurora-1`, por HTTPS 443.
Estado final: **healthy**, cero reinicios. Etiquetas `aurora-app:local` y
`aurora-app:docker-443`:

`sha256:b5f7f50be66542c90f4191a09600c88376358b4699efbd4a5511d7bfec6fc6ff`.

Incluye la versión revisada el 30 de octubre: revocación de usuarios eliminados,
comprobación del directorio en modo administrado, filtro exacto del estado actual
y conservación de pendientes sin conexión ante 401/403, con aviso y recuperación.
Los 208 archivos del manifiesto revisado siguen coincidiendo por SHA256. Los
campos abiertos de los bloques 1 y 2 permanecen fuera de esta entrega.

## Imagen y conservación de datos

Construcción incremental sobre la imagen anterior, con el binario oficial de
Node **24.22.2**, verificado por SHA256, y npm **11.19.1**. Las dependencias de
backend se instalaron desde su archivo de bloqueo con `npm ci --omit=dev`.
Las once distribuciones Python de la imagen base ya coincidían exactamente con
`requirements.production.txt`; se comprobaron y conservaron. El frontend se
recompiló con Node 24 y sus paquetes instalados coinciden con el archivo de bloqueo.

Se liberaron 1,19 GB de caché regenerable de construcción, sin eliminar imágenes
de reversión ni volúmenes. Se conservaron los certificados y los tres volúmenes
de usuarios, cargas y reportes. El archivo de usuarios publicado conserva el
mismo SHA256, con sus dos identidades. No había cargas pendientes o en ejecución
antes de recrear el servicio.

La aplicación arranca mediante su entrypoint y ejecuta Node con UID 1000.
Se verificaron 3.618 archivos y cuatro enlaces simbólicos de la imagen, y los
13 archivos del frontend servidos por HTTPS. La candidata HTTPS validó la cadena
del certificado y el nombre `aurora.defensoria.gov.co`; esta comprobación local
no acredita la resolución DNS externa.

## Validaciones

- Lint, 401 pruebas frontend en 29 archivos, compilación y 22 suites backend:
  aprobados. Las 22 suites también se ejecutaron dentro de la imagen candidata.
- UTF-8 y `git diff --check`: aprobados.
- Oracle desde la imagen: 65 escenarios y 459 comprobaciones de estados, sin fallos.
- Python en la imagen: 28 pruebas descubiertas, 23 aprobadas y cinco integraciones
  omitidas en la ejecución ordinaria. Las cinco se ejecutaron aparte contra Oracle
  y aprobaron con rollback.
- Navegador con service worker activo: nueve comprobaciones de pendientes,
  sesión vencida, usuario eliminado, cambios de cuenta, pérdida/restauración del
  rol DNDP, reintentos concurrentes y límite de cola. Dos ejecuciones completas
  posteriores aprobaron y verificaron su limpieza. El primer intento agotó la
  espera de una reconexión automática; ese intento no se contabiliza como aprobado
  y sus resultados se conservan junto con la repetición diagnóstica.
- Candidata y servicio publicado: 20 comprobaciones de API/navegador, con listado,
  ficha, historial, módulos accesibles, consulta del formulario, reporte regional,
  PDF real, rechazo de un filtro inválido y tres tutoriales. Cero errores JavaScript
  y cero solicitudes de escritura en estas comprobaciones.
- Servicio publicado: HTTP 200 en `/`, `/api/health`, `/api/health/db` y
  `/api/auth/config`. Conexión Oracle comprobada.

La auditoría de dependencias de producción devuelve **cero vulnerabilidades**
en backend y frontend. La auditoría completa del frontend del 3 de noviembre
reporta **seis avisos moderados** en la cadena de herramientas de desarrollo de
ESLint/minimatch, sin corrección automática disponible dentro de sus rangos.
Por ello `qa:release` termina con código 1 en esa auditoría, después de aprobar
las verificaciones funcionales anteriores. Los paquetes de ESLint no se incluyen
en la imagen publicada. No se modificaron dependencias con `--force`.

Las candidatas temporales de HTTP y HTTPS se retiraron al finalizar. Las
escrituras de integración se limitaron a fixtures sintéticos, con rollback o
eliminación comprobada; no se ejecutó una carga mensual ni una depuración real.

## SISIPEC

`PRC_CARGA_SISIPEC` permanece **VALID**, con última modificación registrada el
28 de octubre de 2026. No se aplicó DDL durante esta publicación.

El diagnóstico de `install-sisipec-reassignment.js` se detiene con
«No se encontro el ancla deteccion de cambios»: la variante instalada no es la
que reconoce el transformador del repositorio. Se explicó al usuario y se
conservó el procedimiento actual al publicar la aplicación.

**Aclaración del usuario del 3 de noviembre de 2026:** el responsable de Oracle
ya tiene actualizado el procedimiento del entorno de pruebas. Ese responsable
ejecuta los cambios de base de datos y dará las instrucciones para implementarlos
en producción tal como están en pruebas. No se requiere solicitar la ubicación
del SQL ni queda una actualización del procedimiento pendiente de nuestra parte
para este despliegue de pruebas, que se mantiene tal como fue publicado.

El diagnóstico anterior describe una incompatibilidad del transformador del
repositorio con la variante instalada; por sí solo no demuestra que el
procedimiento esté desactualizado. La confirmación de que está actualizado
procede del usuario y del responsable de Oracle.

SHA256 de la fuente instalada:
`4835d42244e06e413fa97f26212e79dfe6e904f00c9305761d7715d0416cc427`.

## Reversión y evidencias

Imagen anterior conservada como `aurora-app:before-publish-20261103`:
`sha256:3a0d3e67804cab15aeffa0569d6c92d51842104a341400f7d4983bb910b5a898`.

```sh
docker image tag aurora-app:before-publish-20261103 aurora-app:local
docker image tag aurora-app:before-publish-20261103 aurora-app:docker-443
docker compose up -d --no-build --no-deps --wait --wait-timeout 120 aurora
```

No retirar los volúmenes al revertir. La configuración y el respaldo del
directorio de usuarios se guardaron con acceso restringido. Logs, resultados,
manifiestos y Dockerfile de publicación: `/tmp/aurora-deploy-20261103`.
El PDF de comprobación y los archivos de configuración privados están protegidos
y no se agregan al repositorio.
