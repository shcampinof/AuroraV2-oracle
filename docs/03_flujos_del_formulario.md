# AURORA - Flujos de Formulario (Implementacion Actual)

## 1. Punto de entrada

Componente principal: `frontend/src/pages/FormularioAtencion.jsx`.

Secuencia base:

1. El usuario consulta por documento.
2. Frontend llama `getPplByDocumento` (`GET /api/ppl/:documento`).
3. El registro se guarda en estado local (`registro`).
4. Se calcula el flujo con `computeFlow(registro)`:
   - si `Situacion Juridica` contiene `condenad` -> Aurora.
   - si contiene `sindicad` -> Celeste.
   - en otro caso -> `null`.

## 2. Reglas de visibilidad por bloque

## 2.1 Aurora (`evaluateAuroraRules`)

Fuentes: `frontend/src/utils/evaluateAuroraRules.ts` y `frontend/src/config/formRules.aurora.ts`.

- Base visible: `bloque1`, `bloque2Aurora`.
- Si no hay lock, se agrega `bloque3`.
- `AURORA.B4.VISIBILIDAD.2`: para mostrar `bloque4`, se requiere bloque 3 completo y al menos un "Si" entre Q30-Q34.
- `AURORA.B5.VISIBILIDAD.1`: si bloque 4 esta completo, se agrega bloque 5 activo.
- Variante de bloque 5:
  - `bloque5UtilidadPublica` cuando aplica regla condicional por Q40.
  - `bloque5TramiteNormal` en el resto de casos.

Lock activo en Aurora:

- `lock_por_actuacion_40_sindicada`: si Q40 contiene "Ninguna porque la persona esta sindicada".
- Efecto: no se agrega `bloque3`; quedan visibles solo `bloque1` y `bloque2Aurora`.

## 2.2 Aurora (render en `FormularioAtencion.jsx`)

Adicional a `visibleBlocks`:

- Bloque 5 se renderiza si hay variante visible o si `bloque4` esta visible y `Actuacion a adelantar` tiene valor.
- `show5A`: requiere `bloque4` visible y actuacion de utilidad publica.
- `show5B`: requiere `bloque4` visible, no `show5A` y actuacion diligenciada.

## 2.3 Celeste (`evaluateCelesteRules`)

Fuentes: `frontend/src/utils/evaluateCelesteRules.ts` y `frontend/src/config/formRules.celeste.ts`.

- Siempre visibles: `bloque1`, `bloque2Celeste`, `bloque3Celeste`.
- `CELESTE.B4.VISIBILIDAD.1`: si bloque 3 esta completo, se agrega `bloque4Celeste`.
- `CELESTE.B5.VISIBILIDAD.2`: si bloque 4 esta completo (fecha de entrevista), se agrega `bloque5Celeste`.
- `locked` siempre es `false` en el evaluador actual.
- `jumpToAurora` siempre es `false` en el evaluador actual.

## 3. Reglas de deshabilitacion

## 3.1 Aurora (evaluador)

`evaluateAuroraRules` calcula `disabledFields` desde `dependencyRules`:

- Q46 = No -> deshabilita Q47 y Q48.
- En 5A, Q52 != "Niega utilidad publica" -> deshabilita Q53, Q54, Q55, Q56.
- En 5A, Q52 = "Niega utilidad publica" -> habilita Q53 y Q54.
- En 5A, Q52 = "Niega utilidad publica" y Q54 = "Si" -> habilita Q55 y Q56.
- En 5B, Q52 != "No concede subrogado penal" -> deshabilita Q53, Q54, Q55 y `b5NormalSentidoResuelveSolicitud`.
- En 5B, Q52 = "No concede subrogado penal" y Q54 != "Si" -> deshabilita Q55 y `b5NormalSentidoResuelveSolicitud`.
- En 5B, Q52 = "No concede subrogado penal" y Q54 = "Si" -> habilita Q55 y `b5NormalSentidoResuelveSolicitud`.

## 3.2 Aurora (componente)

Reglas de UI adicionales:

- Q35 se deshabilita si Q34 no es equivalente a "Si".
- En bloque 4:
  - Q38 y Q39 se deshabilitan cuando aplica `cierreRegla1Bloque3`.
  - Q40 se deshabilita por `cierreRegla1Bloque3` o `decisionUsuarioBloquea`.
  - Q41 y Q42 se deshabilitan por `cierreRegla1Bloque3`, `decisionUsuarioBloquea` o actuacion que inicia por "Ninguna".
- En bloque 5 (`bloquearBloque5`): gran parte del bloque se deshabilita cuando hay cierre por bloque 3, decision de usuario bloqueante o actuacion "Ninguna".
- En 5A:
  - Q53 y Q54 dependen de `habilitarNegativaUtilidadPublica`.
  - Q55 y Q56 dependen ademas de que Q54 sea "Si".
- En 5B:
  - Q53 y Q54 dependen de `habilitarNegativaTramiteNormal` (Q52 = "No concede subrogado penal").
  - Q55 y el sentido de decision que resuelve solicitud dependen tambien de que "Se presenta recurso" sea "Si".

## 3.3 Celeste (componente)

- C_Q27 (motivo de decision negativa) solo se habilita si C_Q26 = "Niega la solicitud".
- C_Q29 y C_Q30 se deshabilitan si "Se recurrio en caso de decision negativa" no es equivalente a "Si".

## 4. Reglas de limpieza automatica

Aplicadas en `FormularioAtencion.jsx` mediante `useEffect`:

- Si Q34 no habilita Q35, se limpian ambas variantes de clave de Q35 (`KEY_Q35_LEGACY` y `KEY_Q35_UTF8`).
- En 5A, si Q52 != "Niega utilidad publica", se limpian:
  - `Motivo de la decision negativa`
  - `Se presenta recurso`
  - `Fecha de recurso en caso desfavorable`
- En 5B, si Q52 != "No concede subrogado penal", se limpian:
  - `Motivo de la decision negativa`
  - `Se presenta recurso`
  - `Fecha de recurso en caso desfavorable`
  - `Sentido de la decision que resuelve la solicitud`
- En 5B, si no se presenta recurso, se limpian:
  - `Fecha de recurso en caso desfavorable`
  - `Sentido de la decision que resuelve la solicitud`
- En Celeste, si C_Q26 != "Niega la solicitud", se limpia `MOTIVO DE LA DECISION NEGATIVA`.
- En Celeste, si no hay recurso (`habilitarCelesteRecurso = false`), se limpian:
  - `Fecha de presentacion del recurso`
  - `SENTIDO DE LA DECISION QUE RESUELVE RECURSO`

## 5. Reglas de cierre de caso

## 5.1 Cierre en `formRules.aurora.ts` (`isCasoCerrado`)

Se considera cerrado si ocurre cualquiera de estas condiciones:

- Q30-Q33 diligenciadas y todas negativas (`No`, `No aplica`, `No cumple`).
- Q39 con decision que no inicia con "Si".
- Q40 contiene "ninguna".
- Q44 = No o Q45 = No.
- Q54 = No.
- Q56 diligenciada.

## 5.2 Cierre en `FormularioAtencion.jsx` (`casoCerrado`)

El componente recalcula cierre con logica de UI y decision final de bloque 5:

- cierre por decision final/imposibilidad.
- decision de usuario bloqueante.
- actuacion "Ninguna".
- regla 30-33 negativas (`cierreRegla1Bloque3`).
- condiciones finales de 5A/5B sobre recurso y sentido de decision.

Persistencia automatica de cierre:

- Si `auroraActivo` y `cierrePorDecisionFinalBloque5`, se intenta guardar automaticamente con `Estado del caso = Cerrado`.

## 6. Reglas que afectan estado del tramite

## 6.1 Estado derivado Aurora (`evaluateAuroraRules`)

`derivedStatus` usa `derivedStatusRules` de `formRules.aurora.ts`:

- `Caso cerrado`
- `Analizar el caso`
- `Entrevistar al usuario`
- `Presentar solicitud`
- `Pendiente decision`

El orden de evaluacion es el definido en el arreglo (primera coincidencia).

## 6.2 Escritura de estado en formulario

En `FormularioAtencion.jsx`:

- Se sincroniza `Estado del caso` entre `Activo` y `Cerrado` segun `casoCerrado`.
- En Aurora, se sincroniza `Estado del tramite` con `auroraRuleState.derivedStatus`.

## 6.3 Estado en Celeste

- `evaluateCelesteRules` no devuelve estado derivado.
- `formRules.celeste.ts` tiene `deriveStatusCeleste`, pero `FormularioAtencion.jsx` no lo usa para escribir `Estado del tramite`.

## 7. Salto Celeste -> Aurora

- Existe flujo en `FormularioAtencion.jsx` (`handleSaltoCelesteAAurora`) para guardar y forzar navegacion a Aurora.
- En la implementacion actual no se dispara, porque `evaluateCelesteRules` retorna `jumpToAurora: false` y `jumpPayload: undefined`.
