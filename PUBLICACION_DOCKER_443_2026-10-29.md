# Publicación de Aurora — 29 de octubre de 2026, 15:06 (Bogotá)

Los cambios actuales quedaron publicados en `aurora-aurora-1`, por HTTPS 443.
Imagen en `aurora-app:local` y `aurora-app:docker-443`:

`sha256:0c2a82eff4ad25ec5b466b7df1af2f0901347a71ccf89aa726a8cc4c2d1c2040`.

Se detuvo y retiró `aurora-preview-7860`, conservando sus archivos enlazados.
Se comprobó que no quedan escuchas del host en 7860. El contenedor publicado
está `healthy`, con cero reinicios.

La comparación con el manifiesto de la publicación de las 07:10 identificó
cambios en las pantallas de usuarios asignados y reportes, sus pruebas y los
estilos. Los 99 archivos de backend, reglas compartidas y cargador comprobados
coinciden con la versión anterior. Se recompiló el frontend y se construyó
incrementalmente sobre la imagen publicada, sin reinstalar dependencias.

Validaciones de esta publicación:

- `npm run qa:smoke`: lint, 391 pruebas del frontend en 28 archivos,
  compilación y 19 suites del backend aprobadas.
- `npm run qa:encoding`: 209 archivos aprobados. `git diff --check` aprobado.
- Las 19 suites del backend también aprobaron dentro de la candidata.
- Candidata y servicio publicado: HTTP 200 en `/`, `/api/health`,
  `/api/health/db` y `/api/auth/config`; conexión Oracle comprobada.
- Integridad SHA256: 112 archivos de cada contenedor y los 13 archivos del
  frontend servidos por HTTPS coinciden con los preparados.
- Se conservaron el hash de configuración Compose, los certificados y los
  tres volúmenes persistentes. Se retiró la candidata temporal.

No se ejecutaron migraciones, cargas mensuales ni depuraciones en Oracle.
Contexto, manifiestos y resultados:
`/tmp/aurora-docker-443-20261029-150400`.

Imagen anterior conservada como `aurora-app:before-publish-20261029-150400`
(`sha256:a4c67a53a28e14e08f6dd2dd632b0b9a3676e3dff5ed4dcc4231c72786df2e7f`).
Para revertir esta publicación:

```sh
docker image tag aurora-app:before-publish-20261029-150400 aurora-app:local
docker image tag aurora-app:before-publish-20261029-150400 aurora-app:docker-443
docker compose up -d --no-build --no-deps --wait --wait-timeout 120 aurora
```

## Publicación anterior de Usuarios asignados — 07:10

Publicado en `aurora-aurora-1`, por HTTPS en el puerto 443.
Verificación final: 07:10, hora de Bogotá. Contenedor `healthy`, cero reinicios.

Imagen en `aurora-app:local` y `aurora-app:docker-443`:

`sha256:a4c67a53a28e14e08f6dd2dd632b0b9a3676e3dff5ed4dcc4231c72786df2e7f`.

Incluye la tabla con anchos acotados, el estado **Sin asignación**, y los filtros
**Regional** y **Prioridad de gestión** separados de «Filtrar». La prioridad toma
la fecha más reciente de asignación, apertura de la atención actual y avance de
la etapa correspondiente; editar la atención no reinicia el plazo.

Validaciones:

- Lint, 391 pruebas del frontend en 28 archivos y compilación aprobados.
- Las 19 suites del backend aprobaron también dentro de la imagen candidata.
- Los 20 escenarios de prioridad aprobaron en Oracle desde la candidata.
- Los 112 archivos preparados coinciden por SHA256 con el contenedor publicado.
- Los 13 archivos del frontend servidos por HTTPS coinciden por SHA256.
- HTTP 200 en aplicación, salud, conexión Oracle y configuración de autenticación.
- Navegador sobre el servicio publicado, sin interceptar respuestas: 37 opciones
  de regional; consulta Regional + Sin asignación + prioridad gris, con 4424
  resultados y filas sin defensor; «Limpiar» y vista móvil aprobados, sin errores JavaScript.
- Se conservaron la configuración Compose, los certificados y los volúmenes.
  Se retiró la candidata temporal y se conservó la imagen anterior para reversión.

Construcción incremental sobre la imagen publicada previamente, con dependencias,
archivo de bloqueo del backend, requisitos Python y entrypoint sin cambios.
No se ejecutaron migraciones, cargas mensuales ni depuraciones en Oracle.
Manifiestos, logs y comprobaciones: `/tmp/aurora-docker-443-20261029-070658`.

Para revertir esta publicación:

```sh
docker image tag aurora-app:before-publish-20261029-070658 aurora-app:local
docker image tag aurora-app:before-publish-20261029-070658 aurora-app:docker-443
docker compose up -d --no-build --no-deps --wait --wait-timeout 120 aurora
```

## Publicación anterior — 06:46

Los cambios actuales del espacio de trabajo quedaron publicados en
`aurora-aurora-1`, por HTTPS en el puerto 443. Verificación completada a las
06:46, hora de Bogotá: contenedor `healthy`, cero reinicios.

Imagen etiquetada como `aurora-app:local` y `aurora-app:docker-443`:

`sha256:c6415d0d8d47f34913b60e8b9f1c5741524463b16000d3418fd700cf0091f1b3`.

Se construyó incrementalmente sobre la publicación anterior, incorporando el
backend, las reglas compartidas, los scripts de carga y el frontend recompilado.
Las dependencias del backend, su archivo de bloqueo, los requisitos Python y el
entrypoint coinciden con la imagen anterior. Los cinco archivos de backend que
difieren de la publicación previa corresponden a consultas y servicio de
reportes y sus pruebas.

Validaciones:

- `npm run qa:smoke`: lint, 388 pruebas del frontend en 28 archivos,
  compilación y 19 suites del backend aprobadas.
- `npm run qa:encoding`: 206 archivos aprobados. `git diff --check` aprobado.
- Las 19 suites del backend también pasaron dentro de la candidata.
- SQL de reportes validado contra Oracle mediante SELECT con CTE sintéticos:
  autoría, reasignaciones, fechas, regionales, ERON, alias, situación jurídica
  actualizada y separación de los casos sin regional identificada.
- Candidata: HTTP 200 en aplicación, salud, conexión Oracle y configuración
  de autenticación; 112 archivos verificados mediante SHA256.
- Servicio publicado: HTTP 200 en `/`, `/api/health`, `/api/health/db` y
  `/api/auth/config`; 112 archivos del contenedor y 13 archivos del frontend
  servidos por HTTPS coinciden por SHA256 con los preparados.
- Se conservaron el hash de configuración Compose, los certificados y los
  tres volúmenes persistentes. Se retiró el contenedor temporal de validación.

No se ejecutaron migraciones, cargas mensuales ni depuraciones en Oracle.
Contexto, manifiestos y resultados: `/tmp/aurora-docker-443-20261029-064420`.

Imagen anterior conservada como `aurora-app:before-publish-20261029-064420`
(`sha256:ae2eab854703e3c6fde8772f956ae35ff1dc9e1f2f5703ad08436268053e0713`).
Para revertir el código:

```sh
docker image tag aurora-app:before-publish-20261029-064420 aurora-app:local
docker image tag aurora-app:before-publish-20261029-064420 aurora-app:docker-443
docker compose up -d --no-build --no-deps --wait --wait-timeout 120 aurora
```
