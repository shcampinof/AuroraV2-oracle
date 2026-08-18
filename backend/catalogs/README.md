# Homologación operativa sin modificar Oracle

Los catálogos de este directorio asignan identidad estable a conceptos del negocio. Oracle continúa siendo una fuente de solo lectura para este proceso; los valores históricos no se sobrescriben.

## Auditoría

Ejecute desde la raíz del proyecto:

```bash
npm --prefix backend run audit:homologation -- --tipo=all --limit=100
```

El reporte incluye cobertura por número de registros, valores pendientes ordenados por impacto, inconsistencias entre estado y acción y sugerencias conservadoras. Una sugerencia nunca constituye una homologación automática.

El endpoint `GET /api/ppl/condenados/homologation-audit?tipo=all&limit=100` entrega el mismo reporte a usuarios con rol `pag`. La respuesta se conserva en caché durante cinco minutos para proteger Oracle.

## Aprobación de un alias

1. Confirmar con la fuente institucional que los textos representan exactamente el mismo centro o acción.
2. Agregar el texto histórico a `aliases` dentro del catálogo correspondiente.
3. Si se crea una identidad nueva, asignar un ID descriptivo e inmutable; no reutilizar IDs existentes.
4. Actualizar `catalogVersion` usando una fecha o versión superior.
5. Ejecutar `npm --prefix backend test`.
6. Con acceso Oracle de solo lectura, ejecutar `RUN_ORACLE_INTEGRATION=true npm --prefix backend run test:oracle:homologation`.
   Para validar además todos los filtros y campos de Usuarios asignados, ejecutar `RUN_ORACLE_INTEGRATION=true npm --prefix backend run test:oracle:assigned-users`.
7. Revisar que aumente la cobertura y que ninguna identidad antes separada se haya fusionado sin aprobación.

Los valores `LEGACY_*` permanecen visibles y consultables mientras esperan revisión. No deben copiarse al catálogo como identidades definitivas sin análisis institucional.
