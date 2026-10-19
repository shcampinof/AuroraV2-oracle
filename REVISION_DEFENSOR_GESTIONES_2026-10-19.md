# Revisión del defensor por gestión

Fecha: 19 de octubre de 2026. Conexión comprobada: DNDPDEV.

## Problemas corregidos

La reasignación de una gestión abierta reemplazaba `DEFENSOR_GESTION`.
Además, el formulario y la hidratación de respuestas podían confundir al
defensor de una gestión anterior con el responsable actualmente asignado.
Guardar ese formulario podía provocar una reasignación involuntaria.

Ahora cada cambio de defensor desde PAG conserva las gestiones anteriores y
crea una gestión vacía para el nuevo responsable. No se copian fechas ni hitos
del anterior. Repetir la asignación al mismo defensor no duplica asignaciones
ni gestiones abiertas. La operación bloquea la persona mientras escribe y
comprueba que la situación todavía esté activa.

El formulario conserva al defensor de la gestión seleccionada y protege ese
campo cuando ya tiene autor. Cambiar el responsable se hace desde PAG.
Guardar el histórico no altera la asignación vigente. Una gestión sin
defensor tampoco hereda al último autor de otra gestión.

## Uso de cada dato

| Uso | Fuente |
| --- | --- |
| Defensor actual y filtros de Usuarios asignados/PAG | `ASIGNACION`, con `FECHA_FIN IS NULL`. |
| Defensor mostrado y guardado en una gestión | `GESTION_JURIDICA.DEFENSOR_GESTION`. |
| Autor de actuaciones en el reporte | Defensor y asignación original de la gestión; respaldo por historial para filas antiguas sin vínculo. |
| Personas a cargo de un defensor | Personas únicas con asignación vigente, aplicando los mismos filtros del listado. |
| Edición después de salir de prisión | Datos persistidos de la gestión seleccionada, con defensor identificado y avance previo al bloque 5. |
| Limpieza administrativa por defensor | También exige que el autor de la gestión coincida; no elimina las gestiones de otros autores por compartir persona. |

El nuevo campo opcional `ID_ASIGNACION_GESTION` conserva la identidad de la
asignación original. Así, completar una actuación después del traslado o
corregir su fecha no la transfiere al nuevo defensor. También permite
distinguir homónimos por la cédula de esa asignación.

Las filas anteriores sin vínculo mantienen la reconstrucción histórica del
reporte: no se hizo una atribución masiva ni se sobrescribieron autores
existentes. Esa reconstrucción sigue limitada por la información histórica
disponible.

También se agregó la pregunta de cierre sin número al final del bloque 3 de
sindicados, con su ayuda y exportación. Sus reglas de cierre se verificaron en
frontend y Oracle, junto con los cierres automáticos por ERON/SISIPEC.

## Migración

Antes de ejecutar esta versión en otro esquema:

```sh
npm --prefix backend run db:install-gestion-assignment -- --apply
```

La migración agrega una columna nullable, conserva las filas existentes y
recompila las dependencias de la tabla que Oracle invalide. Se verificaron
`VALID` los procedimientos de carga SISIPEC, PONAL y AURORA10 y la vista
`VW_DETALLE_CON_DEFENSOR`. El índice de asignación vigente y la migración
SISIPEC ya estaban instalados.

No se ejecutó una carga mensual real sobre el staging compartido como prueba.

## Evidencia

- Lint, compilación, 337 pruebas del frontend en 25 archivos y 18 suites del
  backend aprobados.
- 61 escenarios compartidos de estados y 427 comprobaciones Oracle aprobadas.
- Fixtures en SELECT: autoría histórica, asignación original, actuaciones
  posteriores al traslado, fechas retroactivas, homónimos, cierres y periodos.
- Integración Oracle con rollback: A → B → A → C, histórico completo,
  atribución de actuaciones del mismo día, reintento sin duplicados,
  desasignación, nueva asignación y gestión cerrada. Rollback verificado.
- Navegador Chromium y endpoints reales: asignación inicial y tres
  reasignaciones desde PAG sin salir del módulo, recarga, filtros por defensor,
  apertura y guardado del formulario histórico, reporte de ambos defensores y
  edición tras libertad. Se rechazaron el cambio de autor histórico y un
  permiso de bloque 5 enviado por el cliente sin respaldo persistido.
- La prueba de navegador confirmó limpieza sin residuos de persona,
  situación, gestión, calificación, asignación, PAG y defensores sintéticos.
- Auditoría de Jorge Suárez: mismos IDs y estados entre reporte y listado en
  cuatro alcances. Para condenados de CPMS GIRARDOT: 130 personas, 33 cerradas.
- La imagen candidata pasó las suites del backend y las comprobaciones Oracle.

Los ejemplos originales de producción (149/159, 78/89 y 90/52) requieren
los Excel, filtros y corte de ese ambiente. Las pruebas de DNDPDEV no
sustituyen esa conciliación.
