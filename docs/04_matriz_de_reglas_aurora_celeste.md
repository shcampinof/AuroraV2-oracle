# AURORA - Matriz de Reglas (Aurora/Celeste)

Fuentes analizadas (implementación actual):

- `frontend/src/utils/evaluateAuroraRules.ts`
- `frontend/src/utils/evaluateCelesteRules.ts`
- `frontend/src/pages/FormularioAtencion.jsx`
- `frontend/src/config/formRules.aurora.ts`
- `frontend/src/config/formRules.celeste.ts`
- `frontend/src/pages/RegistrosAsignados.jsx`
- `frontend/src/App.css`

---

## 0. Convenciones e IDs

- **ID de regla**: `<FLUJO>.<BLOQUE>.<CATEGORIA>.<N>`  
  - Ejemplos:
    - `AURORA.B3.CIERRE.1`
    - `AURORA.B5A.DEPENDENCIA.1`
    - `CELESTE.B3.VISIBILIDAD.1`
    - `ESTADO.SEMAFORO.VERDE.1`
- **Flujos**:
  - `AURORA` = condenados.
  - `CELESTE` = sindicados.
- **Fuentes**:
  - `evaluador` = lógica pura (`evaluateAuroraRules` / `evaluateCelesteRules`).
  - `componente` = lógica en `FormularioAtencion.jsx`.
  - `formRules.*` = helpers de reglas (`formRules.aurora.ts`, `formRules.celeste.ts`).
  - `usuariosAsignados` = lógica de la tabla de Usuarios asignados (`RegistrosAsignados.jsx` + CSS).
- **Qxx**: IDs internos de preguntas (no se redefinen aquí; se documentan en la matriz de preguntas).

> **Regla de oro de mantenimiento**  
> Cualquier cambio de negocio debe actualizar:
> 1) esta matriz,  
> 2) la implementación en código,  
> 3) al menos un test cuyo nombre incluya el ID de la regla.

---

## 1. Matriz de preguntas (resumen funcional)

> Plantilla a completar con labels reales. Aquí solo se listan las preguntas que hoy participan en reglas claras.

| ID   | Label actual (resumen)                                  | Flujo  | Bloque | Tipo    | Obligatoria | Participa en…                                      |
|------|---------------------------------------------------------|--------|--------|---------|------------|----------------------------------------------------|
| Q28  | Pregunta bloque 3 – 28                                  | Aurora | 3      | select  | Sí         | Requisito para habilitar bloque 4                  |
| Q29  | Pregunta bloque 3 – 29                                  | Aurora | 3      | select  | Sí         | Requisito para habilitar bloque 4                  |
| Q30  | Condición bloque 3 – 30                                 | Aurora | 3      | select  | Sí         | Cierre B3 / habilitar B4                           |
| Q31  | Condición bloque 3 – 31                                 | Aurora | 3      | select  | Sí         | Cierre B3 / habilitar B4                           |
| Q32  | Condición bloque 3 – 32                                 | Aurora | 3      | select  | No         | Cierre B3 / habilitar B4                           |
| Q33  | Condición bloque 3 – 33                                 | Aurora | 3      | select  | Sí         | Cierre B3 / habilitar B4                           |
| Q34  | Condición que habilita Q35                              | Aurora | 3      | select  | Sí         | Dependencia (`AURORA.BX.DEPENDENCIA.1`)            |
| Q35  | Pregunta dependiente de Q34                             | Aurora | 3      | texto   | No         | Limpieza (`AURORA.BX.LIMPIEZA.1`)                  |
| Q36  | Pregunta bloque 3 – 36                                  | Aurora | 3      | select  | Sí         | Requisito para habilitar bloque 4                  |
| Q37  | Pregunta bloque 3 – 37                                  | Aurora | 3      | select  | Sí         | Requisito para habilitar bloque 4                  |
| Q38  | Fecha de entrevista                                     | Aurora | 4      | fecha   | Sí         | Requisito de estado (`STATUS.ENTREVISTAR/SOLICITUD`)|
| Q39  | Decisión del usuario sobre avance                       | Aurora | 4      | select  | Sí         | Habilita resto de bloque 4 y puede cerrar caso     |
| Q40  | Actuación a adelantar                                   | Aurora | 4      | select  | Sí         | Ruta 5A/5B y cierre (`AURORA.B5*.RUTA/BLOQUEO_*`)  |
| Q44  | Condición utilidad/trámite – 1                          | Aurora | 5A/5B  | select  | No         | Cierre (`AURORA.B5.CIERRE.2`)                      |
| Q45  | Condición utilidad/trámite – 2                          | Aurora | 5A/5B  | select  | No         | Cierre (`AURORA.B5.CIERRE.2`)                      |
| Q46  | Requisito misión de trabajo                             | Aurora | 5A     | select  | Sí         | Dependencia (`AURORA.B5A.DEPENDENCIA.1`)           |
| Q47  | Detalle misión de trabajo 1 / sentido subrogado (5B)    | Aurora | 5A/5B  | select  | No         | Dependencias en 5A y 5B                            |
| Q48  | Detalle misión de trabajo 2                             | Aurora | 5A     | texto   | No         | Dependencia (`AURORA.B5A.DEPENDENCIA.1`)           |
| Q52  | Sentido de la decisión (utilidad pública)               | Aurora | 5A     | select  | Sí         | Cierre y negativa (`AURORA.B5A.CIERRE.*`)          |
| Q53–Q55 | Campos de motivo / recurso en utilidad pública       | Aurora | 5A     | varios  | No         | Negativa y recurso (`AURORA.B5A.DEPENDENCIA.*`)    |
| Q56  | Campo final que implica cierre                          | Aurora | 5A/5B  | varios  | No         | Cierre (`AURORA.B5.CIERRE.3`)                      |
| Q57  | Cierre por imposibilidad de avanzar (utilidad pública)  | Aurora | 5A     | select  | No         | Cierre (`AURORA.B5A.CIERRE.2`)                     |
| C_Q26| Sentido de la decisión (Celeste, bloque 5)              | Celeste| 5      | select  | Sí         | Dependencia (`CELESTE.B5.DEPENDENCIA.2`)           |
| C_Q27| Motivo de la decisión negativa (Celeste, bloque 5)      | Celeste| 5      | texto   | No         | Dependencia (`CELESTE.B5.DEPENDENCIA.2/3`)         |
| C_Q28| ¿Se presenta recurso? (Celeste, bloque 5)               | Celeste| 5      | select  | No         | Dependencia (`CELESTE.B5.DEPENDENCIA.4/5`)         |
| C_Q29| Fecha de presentación del recurso (Celeste)             | Celeste| 5      | fecha   | No         | Dependencia (`CELESTE.B5.DEPENDENCIA.4/5`)         |
| C_Q30| Sentido de la decisión que resuelve el recurso (Celeste)| Celeste| 5      | select  | No         | Dependencia (`CELESTE.B5.DEPENDENCIA.4/5`)         |
| C_DEF| Defensor asignado                                       | Celeste| 3      | select  | Sí         | Visibilidad (`CELESTE.B3.VISIBILIDAD.*`)           |
| C_FAN| Fecha de análisis                                       | Celeste| 3      | fecha   | Sí         | Visibilidad (`CELESTE.B3.VISIBILIDAD.*`)           |
| C_PRO| Procedencia del caso                                    | Celeste| 3      | select  | Sí         | Visibilidad (`CELESTE.B3.VISIBILIDAD.*`)           |

Nota de catalogo Q40 (Aurora):
- Se agrega la opcion `Reiterar solicitud de subrogado penal ya radicada` en "Actuacion a adelantar".

> **TODO**: completar la matriz con todos los Qxx y labels exactos a partir de `formRules.aurora.ts` y `formRules.celeste.ts`.

---

## 2. Reglas de visibilidad por bloque

### 2.1 Aurora (condenados)

| Regla ID                     | Flujo  | Fuente    | Condición                                                                                       | Efecto                                                       |
|------------------------------|--------|-----------|-------------------------------------------------------------------------------------------------|--------------------------------------------------------------|
| AURORA.B1_2.VISIBILIDAD.1    | Aurora | evaluador | Siempre                                                                                         | `visibleBlocks` incluye `bloque1` y `bloque2Aurora`         |
| AURORA.B3.VISIBILIDAD.1      | Aurora | evaluador | No hay `lockRules` activas (no bloqueos por Q40 ni cierres previos)                            | Se agrega `bloque3`                                         |
| AURORA.B4.VISIBILIDAD.1      | Aurora | evaluador | Preguntas obligatorias de bloque 3 completas (Q32 opcional)                                     | Habilita en general el bloque 4                             |
| AURORA.B4.VISIBILIDAD.2      | Aurora | evaluador | Preguntas obligatorias de bloque 3 completas (Q32 opcional) **y** al menos un "Sí" entre Q30–Q34 | Se agrega `bloque4` a `visibleBlocks`                       |
| AURORA.B5.VISIBILIDAD.1      | Aurora | evaluador | Preguntas obligatorias de `bloque4` completas                                                   | Bloque 5 puede mostrarse (alguna variante)                  |
| AURORA.B5A.VISIBILIDAD.1     | Aurora | evaluador | `conditionalBlockVisibility.when = true` (actuación de Q40 de utilidad pública)                | Variante `bloque5UtilidadPublica` activa (5A)               |
| AURORA.B5B.VISIBILIDAD.1     | Aurora | evaluador | No se cumple condición de variante 5A y no aplica bloqueo por Q40                              | Variante `bloque5TramiteNormal` activa (5B)                 |
| AURORA.BLOCK.LOCK.1          | Aurora | evaluador | `lock_por_actuacion_40_sindicada` (Q40 contiene actuación de sindicado)                        | No se agrega `bloque3`; visibles solo `bloque1` y `bloque2` |

### 2.2 Celeste (sindicados)

| Regla ID                         | Flujo   | Fuente    | Condición                                           | Efecto                                                          |
|----------------------------------|---------|-----------|----------------------------------------------------|-----------------------------------------------------------------|
| CELESTE.B1_3.VISIBILIDAD.1       | Celeste | evaluador | Siempre                                            | `visibleBlocks` incluye bloques 1, 2Celeste y 3Celeste         |
| CELESTE.B4.VISIBILIDAD.1         | Celeste | evaluador | Preguntas obligatorias del bloque 3 completas      | Se agrega `bloque4Celeste`                                     |
| CELESTE.B5.VISIBILIDAD.2         | Celeste | evaluador | `bloque4Celeste` completo y fecha de bloque 4 llena| Se agrega `bloque5Celeste`                                     |

---

## 3. Reglas de deshabilitación

### 3.1 Aurora

| Regla ID                      | Flujo  | Fuente      | Condición                                                                 | Campos / efecto                                                                                   |
|-------------------------------|--------|-------------|---------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| AURORA.B5A.DEPENDENCIA.1      | Aurora | evaluador   | Bloque 5A activo y Q46 = "No"                                            | Deshabilita Q47 y Q48                                                                              |
| AURORA.B5A.DEPENDENCIA.2      | Aurora | evaluador   | Bloque 5A activo y Q52 = "Niega utilidad pública"                        | Habilita campos de motivo y recurso (Q53–Q55, Q56 según diseño)                                   |
| AURORA.B5A.DEPENDENCIA.3      | Aurora | evaluador   | Bloque 5A activo y Q52 ≠ "Niega utilidad pública"                        | Deshabilita y limpia Q53–Q55 (y Q56 si aplica)                                                    |
| AURORA.B5A.DEPENDENCIA.4      | Aurora | evaluador   | Bloque 5A activo, Q52 = "Niega utilidad pública" y Q54 = "Sí se presenta recurso" | Habilita campos de recurso adicional (p.ej. Q55 y Q56)                               |
| AURORA.B5B.DEPENDENCIA.1      | Aurora | evaluador   | Bloque 5B activo y campo “¿Se presenta recurso?” ≠ "Sí"                  | Deshabilita y limpia campos de recurso (fecha y sentido de la decisión que resuelve solicitud)    |
| AURORA.B5B.DEPENDENCIA.2      | Aurora | evaluador   | Bloque 5B activo y “¿Se presenta recurso?” = "Sí"                         | Habilita fecha y sentido de la decisión que resuelve solicitud                                    |
| AURORA.B5B.DEPENDENCIA.3      | Aurora | evaluador   | Bloque 5B activo y Q47 = "No concede subrogado penal"                    | Habilita motivo y recurso; el resto depende de la respuesta de recurso                            |
| AURORA.B5B.DEPENDENCIA.4      | Aurora | evaluador   | Bloque 5B activo y Q47 ≠ "No concede subrogado penal"                    | Deshabilita motivo y campos de recurso (incluye sentido que resuelve solicitud)                   |
| AURORA.BX.DEPENDENCIA.1       | Aurora | componente  | Q34 distinto de "Sí"                                                      | Deshabilita Q35                                                                                    |
| AURORA.B4.DEPENDENCIA.1       | Aurora | componente  | Q39 ∈ { opciones de avance definidas para el usuario }                   | Habilita el resto de preguntas del bloque 4                                                       |
| AURORA.B4.LOCK_UI.1           | Aurora | componente  | `cierreRegla1Bloque3`                                                     | Deshabilita Q38, Q39 y contribuye al bloqueo de bloque 5                                          |
| AURORA.B4.LOCK_UI.2           | Aurora | componente  | `cierreRegla1Bloque3` o `decisionUsuarioBloquea`                          | Deshabilita Q40                                                                                    |
| AURORA.B4.LOCK_UI.3           | Aurora | componente  | `cierreRegla1Bloque3` o `decisionUsuarioBloquea` o actuación "Ninguna"   | Deshabilita campos posteriores de bloque 4 (por ejemplo Q41 y Q42)                                |
| AURORA.B5.LOCK_UI.1           | Aurora | componente  | `bloquearBloque5 = true`                                                 | Deshabilita la mayoría de campos de bloque 5                                                      |
| AURORA.B5A.LOCK_UI.2          | Aurora | componente  | Bloque 5A activo y no aplica negativa de utilidad pública                | Deshabilita Q53 y Q54                                                                              |
| AURORA.B5A.LOCK_UI.3          | Aurora | componente  | Bloque 5A activo y Q54 ≠ "Sí"                                            | Deshabilita Q55 y Q56                                                                              |
| AURORA.B5B.LOCK_UI.2          | Aurora | componente  | Bloque 5B activo y “¿Se presenta recurso?” ≠ "Sí"                        | Deshabilita fecha de recurso y sentido que resuelve solicitud                                     |

### 3.2 Celeste

| Regla ID                      | Flujo   | Fuente      | Condición                                                            | Campos / efecto                                             |
|-------------------------------|---------|-------------|------------------------------------------------------------------------|-------------------------------------------------------------|
| CELESTE.B5.DEPENDENCIA.1      | Celeste | componente  | Pregunta "¿Se recurrió en caso de decisión negativa?" ≠ "Sí"          | Deshabilita (y limpia) fecha y sentido de la decisión del recurso (si aplica) |
| CELESTE.B5.DEPENDENCIA.2      | Celeste | componente  | C_Q26 = "Niega la solicitud"                                         | Habilita C_Q27                                              |
| CELESTE.B5.DEPENDENCIA.3      | Celeste | componente  | C_Q26 ≠ "Niega la solicitud"                                         | Deshabilita y limpia C_Q27                                 |
| CELESTE.B5.DEPENDENCIA.4      | Celeste | componente  | C_Q28 indica que se presenta recurso (por ejemplo "Sí se presenta recurso") | Habilita C_Q29 y C_Q30                               |
| CELESTE.B5.DEPENDENCIA.5      | Celeste | componente  | C_Q28 no indica recurso (por ejemplo cualquier valor distinto de "Sí")| Deshabilita y limpia C_Q29 y C_Q30                         |

---

## 4. Reglas de limpieza automática

| Regla ID                     | Flujo   | Fuente      | Condición                                                    | Limpieza                                                                                   |
|------------------------------|---------|-------------|--------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| AURORA.BX.LIMPIEZA.1         | Aurora  | componente  | Q34 no habilita Q35 (no es "Sí")                            | Limpia ambas claves de Q35 (`KEY_Q35_LEGACY`, `KEY_Q35_UTF8`)                            |
| AURORA.B5A.LIMPIEZA.1        | Aurora  | componente  | Bloque 5A activo y Q52 ≠ "Niega utilidad pública"           | Limpia: Motivo de la decisión negativa, Se presenta recurso, Fecha de recurso            |
| AURORA.B5B.LIMPIEZA.1        | Aurora  | componente  | Bloque 5B activo y Q47 ≠ "No concede subrogado penal"       | Limpia: Motivo, Se presenta recurso, Fecha de recurso, Sentido que resuelve solicitud    |
| AURORA.B5B.LIMPIEZA.2        | Aurora  | componente  | Bloque 5B activo, Q47 = "No concede..." y recurso ≠ "Sí"    | Limpia: Fecha de recurso y Sentido que resuelve solicitud                                  |
| CELESTE.B5.LIMPIEZA.1        | Celeste | componente  | Pregunta "¿Se recurrió en caso de decisión negativa?" ≠ "Sí"| Limpia: Fecha de presentación del recurso y Sentido de la decisión que resuelve el recurso |

---

## 5. Reglas de cierre de caso

### 5.1 Aurora

| Regla ID                       | Flujo  | Fuente                  | Condición (resumen Qxx)                                                              | Efecto                                          |
|--------------------------------|--------|-------------------------|--------------------------------------------------------------------------------------|-------------------------------------------------|
| AURORA.B3.CIERRE.1             | Aurora | `isCasoCerrado`         | Q30–Q33 completas y todas en { "No", "No aplica", "No cumple" }                     | `casoCerrado = true`                           |
| AURORA.B4.CIERRE.1             | Aurora | `isCasoCerrado`         | Q39 con decisión que implica no continuar                                           | `casoCerrado = true`                           |
| AURORA.B4.CIERRE.2             | Aurora | `isCasoCerrado`         | Q40 contiene actuaciones que no permiten continuar (p.ej. "ninguna" general)        | `casoCerrado = true`                           |
| AURORA.B4.CIERRE.3             | Aurora | `isCasoCerrado` / comp. | Q39 no es alguna de las opciones válidas de avance                                  | `casoCerrado = true`; bloque 5 no visible      |
| AURORA.B5.CIERRE.2             | Aurora | `isCasoCerrado`         | Q44 = "No" o Q45 = "No"                                                              | `casoCerrado = true`                           |
| AURORA.B5.CIERRE.3             | Aurora | `isCasoCerrado`         | Q54 = "No"                                                                           | `casoCerrado = true`                           |
| AURORA.B5.CIERRE.4             | Aurora | `isCasoCerrado`         | Q56 diligenciada                                                                     | `casoCerrado = true`                           |
| AURORA.B5A.CIERRE.1            | Aurora | componente              | Bloque 5A: Q52 diligenciada y (según combinación de respuesta y recurso)            | Contribuye a marcar cierre final del caso      |
| AURORA.B5A.CIERRE.2            | Aurora | componente              | Bloque 5A: Q57 (Cierre del caso por imposibilidad de avanzar) tiene algún valor     | `casoCerrado = true`                           |
| AURORA.B5B.CIERRE.1            | Aurora | componente              | Bloque 5B: recurso = "No" o sentido que resuelve solicitud diligenciado             | `casoCerrado = true`                           |
| AURORA.B5B.CIERRE.2            | Aurora | componente              | Bloque 5B: campo "Cierre del caso por imposibilidad de avanzar" (p.ej. P52) con valor| `casoCerrado = true`                          |
| AURORA.GLOBAL.CIERRE.1         | Aurora | `FormularioAtencion`    | Regla 30–33 negativas (`cierreRegla1Bloque3`)                                       | `casoCerrado = true`                           |
| AURORA.GLOBAL.CIERRE.2         | Aurora | `FormularioAtencion`    | Decisión del usuario en bloque 4 que no permite avanzar                             | `casoCerrado = true`                           |
| AURORA.GLOBAL.CIERRE.3         | Aurora | `FormularioAtencion`    | Actuación de Q40 inicia por "Ninguna..." (cualquiera de las opciones de cierre)     | `casoCerrado = true`                           |
| AURORA.B5.CIERRE_FINAL.1       | Aurora | `FormularioAtencion`    | `cierrePorDecisionFinalBloque5` (decisión final o imposibilidad registrada)        | Marca cierre final de bloque 5                 |
| AURORA.B5.CIERRE_FINAL.2       | Aurora | `FormularioAtencion`    | `cierrePorDecisionFinalBloque5` y Estado del caso aún no marcado como cerrado      | Guarda automáticamente `Estado del caso = Cerrado` vía `updatePpl` |

### 5.2 Celeste

| Regla ID                       | Flujo   | Fuente                 | Condición                                      | Efecto                             |
|--------------------------------|---------|------------------------|-----------------------------------------------|------------------------------------|
| CELESTE.GLOBAL.CIERRE.1        | Celeste | `formRules.celeste.ts` | `closeCaseRules = []`, `isCaseClosedCeleste` siempre `false` | No hay cierre automático definido |

---

## 6. Reglas que afectan el estado del trámite

| Regla ID                       | Flujo   | Fuente               | Condición                                           | Resultado / efecto                                     |
|--------------------------------|---------|----------------------|-----------------------------------------------------|--------------------------------------------------------|
| AURORA.STATUS.CERRADO.1       | Aurora  | `derivedStatusRules` | `isCasoCerrado(record)`                            | `derivedStatus = "Caso cerrado"`                      |
| AURORA.STATUS.ANALIZAR.1      | Aurora  | `derivedStatusRules` | Falta fecha de análisis o resumen                  | `derivedStatus = "Analizar el caso"`                  |
| AURORA.STATUS.ENTREVISTAR.1   | Aurora  | `derivedStatusRules` | Análisis completo pero falta entrevista o actuación| `derivedStatus = "Entrevistar al usuario"`            |
| AURORA.STATUS.SOLICITUD.1     | Aurora  | `derivedStatusRules` | Base completa y falta radicación                   | `derivedStatus = "Presentar solicitud"`               |
| AURORA.STATUS.PENDIENTE.1     | Aurora  | `derivedStatusRules` | Radicación hecha y falta decisión                  | `derivedStatus = "Pendiente decisión"`                |
| AURORA.STATUS.WRITE_FORM.1    | Aurora  | `FormularioAtencion` | `auroraActivo` y cambio en `derivedStatus`         | Escribe `Estado del trámite` en el registro           |
| AURORA.STATUS.WRITE_CASE.1    | Aurora  | `FormularioAtencion` | Cambio en `casoCerrado`                            | Escribe `Estado del caso` (`Activo` / `Cerrado`)      |
| CELESTE.STATUS.ACTUAL.1       | Celeste | `evaluateCelesteRules` | Estado actual                                      | `locked = false`, `jumpToAurora = false`              |
| CELESTE.STATUS.HELPER.1       | Celeste | `formRules.celeste.ts` | `deriveStatusCeleste` (no usado hoy en UI)        | Candidato a integrarse a `Estado del trámite`         |

---

## 7. Reglas de estado de la actuación

Las reglas de estado y semáforo de la tabla de Usuarios asignados se documentan en:

- `docs/07_estado_actuaciones.md`

Estas reglas dependen del avance del caso (Aurora/Celeste) y del tiempo transcurrido desde ciertos hitos.

## 8. TODO de matriz de reglas

- Completar la tabla de **matriz de preguntas (Qxx)** con labels y tipos exactos desde `formRules.aurora.ts` y `formRules.celeste.ts`.
- Resolver y documentar de forma definitiva la equivalencia de numeración entre Q47/Q52 en bloque 5B (sentido de la decisión) para evitar ambigüedad entre documento y labels de UI.
- Afinar los textos de condición de Q39 y Q40 con las opciones reales (“Sí, desea que el defensor…”, “Utilidad pública (solo para mujeres)”, etc.).
- Añadir, si aparecen en el código, reglas adicionales de cierre o bloqueo no listadas aquí.
- Alinear nombres de tests unitarios con los `Regla ID` definidos en esta matriz.
