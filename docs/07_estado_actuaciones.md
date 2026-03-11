# AURORA - Reglas de estado de actuaciones (Usuarios asignados)

Fuentes de implementacion actuales:

- `frontend/src/config/estadoActuaciones.rules.ts`
- `frontend/src/config/estadoActuaciones.rules.test.ts`
- `frontend/src/pages/RegistrosAsignados.jsx`
- `frontend/src/App.css` (clases `estado--*` y `estadoBadge`)
- `frontend/src/utils/evaluateAuroraRules.ts` (origen de `derivedStatus`)

## 1. Resolucion de estado logico

La tabla de Usuarios asignados resuelve el estado con `obtenerEstadoActuacion(record)`:

1. `pickActiveCaseData(record)` para resolver el bloque de datos activo.
2. `evaluateAuroraRules({ answers: data }).derivedStatus`.
3. Normalizacion del label canonico (`Analizar el caso`, `Entrevistar al usuario`, etc.).

## 2. Mapeo estado -> etiqueta y clase

| Regla ID | Condicion | Etiqueta | Clase final |
|---|---|---|---|
| `ESTADO.CASO_CERRADO.1` | `derivedStatus = "Caso cerrado"` | `Caso cerrado` | `estado--gris` |
| `ESTADO.PENDIENTE_DECISION.1` | `derivedStatus = "Pendiente decision"` | `Pendiente decision` | `estado--azul` |
| `ESTADO.ANALIZAR.1` | `derivedStatus = "Analizar el caso"` | `Analizar el caso` | semaforo por dias (fallback `estado--verde`) |
| `ESTADO.ENTREVISTAR.1` | `derivedStatus = "Entrevistar al usuario"` | `Entrevistar al usuario` | semaforo por dias (fallback `estado--amarillo`) |
| `ESTADO.SOLICITUD.1` | `derivedStatus = "Presentar solicitud"` | `Presentar solicitud` | semaforo por dias (fallback `estado--rojo`) |

Nota:

- En estados con semaforo, `claseFinal` toma el color de semaforo si existe; en caso contrario usa la clase base.

## 3. Reglas de semaforo por dias

El semaforo usa `getSemaforoClassByDays(days)`.

| Regla ID | Condicion | Clase |
|---|---|---|
| `ESTADO.SEMAFORO.VERDE.1` | `days <= 15` | `estado--verde` |
| `ESTADO.SEMAFORO.AMARILLO.1` | `16 <= days <= 30` | `estado--amarillo` |
| `ESTADO.SEMAFORO.ROJO.1` | `days > 30` | `estado--rojo` |

## 4. Fecha de referencia por estado con semaforo

| Estado | Fecha usada por la implementacion |
|---|---|
| `Analizar el caso` | primera no vacia entre: `Fecha de asignacion del PAG`, `Fecha asignacion del PAG`, `Fecha de asignacion PAG`, `Fecha asignacion PAG`, `Fecha de asignacion`, `Fecha de asignacion`, `fechaAsignacionPAG`, `fechaAsignacionPag`, `fechaAsignacion`; fallback: `record.createdAt` |
| `Entrevistar al usuario` | primera no vacia entre: `Fecha de analisis juridico del caso`, `Fecha de analisis juridico del caso`, `aurora_b3_fechaAnalisis` |
| `Presentar solicitud` | `Fecha de entrevista` |

## 5. Fallback de etiqueta y clase

Si `derivedStatus` no cae en los estados principales:

1. Etiqueta = primer valor no vacio entre:
   - `Accion a realizar`
   - `Actuacion a adelantar`
   - `posibleActuacionJudicial`
   - `Estado del caso`
   - `Estado del tramite`
   - `estado`
   - `estadoEntrevista`
   - `Estado entrevista`
   - `derivedStatus`
2. Clase por mapeo de label (`getEstadoClassByLabel`):
   - `analizar el caso` -> `estado--verde`
   - `entrevistar al usuario` -> `estado--amarillo`
   - `presentar solicitud` -> `estado--rojo`
   - `pendiente decision` -> `estado--azul`
   - `caso cerrado` / `cerrado` -> `estado--gris`
   - `activo` -> `estado--azul`

## 6. TODO de trazabilidad

- Si se agregan nuevos labels operativos de estado en CSV/API, actualizar `getEstadoClassByLabel` y esta matriz.
- Si cambia la fuente de fecha para semaforo, actualizar tests `ESTADO.SEMAFORO.*`.
