# AURORA/CELESTE - Historial de actuaciones

## 1. Objetivo

Definir la logica de la tabla **Historial de actuaciones** del formulario:

- De donde salen los datos.
- Que se considera una actuacion iniciada.
- Como se comportan los botones `Iniciar actuacion` y `Crear nueva actuacion`.
- Como se llena cada columna visible.

Archivo principal de UI:

- `frontend/src/components/HistorialActuacionesPPL.jsx`

Fuentes de estado para "Accion a impulsar":

- `frontend/src/config/estadoActuaciones.rules.ts`

Backend:

- `backend/routes/ppl.js`
- `backend/db/consolidado.repo.js`
- `backend/data/consolidado_ppl.csv`

## 2. Flujo de datos

1. Frontend consulta `GET /api/ppl/:documento/actuaciones`.
2. Backend filtra todas las filas del CSV `consolidado_ppl.csv` por documento.
3. Backend devuelve arreglo `actuaciones` con `{ id, rowIndex, registro }`.
4. Frontend transforma cada fila para la tabla (numero, fecha, resumen, actuacion, estado).

## 3. Criterio de "actuacion iniciada"

Una fila cuenta como iniciada si cumple al menos una:

1. Tiene diligenciado algun campo clave de avance (por ejemplo fecha de analisis, resumen, actuacion, etc.).
2. Tiene algun campo no-base diligenciado (bloques 3+), excluyendo metadatos que no significan avance funcional.

Con esto se evita:

- Marcar como iniciada una fila solo por datos base (bloques 1-2).
- Crear multiples filas vacias cuando ya existe una pendiente por diligenciar.

## 4. Regla de "sin actuaciones"

`sinActuaciones = true` cuando no hay ninguna fila iniciada.

En ese estado:

- Se muestra mensaje "Sin actuaciones por el momento".
- El boton de la fila vacia (`Iniciar actuacion`) primero intenta abrir la ultima fila pendiente (no iniciada) y solo crea una nueva si no hay pendientes.
- El boton inferior `Crear nueva actuacion` tambien evita crear duplicados en este estado si existe una pendiente reutilizable.

## 5. Columnas de la tabla

### 5.1 Numero de actuacion

- Se enumera en frontend como secuencia `1..N` sobre las filas **iniciadas** visibles en tabla.

### 5.2 Fecha de analisis juridico del caso

- Condenados: pregunta 29 (Bloque 3).
- Sindicados: pregunta 20 (Bloque 3 Celeste).
- Ambos flujos usan la misma columna logica de fecha en el registro.

### 5.3 Resumen del analisis del caso

- Condenados: pregunta 37 (Bloque 3).
- Sindicados: pregunta 22 (Bloque 3 Celeste, resumen juridico del caso).

### 5.4 Actuacion judicial a adelantar

- Condenados: pregunta 40 (Bloque 4 Aurora).
- Sindicados: pregunta 21 (Bloque 3 Celeste: analisis juridico y actuacion a desplegar).

### 5.5 Accion a impulsar

- Proviene del mismo calculo de estado usado en "Usuarios asignados", mediante:
  - `getEstadoDisplayInfo(record)` en `estadoActuaciones.rules.ts`.

## 6. Guardado y persistencia

1. `POST /ppl/:documento/actuaciones` crea una nueva fila base (bloques 1-2).
2. `PUT /ppl/:documento` guarda respuestas sobre la actuacion activa (`actuacionId`).
3. El backend persiste reescribiendo `consolidado_ppl.csv` con `saveRaw`.

## 7. Notas de uso

- Si el usuario consulta de nuevo y existe una actuacion pendiente no iniciada, `Iniciar actuacion` debe retomar esa fila, no crear una adicional.
- Si hay al menos una actuacion iniciada, la tabla muestra historial con columnas completas o `-` donde falte informacion.
