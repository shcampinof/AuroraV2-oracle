# AURORA/Celeste - Flujos del formulario (estado actual)

## 1. Punto de entrada

Componente principal: `frontend/src/pages/FormularioAtencion.jsx`.

Secuencia base:

1. El usuario consulta por documento.
2. Frontend llama `GET /api/ppl/:documento`.
3. El registro se carga en `registro`.
4. Se calcula flujo:
   - `condenado` -> Aurora
   - `sindicado` -> Celeste

---

## 2. Visibilidad de bloques (Aurora)

Fuentes:

- `frontend/src/utils/evaluateAuroraRules.ts`
- `frontend/src/config/formRules.aurora.ts`

Reglas:

- Siempre visibles: `bloque1`, `bloque2Aurora`.
- Si no hay lock: se agrega `bloque3`.
- En bloque 2 de Aurora, antes de la pregunta 18, se muestra campo no editable:
  - `17A. Fecha de actualización de los datos (corte)` (resaltado en azul, solo lectura).
  - Valor temporal configurado: `15/04/2026`.
- En bloque 2 de Aurora, entre Q23 y Q24 se muestran 2 campos calculados y no editables:
  - `Días restantes para cumplir requisito temporal de prisión domiciliaria`
  - `Días restantes para cumplir requisito temporal de libertad condicional`
  - Cálculo: `Pena total en días - Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención)` contra umbral del beneficio.
  - Salida:
    - `Más de 90 días`
    - `N días` cuando faltan `90` o menos
    - `Ya cumple el tiempo` cuando el faltante es `<= 0`
- Resumen de calificaciones (Q26-Q27) en bloque 2:
  - Se renderiza dinámicamente con 4 filas visibles.
  - Fila 1: `26. Calificación actual (más reciente)` (editable).
  - Fila 2: `27. Otras calificaciones: Calificación 2`.
  - Filas siguientes: `Calificación 3`, `Calificación 4`.
  - Todas las filas son editables.
  - Encabezados de columna sin numeración (`Fecha última calificación`, `Número de acta`, `Evaluación desde`, `Evaluación hasta`, `Calificación de conducta`).
  - Si la fila corresponde a una actuación histórica existente, sus cambios se persisten en esa actuación.
  - Si no existe actuación histórica asociada a la fila, se permite edición visual pero no persistencia.
  - Orden de anteriores: fecha de calificación descendente.
- `bloque4` se muestra cuando:
  - obligatorios de bloque 3 estan completos (Q32 sigue opcional),
  - **Q36 tiene seleccion valida**,
  - existe al menos un valor afirmativo entre Q30-Q34, **o** Q36 tiene una solicitud positiva (distinta de `Ninguna`).
- `bloque5` (variante 5A o 5B) se muestra cuando bloque 4 obligatorio esta completo.
- En bloque 3 de Aurora:
  - Q30, Q31 y Q32 muestran opciones numeradas respetando el orden actual.
  - Q30, Q31, Q32 y Q34 incluyen la opcion:
    - `No aplica porque está en trámite solicitud de acumulación de penas`.

Lock activo:

- Si Q40 contiene la actuacion de sindicado, se bloquea avance y quedan visibles solo bloques 1 y 2.

---

## 3. Regla de P36 (Otras solicitudes a tramitar)

Implementacion:

- UI: P36 es multiseleccion con checkboxes.
- Opcion `Ninguna` es exclusiva.
- Se guarda en un solo campo concatenado por saltos de linea.
- Si hay mas de una opcion seleccionada, se agrega automaticamente:
  - `MAS DE UNA OPCION`

Validacion:

- P36 es obligatoria para habilitar avance a bloque 4.
- El evaluador ignora la linea automatica de "MAS DE UNA OPCION" y exige al menos una opcion real.

---

## 4. Guardado y obligatorios (Aurora)

Guardado progresivo:

- Se valida por bloques iniciados, no por bloques solo visibles.
- Se puede guardar bloque 3 sin haber diligenciado bloque 4.

Reglas clave:

- P37 se valida dentro de la misma regla global de obligatorios de bloque (sin validacion separada).
- Si faltan obligatorios en bloques iniciados, no se bloquea persistencia: se realiza guardado parcial y se muestra advertencia visual con los campos faltantes para completar el bloque.
- En Q39 (`Decisión del usuario`), ambas opciones afirmativas habilitan continuidad de flujo:
  - `Sí, desea que el defensor(a) público(a) avance con la solicitud`
  - `Sí desea que el defensor presente solicitud, pero suscrita por la persona privada de la Libertad.`
- Q35 es condicional a Q34:
  - Si Q34 = "Si", Q35 se habilita y se marca obligatoria visualmente.
  - Si Q34 != "Si", Q35 se deshabilita, se limpia y no cuenta como faltante.
- Si el caso ya se cierra por regla de bloque 3 (todas negativas), no se muestra el mensaje de "No se puede avanzar al Bloque 4".

---

## 5. Cierre automatico del caso

En `FormularioAtencion.jsx`, regla de cierre en bloque 3:

Reglas vigentes de cierre en Aurora:

- Regla 1:
  - si Q30-Q34 no tienen procedencia afirmativa,
  - y Q36 no tiene solicitud positiva (solo `Ninguna` o vacia),
  - el caso se marca como cerrado.
- Regla 2:
  - si Q39 no corresponde a una opcion afirmativa (`Si ...`),
  - el caso se marca como cerrado.
- Regla 3:
  - si Q40 incluye `NINGUNA` (o `NO PROCEDE NADA`),
  - el caso se marca como cerrado.
- Regla 4 (bloque 5 utilidad publica):
  - si Q44 o Q45 = `No`,
  - el caso se marca como cerrado.
- Regla 5:
  - si `Se presenta recurso` = `No` (Q54 en utilidad publica / Q49 en tramite normal),
  - el caso se marca como cerrado.
- Regla 6:
  - si Q57 (utilidad publica) o Q52 (tramite normal) esta diligenciada,
  - el caso se marca como cerrado.
- Regla adicional de tramite normal:
  - si Q47 (`Sentido de la decision`, campo tecnico Q52) esta diligenciada con valor distinto de `No concede la solicitud`,
  - el caso se marca como cerrado.
  - si Q47 = `No concede la solicitud`, pasa a flujo de recurso:
    - Q49 vacia o `No` -> `Caso cerrado`
    - Q49 = `Si` y no hay decision del recurso -> `Pendiente decision`
    - decision del recurso diligenciada -> `Caso cerrado`

Persistencia:

- Al guardar, se escribe siempre el estado de la actuacion activa:
  - `Estado del tramite` se sincroniza con `derivedStatus`.
  - `Estado del caso` se sincroniza a `Activo/Cerrado`.

---

## 6. Bloque 5 (obligatorios y dependencias)

Ajustes:

- Campo "Fecha de decision de la autoridad" obligatorio en frontend.
- Campo "Sentido de la decision" obligatorio en frontend.
- En tramite normal (5B), Q47 (`Sentido de la decision`) usa opciones de interfaz:
  - `Concede la solicitud`
  - `No concede la solicitud`
  - Compatibilidad: si existen registros historicos con `Concede/No concede subrogado penal`, se normalizan al abrir.
- En Q42 (`Poder en caso de avanzar con la solicitud`) se incluye la opción `No requiere poder` sin cambiar reglas de habilitación/bloqueo.
- En tramite normal (5B), Q43 (`Fecha de recepción de pruebas aportadas por el usuario (si aplica)`) depende de Q41 (`Requiere pruebas`):
  - si Q41 = `Sí`, Q43 se habilita;
  - si Q41 != `Sí`, Q43 se deshabilita y se limpia automaticamente.
- Validacion de secuencia temporal en fechas de tramite:
  - Tramite normal: Q43 <= Q45 <= Q46.
  - Utilidad publica: Q49 <= Q50 <= Q51.
- Restriccion de futuro en estas fechas: se permite maximo hasta hoy + 5 dias.
- Si la secuencia o el limite de futuro no se cumplen, se bloquea guardado y se muestra mensaje de error.

Fix de selects (47-49 y relacionados):

- Se normalizo lectura/escritura por aliases para evitar que el `value` lea una clave distinta de la que se actualiza.
- Esto corrige casos donde el select se habilitaba pero no reflejaba seleccion.

---

## 7. Estado del tramite (matriz vigente)

Definicion en `formRules.aurora.ts`:

- `Analizar el caso`: falta Q29 o Q37.
- `Entrevistar al usuario`: Q29 y Q37 diligenciadas, pero falta Q38 o Q40.
- `Presentar solicitud`: Q29, Q37, Q38 y Q40 diligenciadas, pero falta:
  - Q50 en "Bloque 5. Utilidad Publica", o
  - Q45 en "Bloque 5. Tramite de la solicitud".
  - Tambien aplica si ya hay datos preparatorios de bloque 5 pero aun no hay radicacion/presentacion.
- `Pendiente decision`: Q29, Q37, Q38 y Q40 diligenciadas, con:
  - Q50 en "Bloque 5. Utilidad Publica" o Q45 en "Bloque 5. Tramite de la solicitud",
  - y sin Q51 en "Bloque 5. Utilidad Publica" o Q46 en "Bloque 5. Tramite de la solicitud".
  - Tambien aplica cuando la decision es negativa y se marca recurso = `Si`, hasta que exista decision del recurso.
  - Tambien aplica cuando Q51 (utilidad) o Q46 (tramite normal) tienen fecha, pero el sentido de decision esta vacio o `-`.
- `Caso cerrado`: prevalece por reglas de cierre (ejemplo: `NO PROCEDE NADA`). Si la decision es negativa y recurso esta en `No` o vacio, el caso queda cerrado.
- Blindaje: si existe cualquier dato de bloque 5, el estado no debe volver a `Analizar el caso`.

Compatibilidad:

- Para evitar bloqueos por columnas historicas, la radicacion/decision se lee por aliases legacy
  (por ejemplo `Fecha de presentacion de solicitud a la autoridad` y variantes `...autoridad judicial`).

---

## 8. Estado del tramite (orden de evaluacion)

`derivedStatusRules` en Aurora evalua en este orden:

1. `Caso cerrado`
2. `Pendiente decision` por recurso en decision negativa (recurso = `Si` y sin decision de recurso)
3. `Pendiente decision` por fecha de decision sin sentido diligenciado
4. `Pendiente decision` (Q50/Q45 diligenciada y Q51/Q46 sin diligenciar)
5. `Presentar solicitud` por datos de bloque 5 sin radicacion/presentacion
6. `Presentar solicitud` (Q29/Q37/Q38/Q40 diligenciadas y falta Q50/Q45)
7. `Entrevistar al usuario` (Q29/Q37 diligenciadas y falta Q38 o Q40)
8. `Analizar el caso` (fallback)

Esto evita casos donde, con formulario ya avanzado, el estado se quedaba en `Analizar el caso`.

---

## 9. Nuevas opciones penales en bloque 3

Opciones de estado intermedio vigentes:

- Q30: `Si procedera proximamente libertad condicional (90 dias o menos para cumplir tiempo)`
- Q31: `Si procedera proximamente prision domiciliaria (90 dias o menos para cumplir tiempo)`

Estas opciones cuentan como afirmativas para reglas de procedencia (avance de bloque).

---

## 10. Accion a impulsar (multiple actuacion)

Para resolver estado en listados/tablas:

- `pickActiveCaseData` ahora prioriza la actuacion mas reciente.
- Criterio: `activeCaseId` (si existe) -> mayor `rowIndex`/sufijo de `caseId`/`id` -> fecha `createdAt`.
- Aplica tanto para estructuras con `casos` como con `actuaciones`.

Persistencia en guardado:

- Si existe `actuacionId` activa, el `PUT /api/ppl/:documento` actualiza esa actuacion.
- Si no existe `actuacionId`, el backend actualiza la ultima actuacion del documento.

---

## 11. Flujo SINDICADOS (Celeste)

Fuentes:

- `frontend/src/utils/evaluateCelesteRules.ts`
- `frontend/src/config/formRules.celeste.ts`
- `frontend/src/pages/FormularioAtencion.jsx`

Cambios vigentes:

- Renombre visual de bloques de sindicados: `(CELESTE)` -> `(SINDICADOS)`.
- Q21 en analisis juridico incluye opcion:
  - `No se avanzará porque ya no soy el defensor en este caso`.
- Q29 renombrada: `Fecha de presentación del recurso`.
- Q30 (nueva): `Fecha de la decisión del recurso`.
- La pregunta de sentido de la decisión que resuelve recurso se corre a Q31.

Estados/accion a impulsar en sindicados:

1. Si faltan Q19-Q22 -> `Analizar el caso`.
2. Si Q21 inicia con `No se avanzará...` -> `Caso cerrado`.
3. Si Q21 inicia con `Se avanzará...` -> `Entrevistar al usuario`.
4. Si Q23 esta diligenciada -> `Presentar solicitud`.
5. Si Q24 esta diligenciada y Q25 no -> `Pendiente audiencia` (`estado--azul`).
6. Si Q25 esta diligenciada y Q26 no o esta en `-` -> `Pendiente decisión de audiencia` (`estado--azul`).
7. Si Q24 y Q25 estan diligenciadas y Q26 = `Revoca...` o `Sustituye...` -> `Caso cerrado`.
8. Si Q24 y Q25 estan diligenciadas, Q26 = `Niega la solicitud` y Q28 esta vacia o `No` -> `Caso cerrado`.
9. Si Q28 = `Si` -> `Pendiente decisión`.
10. Si Q29 tiene fecha -> se mantiene `Pendiente decisión`.
11. Si Q30 (fecha de la decisión del recurso) o Q31 (sentido) tienen respuesta -> `Caso cerrado`.
12. Blindaje: cualquier dato de bloque 5 de sindicados se evalua antes del fallback de bloque 3, para no volver a `Analizar el caso`.



Persistencia:

- En guardado de sindicados se sincroniza:
  - `Estado del trámite` con `derivedStatus`.
  - `Estado del caso` a `Cerrado` solo cuando estado derivado es `Caso cerrado`; en otro caso `Activo`.

---

## 12. Validacion tecnica ejecutada

Sobre el estado actual del repo:

- `npm --prefix frontend run lint` -> OK
- `npm --prefix frontend test -- --run src/utils/evaluateCelesteRules.test.ts` -> OK
- `npm --prefix frontend run build` -> OK
