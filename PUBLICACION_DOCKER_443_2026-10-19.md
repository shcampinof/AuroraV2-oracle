# Publicación conjunta de Aurora — 19 de octubre de 2026

Se reunieron los cambios pendientes del espacio de trabajo y se publicaron
mediante `docker compose up -d --no-build --wait --wait-timeout 120 aurora`.
El servicio `aurora-aurora-1` atiende HTTPS en el puerto 443.

## Cambios incluidos

- Cálculo de estados ante respuestas vacías en Oracle y escenarios compartidos.
- Reasignaciones, responsable de cada gestión y conservación del histórico.
- Posibilidad de completar gestiones de personas fuera de prisión cuando la
  gestión persistida ya había alcanzado el bloque 5.
- Ajustes del formulario, cierre del caso en el bloque de análisis y autoguardado.
- Reporte de gestión: atribución histórica, personas únicas, cierres calculados,
  filtros de tipo y establecimiento, inclusión explícita de personas fuera de
  prisión y detalles del PDF.
- Scripts de diagnóstico, auditoría e integración; inclusión de `shared/` en
  la imagen Docker.

Los diagnósticos de la misma fecha describen las revisiones previas a esta
publicación conjunta. La corrección del reporte ya está publicada.

## Verificación

- `npm run qa:smoke`: lint, 330 pruebas del frontend en 25 archivos,
  compilación y 18 suites del backend aprobados.
- `npm run qa:encoding` y `git diff --check`: aprobados.
- Oracle: 58 escenarios de estados, 406 comprobaciones sin fallos; autoría del
  reporte validada mediante SELECT con datos sintéticos.
- Reasignaciones en Oracle: asignación inicial, tres reasignaciones,
  desasignación, nueva asignación y gestión nueva después del cierre. Rollback
  comprobado para todos los datos sintéticos.
- Migración SISIPEC: ya instalada; no fue necesario aplicar DDL.
- La imagen candidata pasó las 18 suites del backend y las comprobaciones de
  estados y reporte contra Oracle. Se verificaron por SHA256 sus 23 archivos
  modificados o nuevos de backend y reglas compartidas.
- Servicio publicado: `healthy`, cero reinicios y respuestas HTTP 200 en `/`,
  `/api/health` y `/api/health/db`.
- HTML, JavaScript principal, CSS, manifest y service worker servidos por HTTPS
  coinciden por SHA256 con los archivos del contenedor.
- Consulta del reporte en el contenedor publicado: 130 personas asignadas,
  97 activas y 33 cerradas para condenados de CPMS GIRARDOT en el caso de
  comprobación del diagnóstico; sin personas duplicadas.

La conexión configurada corresponde a DNDPDEV. Estas verificaciones acreditan
el servicio publicado con esa conexión.

## Imagen y reversión

Imagen publicada:
`sha256:319f55b282c92efc378d60d63f5bb35cf4781a7f0e32e2eae37bc9074d02e7b6`.
Disponible como `aurora-app:local` y `aurora-app:docker-443`.

Imagen anterior conservada como
`aurora-app:before-docker-443-20261019-0827`.
Para revertir el código del servicio:

```sh
docker image tag aurora-app:before-docker-443-20261019-0827 aurora-app:local
docker compose up -d --no-build --wait --wait-timeout 120 aurora
```

Los certificados y los volúmenes persistentes de usuarios, cargas y reportes
se conservaron durante la publicación.

## Publicación posterior: defensor por gestión

Se publicó la revisión descrita en
[Revisión del defensor por gestión](REVISION_DEFENSOR_GESTIONES_2026-10-19.md).
Imagen vigente:
`sha256:8c19f262ee9da990110ab8468797c75886c48ba40866dc735109adc808496975`.

La imagen final conserva exactamente el código, dependencias Node y frontend
de la imagen validada en navegador: 1.616 archivos con digest conjunto
`095ef431bcb1a466bab647791353d1bdd3c20b0baec5188143ee245008141e78`.

Después de reemplazar el servicio en 443 se comprobaron `healthy`, cero
reinicios, HTTP 200 en salud y conexión Oracle, y nueve archivos del frontend
servidos por HTTPS con el mismo SHA256 que sus archivos del contenedor.

La imagen previa a esta revisión queda como
`aurora-app:before-defensor-gestion-20261019-0840`. Para revertir esta última
publicación:

```sh
docker image tag aurora-app:before-defensor-gestion-20261019-0840 aurora-app:local
docker compose up -d --no-build --wait --wait-timeout 120 aurora
```

La columna opcional de la migración es compatible con esa imagen anterior;
no se necesita eliminarla para revertir el código. La conexión sigue siendo
DNDPDEV.

## Publicación posterior: motivo del cierre por traslado

El historial muestra los cierres automáticos de situaciones anteriores en un
recuadro azul, incluso si ya existe una nueva situación activa. Incluye el
motivo registrado, el defensor de la gestión y el ERON anterior. La fecha de
cierre procede de `FECHA_FIN` de la asignación original vinculada a la gestión;
se omite cuando esa vinculación no existe. También se conserva el motivo del
cierre automático por actualización relevante de SISIPEC.

Validación: lint, compilación, 58 pruebas seleccionadas del frontend y las
18 suites del backend aprobadas. La consulta se ejecutó contra Oracle con
CTE sintéticos para comprobar la situación anterior, autoría, fecha y filtros.
Una prueba de API y navegador sobre la imagen candidata confirmó la visualización
con una situación anterior cerrada y otra activa. Sus datos sintéticos se
eliminaron al terminar. Tras publicar se comprobaron salud, Oracle y el endpoint
del historial por HTTPS 443; los cuatro archivos de backend y el JavaScript
servido coinciden por SHA256 con los archivos validados. Servicio `healthy`,
cero reinicios.

Imagen vigente, etiquetada `aurora-app:local` y `aurora-app:docker-443`:
`sha256:15e6882b0e2beb133b3366b3f5e93569595a8f7c26ece0918774b796ca68ec33`.
Se construyó incrementalmente sobre la versión publicada, sustituyendo los
archivos de backend modificados y el frontend compilado, sin cambios de
dependencias. Reversión del código de esta publicación:

```sh
docker image tag aurora-app:before-cierre-eron-20261019 aurora-app:local
docker image tag aurora-app:local aurora-app:docker-443
docker compose up -d --no-build --wait --wait-timeout 120 aurora
```
