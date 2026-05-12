# AURORA/Celeste - Reglas de estado de actuaciones (Usuarios asignados)

Fuentes:

- `frontend/src/config/estadoActuaciones.rules.ts`
- `frontend/src/utils/evaluateAuroraRules.ts`
- `frontend/src/utils/evaluateCelesteRules.ts`
- `frontend/src/config/formRules.aurora.ts`
- `frontend/src/config/formRules.celeste.ts`

---

## 1. Resolucion de estado logico

`obtenerEstadoActuacion(record)`:

1. Toma caso activo (`pickActiveCaseData`).
2. Resuelve flujo por situacion juridica (`condenado` o `sindicado`).
3. Evalua:
   - `condenado`: `evaluateAuroraRules({ answers: data }).derivedStatus`
   - `sindicado`: `evaluateCelesteRules({ answers: data }).derivedStatus`
4. Mapea etiqueta/clase de estado para UI.

---

## 2. Mapeo principal

| Regla ID | Condicion | Etiqueta | Clase base |
|---|---|---|---|
| `ESTADO.CASO_CERRADO.1` | `derivedStatus = Caso cerrado` | `Caso cerrado` | `estado--gris` |
| `ESTADO.PENDIENTE_DECISION.1` | `derivedStatus = Pendiente decision` | `Pendiente decision` | `estado--azul` |
| `ESTADO.PENDIENTE_AUDIENCIA.1` | `derivedStatus = Pendiente audiencia` | `Pendiente audiencia` | `estado--azul` |
| `ESTADO.PENDIENTE_DECISION_AUDIENCIA.1` | `derivedStatus = Pendiente decision de audiencia` | `Pendiente decisión de audiencia` | `estado--azul` |
| `ESTADO.ANALIZAR.1` | `derivedStatus = Analizar el caso` | `Analizar el caso` | `estado--verde` |
| `ESTADO.ENTREVISTAR.1` | `derivedStatus = Entrevistar al usuario` | `Entrevistar al usuario` | `estado--amarillo` |
| `ESTADO.SOLICITUD.1` | `derivedStatus = Presentar solicitud` | `Presentar solicitud` | `estado--rojo` |
| `ESTADO.RECURSO.1` | `derivedStatus = Presentar recurso` | `Presentar recurso` | `estado--rojo` |

---

## 3. Reglas vigentes de estado derivado

`derivedStatus` en Aurora (condenados) se calcula asi:

- `Entrevistar al usuario`:
  - Q29 y Q37 diligenciadas,
  - y falta Q38 o Q40.
- `Presentar solicitud`:
  - Q29, Q37, Q38 y Q40 diligenciadas,
  - y falta Q50 (utilidad publica) o Q45 (tramite normal).
  - tambien si hay datos preparatorios de bloque 5 y aun no hay radicacion/presentacion.
- `Pendiente decision`:
  - Q29, Q37, Q38 y Q40 diligenciadas,
  - ya existe Q50 (utilidad publica) o Q45 (tramite normal),
  - y falta Q51 (utilidad publica) o Q46 (tramite normal).
  - En decision negativa, tambien cuando recurso = `Si` y falta decision del recurso.
  - tambien cuando Q51/Q46 tienen fecha y el sentido de decision esta vacio o `-`.

Notas:

- `Caso cerrado` prevalece sobre los estados anteriores cuando aplica una regla de cierre.
- Se mantienen aliases historicos para leer radicacion/decision en columnas legacy.
- Si existe cualquier dato de bloque 5, el estado no debe volver a `Analizar el caso`.
- Reglas de cierre clave que disparan `Caso cerrado`:
  - Q39 en opcion no afirmativa (las dos opciones que inician por `Si` son afirmativas),
  - Q40 con "NINGUNA"/"NO PROCEDE NADA",
  - Q44 o Q45 = `No` en utilidad publica,
  - decision negativa con recurso en `No` o vacio,
  - decision favorable de autoridad,
  - decision del recurso diligenciada por fecha o sentido.

`derivedStatus` en Celeste (sindicados) se calcula asi:

- `Analizar el caso`:
  - faltan Q19-Q22.
- `Caso cerrado`:
  - Q21 inicia con `No se avanzara...`, o
  - Q30 (fecha de la decision del recurso) diligenciada, o
  - Q31 (sentido de la decision que resuelve recurso) diligenciada, o
  - Q24+Q25 diligenciadas y Q26 = `Revoca.../Sustituye...`, o
  - en flujo de recurso, Q28 vacia o `No`.
- `Entrevistar al usuario`:
  - Q19-Q22 completas, Q21 inicia con `Se avanzara...`, y Q23 vacia.
- `Presentar solicitud`:
  - Q23 diligenciada y sin resultado de audiencia.
- `Pendiente audiencia`:
  - Q24 diligenciada y Q25 vacia.
- `Pendiente decisión de audiencia`:
  - Q25 diligenciada y Q26 vacia o `-`.
- `Pendiente decision`:
  - Q24+Q25 diligenciadas, Q26 = `Niega la solicitud` y Q28 = `Si`; se mantiene mientras no haya decision del recurso.

---

## 4. Semaforo por dias

`getSemaforoClassByDays(days)`:

| Regla ID | Condicion | Clase |
|---|---|---|
| `ESTADO.SEMAFORO.VERDE.1` | `days <= 15` | `estado--verde` |
| `ESTADO.SEMAFORO.AMARILLO.1` | `16 <= days <= 30` | `estado--amarillo` |
| `ESTADO.SEMAFORO.ROJO.1` | `days > 30` | `estado--rojo` |

---

## 5. Ultima actuacion

- El estado visible en tablas se calcula con `pickActiveCaseData`, priorizando la actuacion mas reciente.
- En guardado, si hay `actuacionId` se actualiza esa actuacion; si no, el backend actualiza la ultima actuacion del documento.
