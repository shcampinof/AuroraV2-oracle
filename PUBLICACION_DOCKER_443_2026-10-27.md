# Publicación de Aurora — 27 de octubre de 2026

Los cambios presentes en el espacio de trabajo se publicaron en
`aurora-aurora-1`, por HTTPS en el puerto 443. Verificación realizada alrededor
de las 08:42, hora de Bogotá. El contenedor quedó `healthy`, sin reinicios.

## Cambios incluidos

- Registro y asociación de usuarios PAG con nombre, cédula, correo y regional.
- Depuración selectiva de actuaciones de prueba, con paginación y conservación
  de las asignaciones.
- Razón del cierre manual del caso, validación en servidor y formulario, y
  protección del borrador durante el autoguardado.
- Comparación de regionales mediante el catálogo SISIPEC y reconocimiento del
  cierre automático por cambio de regional.
- Retiro del reporte general de la navegación y de los avisos de cambio de
  situación en las pantallas modificadas.

## Pruebas

- `npm run qa:smoke`: lint, **352 pruebas del frontend en 27 archivos**,
  compilación y **19 suites del backend**, todo aprobado.
- `npm run qa:encoding`: 199 archivos aprobados. `git diff --check` aprobado.
- Las 19 suites del backend también pasaron dentro de la imagen candidata.
- Estados en Oracle: 61 escenarios, 427 comprobaciones y cero fallos.
- SISIPEC: cuatro escenarios regionales aprobados; rollback de los datos
  sintéticos comprobado. La prueba inspecciona el código instalado y evalúa
  las consultas de resolución regional; no ejecuta una carga mensual completa.
- Historial en Oracle con CTE sintéticos: cierre anterior, autoría, fecha y
  aislamiento por documento y departamento, aprobado mediante SELECT.
- SQL real de PAG: creación, consulta, actualización y rechazo de cédula de
  otro correo. SQL real de depuración: paginación, selección, reversión ante
  actuación ajena y conservación de asignaciones. Todo ejecutado en una
  transacción sin commit, con rollback final comprobado.
- API y navegador de la candidata: visualización del cierre de una situación
  anterior con su defensor, ERON y fecha. Los datos sintéticos se eliminaron
  al terminar y se verificó su eliminación.
- Navegador de candidata y servicio publicado: campos PAG disponibles,
  depuración selectiva disponible, selección vacía bloqueada y reporte general
  ausente de la navegación; sin errores JavaScript. Sin operaciones de guardado
  ni eliminación en estas comprobaciones administrativas.
- Servicio publicado: HTTP 200 en salud, conexión Oracle, identidad, listado
  de condenados, filtros, ficha, historial, usuarios y vista previa de depuración.
- Integridad: 103 archivos de backend, reglas compartidas y frontend coinciden
  por SHA256 con los preparados. Los 14 archivos del frontend servidos por
  HTTPS también coinciden por SHA256.

La conexión verificada corresponde a `DNDPDEV.defensoria.gov.co`, esquema
`DNDP`. No se ejecutaron cargas mensuales ni depuraciones de registros reales.

## Corrección durante la validación

`PRC_CARGA_SISIPEC` estaba `INVALID`, sin errores registrados en `ALL_ERRORS`.
La migración V3 ya estaba instalada. Se ejecutó únicamente:

```sql
ALTER PROCEDURE DNDP.PRC_CARGA_SISIPEC COMPILE;
```

El procedimiento quedó `VALID`, sin errores de compilación, y se repitió
satisfactoriamente su prueba regional.

## Imagen y reversión

Imagen publicada como `aurora-app:local` y `aurora-app:docker-443`:

`sha256:764f19f4840a7368a4e3786b51acbec488126ce581dd8acdbb81974b9f06dc7c`.

Se construyó incrementalmente sobre la imagen anterior, copiando el backend,
las reglas compartidas y el frontend compilado. Las dependencias del backend
no cambiaron; se comprobó el SHA256 de su archivo de bloqueo. El contexto y
el manifiesto de integridad quedaron en `/tmp/aurora-release-20261027`.

La configuración Compose conserva el mismo hash que el servicio anterior.
Los certificados y los volúmenes persistentes de usuarios, cargas y reportes
se conservaron. El contenedor temporal de validación se retiró.

Imagen anterior: `aurora-app:before-docker-443-20261027`
(`sha256:15e6882b0e2beb133b3366b3f5e93569595a8f7c26ece0918774b796ca68ec33`).
Para revertir el código:

```sh
docker image tag aurora-app:before-docker-443-20261027 aurora-app:local
docker image tag aurora-app:before-docker-443-20261027 aurora-app:docker-443
docker compose up -d --no-build --wait --wait-timeout 120 aurora
```

El servidor dispone de aproximadamente 400 MB libres en el sistema de archivos
raíz (99 % ocupado); la publicación incremental no requirió eliminar imágenes
de respaldo ni volúmenes.

## Actualización posterior: enfoque diferencial de SISIPEC

Se publicó la corrección del cargador en `aurora-aurora-1`, disponible por
HTTPS 443. El contenedor quedó `healthy`, con cero reinicios. Imagen vigente,
etiquetada `aurora-app:local` y `aurora-app:docker-443`:

`sha256:6753c99a1979c912a10d19d391a7e7ea8e4d50fdde2090ddd67f7c703a62b092`.

La imagen se construyó sobre la publicación anterior, sustituyendo los scripts
de carga y el esquema de pruebas. El frontend compilado coincide íntegramente
con el ya publicado; el formulario admitía enfoques fuera del catálogo.
El cargador ahora conserva `ENFOQUE` como texto, combina las columnas de enfoque
con `; ` y, después de un ETL exitoso, copia el resultado a las situaciones
activas de fuente SISIPEC. Omite vacíos y repetidos.

Se amplió `DNDP.SITUACION_CARCELARIA.ENFOQUE` de `NVARCHAR2(255)` a
`NVARCHAR2(2000)` en DNDPDEV. Se recompiló `PRC_CARGA_SISIPEC` y se comprobó
su estado `VALID`. La tabla staging se creará con `ENFOQUE NVARCHAR2(2000)`
cuando se ejecute la siguiente carga. No se ejecutó una carga mensual ni se
reprocesaron registros reales; para recuperar enfoques descartados anteriormente
se debe volver a cargar el Excel original.

Validaciones de esta actualización:

- `npm run qa:smoke`: lint, 356 pruebas del frontend en 28 archivos,
  compilación y 19 suites del backend aprobadas.
- Las 14 pruebas Python del cargador y las 19 suites del backend también
  pasaron dentro de la imagen candidata.
- Oracle real: Excel sintético con tres columnas de enfoque, preparación del
  valor para inserción y escritura íntegra de un texto de más de 255 caracteres.
  La sincronización afectó solo a la situación activa SISIPEC; se conservaron
  el histórico, PONAL y el valor anterior cuando el enfoque venía vacío.
  Se verificó el rollback de las cuatro personas y situaciones sintéticas.
- Navegador en candidata y servicio HTTPS publicado: valor fuera del catálogo,
  texto concatenado y opción conocida visibles y conservados en el guardado.
  Estas respuestas de ficha, historial y guardado fueron sintéticas e
  interceptadas en el navegador, con service workers bloqueados; no modificaron
  registros en Oracle.
- API real publicada: HTTP 200 en salud, conexión Oracle, identidad, listado
  de condenados, ficha e historial.
- Integridad SHA256: ocho archivos actualizados del contenedor y los 14 archivos
  del frontend servidos por HTTPS. Se conservó el hash de configuración Compose,
  los certificados y los volúmenes persistentes. Candidata temporal retirada.
- Comprobación UTF-8 aprobada para 201 archivos y `git diff --check` aprobado.

El contexto y los resultados de validación quedaron en
`/tmp/aurora-enfoque-release-20261027`. Respaldo de la imagen anterior:
`aurora-app:before-enfoque-20261027`
(`sha256:764f19f4840a7368a4e3786b51acbec488126ce581dd8acdbb81974b9f06dc7c`).
Para revertir el código de esta actualización:

```sh
docker image tag aurora-app:before-enfoque-20261027 aurora-app:local
docker image tag aurora-app:before-enfoque-20261027 aurora-app:docker-443
docker compose up -d --no-build --wait --wait-timeout 120 aurora
```

La ampliación de la columna es compatible con la imagen anterior; la reversión
del código no necesita reducir su capacidad.

## Publicación de los cambios posteriores — 19:47, hora de Bogotá

Se apagó y retiró el contenedor `aurora-preview-7860`. Se comprobó que no
quedan escuchas del host en el puerto 7860. Los archivos enlazados de la
vista previa se conservaron.

Se publicaron los cambios actuales del servidor, las reglas compartidas y el
frontend recompilado en `aurora-aurora-1`, por HTTPS 443. Imagen etiquetada
`aurora-app:local` y `aurora-app:docker-443`:

`sha256:6a2cf883fc5b484a6b5a313d2c28ce0c0649805662933c2344ecf006a54ca2bf`.

Validaciones de esta publicación:

- `npm run qa:smoke`: lint, 383 pruebas del frontend en 28 archivos,
  compilación y 19 suites del backend aprobadas.
- UTF-8: 205 archivos aprobados. `git diff --check` aprobado.
- Contenedor `healthy`, cero reinicios; HTTP 200 en `/`, `/api/health`,
  `/api/health/db` y `/api/auth/config`. Conexión Oracle comprobada.
- Integridad SHA256: 116 archivos del contenedor y los 14 archivos del
  frontend servidos por HTTPS coinciden con los preparados.
- Se conservaron el hash de configuración Compose, los certificados y los
  tres volúmenes persistentes. Las dependencias no cambiaron.

Contexto, manifiesto y comprobaciones:
`/tmp/aurora-docker-443-20261027-194601`.
Respaldo: `aurora-app:before-publish-20261027-194601`
(`sha256:6753c99a1979c912a10d19d391a7e7ea8e4d50fdde2090ddd67f7c703a62b092`).

Para revertir esta publicación:

```sh
docker image tag aurora-app:before-publish-20261027-194601 aurora-app:local
docker image tag aurora-app:before-publish-20261027-194601 aurora-app:docker-443
docker compose up -d --no-build --no-deps --wait --wait-timeout 120 aurora
```

## Actualización de reportes y ERON — 20:02, hora de Bogotá

Se detuvo y retiró la vista previa de 7860, conservando sus archivos enlazados.
Los cambios actuales quedaron publicados en HTTPS 443, con las etiquetas
`aurora-app:local` y `aurora-app:docker-443`:

`sha256:ae2eab854703e3c6fde8772f956ae35ff1dc9e1f2f5703ad08436268053e0713`.

Esta actualización limita los ERON del reporte al catálogo homologado activo,
reconoce alias históricos y conserva el alcance de los sindicados de cualquier
procedencia o CDT cuando no se selecciona un ERON. Incluye el frontend
recompilado y los cambios actuales del servidor.

Validaciones:

- Lint, 383 pruebas del frontend en 28 archivos, compilación y 19 suites del
  backend aprobadas. UTF-8 aprobado en 206 archivos; `git diff --check` aprobado.
- SQL de reportes ejecutado en Oracle con fixtures de solo lectura: autoría,
  fechas, reasignaciones, regionales, sindicados y ERON homologados, incluyendo
  alias históricos y exclusión de CDT y entradas inactivas del catálogo.
- Contenedor `healthy`, cero reinicios. HTTP 200 en aplicación, salud,
  conexión Oracle y configuración de autenticación.
- 117 archivos del contenedor y 14 archivos servidos por HTTPS comprobados
  mediante SHA256. Configuración Compose, certificados y volúmenes persistentes
  conservados. Puerto 7860 del host sin escucha.
- Navegador publicado, sin respuestas interceptadas: catálogo de 124 opciones
  ERON homologadas, filtro regional, generación HTTP 200 y descarga de PDF
  comprobados. ERON inválido rechazado con HTTP 400; cero errores JavaScript.
  La comprobación no escribió datos en Oracle.

Contexto, manifiesto y resultados:
`/tmp/aurora-docker-443-20261027-200020`.
Respaldo de la imagen anterior: `aurora-app:before-publish-20261027-200020`
(`sha256:6a2cf883fc5b484a6b5a313d2c28ce0c0649805662933c2344ecf006a54ca2bf`).

Para revertir el código:

```sh
docker image tag aurora-app:before-publish-20261027-200020 aurora-app:local
docker image tag aurora-app:before-publish-20261027-200020 aurora-app:docker-443
docker compose up -d --no-build --no-deps --wait --wait-timeout 120 aurora
```
