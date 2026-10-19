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
