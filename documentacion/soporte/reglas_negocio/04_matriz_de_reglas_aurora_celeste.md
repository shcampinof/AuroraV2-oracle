# AURORA - Matriz de reglas (Aurora/Celeste)

Fuentes actuales:

- `frontend/src/pages/FormularioAtencion.jsx`
- `frontend/src/utils/evaluateAuroraRules.ts`
- `frontend/src/config/formRules.aurora.ts`
- `frontend/src/utils/evaluateCelesteRules.ts`

---

## Actualizacion 2026-04-10

Cambios aplicados y validados:

1. Q36 en Aurora cambia a multiseleccion (checkbox multiple), obligatoria para avance a bloque 4.
2. Q36 se serializa en un campo concatenado y agrega marca automatica:
   - `MAS DE UNA OPCION` cuando hay mas de una seleccion.
   - Compatibilidad: el evaluador sigue reconociendo la marca historica `MAS DE UNA OPCION (VER RESUMEN ANALISIS DEL CASO)`.
3. La marca automatica no cuenta como respuesta valida para reglas.
4. Guardado progresivo por bloques iniciados (no obliga completar bloque 4 para guardar bloque 3).
5. No se permite guardar bloque 3 sin P37.
6. Cierre de caso en Aurora alineado a reglas operativas:
   - Q30-Q34 sin procedencia afirmativa y Q36 sin solicitud positiva,
   - Q39 en opcion no afirmativa (`No ...`, `El usuario es renuente ...`),
   - Q40 incluye "NINGUNA" o "NO PROCEDE NADA",
   - en utilidad publica: Q44 o Q45 = `No`,
   - decision negativa con recurso vacio o `No` (Q54 utilidad / Q49 tramite),
   - decision del recurso diligenciada,
   - y decision favorable de autoridad.
7. Estado derivado ajustado a matriz de "Accion a impulsar":
   - `Entrevistar al usuario`: Q29 y Q37 diligenciadas, pero falta Q38 o Q40.
   - `Presentar solicitud`: Q29, Q37, Q38 y Q40 diligenciadas; falta Q50 (utilidad publica) o Q45 (tramite normal).
   - `Pendiente decision`: Q29, Q37, Q38 y Q40 diligenciadas; existe Q50 o Q45, y falta Q51 o Q46.
   - decision negativa + recurso vacio o `No` -> `Caso cerrado`.
   - decision negativa + recurso = `Si` + sin decision de recurso -> `Pendiente decision`.
   - Q51/Q46 con fecha y sentido de decision vacio o `-` -> `Pendiente decision`.
   - cualquier dato de bloque 5 impide volver a `Analizar el caso`.
8. En bloque 5 (frontend), "Fecha de decision de la autoridad" y "Sentido de la decision" quedan obligatorios.
9. Historial:
   - accion visible: "Actualizar actuacion",
   - "Crear nueva actuacion" crea y abre formulario limpio.
10. Opciones intermedias vigentes en procedencia:
   - libertad condicional (90 dias o menos para cumplir tiempo),
   - prision domiciliaria (90 dias o menos para cumplir tiempo).
11. Validacion temporal de bloque 5:
   - secuencia obligatoria de fechas (recepcion -> presentacion/radicacion -> decision),
   - limite de fecha futura: hoy + 5 dias.
12. Nuevos campos calculados (bloque 2 Aurora, entre Q23 y Q24):
   - Dias restantes para requisito temporal de prision domiciliaria.
   - Dias restantes para requisito temporal de libertad condicional.
   - No editables; muestran:
     - `Mas de 90 dias`,
     - `N dias` (si faltan 90 o menos),
     - `Ya cumple el tiempo`.
13. Resumen de calificaciones de conducta (Q26-Q27):
   - tabla dinamica con 4 filas visibles (actual + calificaciones 2/3/4),
   - encabezados sin enumeracion, numeracion en etiquetas de fila (26 y 27),
   - todas las filas editables,
   - persiste por actuacion cuando la fila corresponde a historial existente,
   - si falta actuacion asociada, la fila mantiene edicion visual sin persistencia,
   - las anteriores se ordenan por fecha descendente.
14. Dependencia en tramite normal (5B):
   - Q43 (fecha de recepcion de pruebas aportadas) se habilita solo si Q41 = `Si`;
   - si Q41 != `Si`, Q43 se deshabilita y se limpia.
15. Q39 Decision del usuario:
   - se consideran afirmativas ambas opciones que inician por `Si` (incluyendo `Si desea que el defensor presente solicitud...`), por lo que no bloquean el avance.
16. Q42 Poder en caso de avanzar con la solicitud:
   - agrega opcion `No requiere poder` sin efectos adicionales de reglas.
17. Q47 Sentido de la decision (tramite normal 5B):
   - opciones UI: `Concede la solicitud` / `No concede la solicitud`,
   - compatibilidad retroactiva con valores historicos `Concede/No concede subrogado penal`.

## Actualizacion 2026-04-20

Cambios aplicados y validados:

1. Aurora bloque 2:
   - nuevo campo no editable antes de Q18:
     - `17A. Fecha de actualización de los datos (corte)`.
   - valor temporal actual: `15/04/2026`.
2. Aurora bloque 3:
   - Q30, Q31 y Q32 ahora renderizan opciones numeradas en el orden existente.
   - Q30, Q31, Q32 y Q34 incluyen:
     - `No aplica porque está en trámite solicitud de acumulación de penas`.
3. Flujo sindicados:
   - opción nueva en Q21:
     - `No se avanzará porque ya no soy el defensor en este caso`.
   - texto de bloques actualizado de `(CELESTE)` a `(SINDICADOS)`.
   - Q29 renombrada:
     - `Fecha de presentación del recurso`.
   - Q30 (nueva):
     - `Fecha de la decisión del recurso`.
   - la pregunta de sentido de la decisión que resuelve recurso se corre a Q31.
4. Estado derivado en sindicados (acción a impulsar) implementado:
   - Q19-Q22 incompletas -> `Analizar el caso`.
   - Q21 `No se avanzará...` -> `Caso cerrado`.
   - Q21 `Se avanzará...` y Q23 vacía -> `Entrevistar al usuario`.
   - Q23 diligenciada -> `Presentar solicitud`.
   - Q24 diligenciada y Q25 vacía -> `Pendiente audiencia` (`estado--azul`).
   - Q25 diligenciada y Q26 vacía -> `Pendiente decisión de audiencia` (`estado--azul`).
   - Q24+Q25 y Q26 `Revoca.../Sustituye...` -> `Caso cerrado`.
   - Q24+Q25, Q26 `Niega la solicitud` y Q28 vacia o `No` -> `Caso cerrado`.
   - Q28 `Si` -> `Pendiente decisión`.
   - Q29 con fecha -> se mantiene `Pendiente decisión`.
   - Q30 o Q31 con respuesta -> `Caso cerrado`.

---

## 1. Preguntas clave (Aurora)

| ID | Campo | Tipo | Obligatoria | Nota |
|---|---|---|---|---|
| Q30 | Procedencia libertad condicional | select | Si | Incluye opcion intermedia de 90 dias o menos |
| Q31 | Procedencia prision domiciliaria | select | Si | Incluye opcion intermedia de 90 dias o menos |
| Q26-Q27 | Resumen de calificaciones de conducta | tabla dinamica | Si | 4 filas visibles editables; encabezados sin numeracion |
| Q32 | Procedencia utilidad publica | select | No | Opcional en bloque 3 |
| Q33 | Procedencia pena cumplida | select | Si | |
| Q34 | Procedencia acumulacion de penas | select | Si | |
| Q35 | Campo dependiente de Q34 | texto | No | Se limpia si Q34 no habilita |
| C1 | Dias restantes para requisito temporal de prision domiciliaria | calculado | No editable | Entre Q23 y Q24 |
| C2 | Dias restantes para requisito temporal de libertad condicional | calculado | No editable | Entre Q23 y Q24 |
| Q36 | Otras solicitudes a tramitar | checkbox multiple | Si | Serializacion concatenada |
| Q37 | Resumen analisis del caso | textarea | Si | Requerida para guardar bloque 3 |
| Q40 | Actuacion a adelantar | select | Si | Define variante 5A/5B |
| Q51 | Fecha de decision de la autoridad | date | Si (frontend) | En 5A/5B |
| Q52 | Sentido de la decision | select | Si (frontend) | En 5A/5B |

---

## 2. Visibilidad de bloques (Aurora)

| Regla ID | Condicion | Efecto |
|---|---|---|
| `AURORA.B1_2.VISIBILIDAD.1` | Siempre | visibles `bloque1` y `bloque2Aurora` |
| `AURORA.B3.VISIBILIDAD.1` | Sin lock activo | agrega `bloque3` |
| `AURORA.B4.VISIBILIDAD.2` | bloque 3 obligatorio completo (Q32 opcional), Q36 valida y (al menos un "Si" entre Q30-Q34 o solicitud positiva en Q36) | agrega `bloque4` |
| `AURORA.B5.VISIBILIDAD.1` | bloque 4 obligatorio completo | agrega variante de bloque 5 |
| `AURORA.BLOCK.LOCK.1` | Q40 contiene actuacion de sindicado | no agrega `bloque3` |

---

## 3. Guardado y validacion

| Regla ID | Condicion | Efecto |
|---|---|---|
| `AURORA.GUARDADO.PROGRESIVO.1` | Guardado en Aurora | valida solo bloques iniciados |
| `AURORA.B3.GUARDADO.1` | bloque 3 iniciado y P37 vacia | bloquea guardado |
| `AURORA.OBLIGATORIOS.GLOBAL.1` | faltan obligatorios en bloques iniciados | bloquea guardado y reporta campos |
| `AURORA.B5.FECHAS.SEQ.1` | Q43/Q45/Q46 (o Q49/Q50/Q51) fuera de orden cronologico | bloquea guardado |
| `AURORA.B5.FECHAS.FUTURO.1` | fecha de secuencia bloque 5 mayor a hoy + 5 dias | bloquea guardado |
| `AURORA.B5B.DEPENDENCIA.5` | en 5B, Q41 != `Si` | deshabilita Q43 y limpia valor |
| `AURORA.B5B.DEPENDENCIA.6` | en 5B, Q41 = `Si` | habilita Q43 |

---

## 4. Cierre de caso (Aurora)

| Regla ID | Condicion | Efecto |
|---|---|---|
| `AURORA.B3.CIERRE.1` | Q30-Q34 sin procedencia afirmativa y Q36 sin solicitud positiva | `casoCerrado = true` |
| `AURORA.B4.CIERRE.1` | Q39 en opcion no afirmativa (`Si ...` mantiene continuidad) | `casoCerrado = true` |
| `AURORA.B4.CIERRE.2` | Q40 incluye "Ninguna..." o "NO PROCEDE NADA" | `casoCerrado = true` |
| `AURORA.B5.CIERRE.1` | en utilidad publica, Q44 o Q45 = `No` | `casoCerrado = true` |
| `AURORA.B5.CIERRE.2` | `Se presenta recurso` = `No` (Q54 utilidad / Q49 tramite) | `casoCerrado = true` |
| `AURORA.B5.CIERRE.3` | Q57 (utilidad) o Q52 (tramite) diligenciada | `casoCerrado = true` |
| `AURORA.B5.CIERRE.4` | en tramite normal, Q47 diligenciada con valor distinto de `No concede la solicitud` | `casoCerrado = true` |
| `AURORA.B5.CIERRE_FINAL.1` | cierre por decision final/imposibilidad en bloque 5 | `casoCerrado = true` |
| `AURORA.STATUS.WRITE_CASE.1` | guardado en Aurora | persiste `Estado del caso = Activo/Cerrado` |

---

## 5. Estado derivado del tramite (Aurora)

| Regla ID | Condicion | Estado |
|---|---|---|
| `AURORA.STATUS.ANALIZAR.1` | falta analisis o resumen | `Analizar el caso` |
| `AURORA.STATUS.ENTREVISTAR.1` | Q29 y Q37 diligenciadas, pero falta Q38 o Q40 | `Entrevistar al usuario` |
| `AURORA.STATUS.PENDIENTE.RECURSO.1` | decision negativa, recurso = `Si` y sin decision del recurso | `Pendiente decision` |
| `AURORA.STATUS.PENDIENTE.SENTIDO.1` | Q51/Q46 con fecha y sentido de decision vacio o `-` | `Pendiente decision` |
| `AURORA.STATUS.SOLICITUD.B5_PARCIAL.1` | hay datos de bloque 5 sin radicacion/presentacion | `Presentar solicitud` |
| `AURORA.STATUS.SOLICITUD.1` | Q29/Q37/Q38/Q40 diligenciadas y falta Q50 (utilidad) o Q45 (tramite) | `Presentar solicitud` |
| `AURORA.STATUS.PENDIENTE.1` | Q29/Q37/Q38/Q40 diligenciadas, existe Q50 (utilidad) o Q45 (tramite), y falta Q51 o Q46 | `Pendiente decision` |
| `AURORA.STATUS.CERRADO.1` | reglas de cierre cumplidas | `Caso cerrado` |

---

## 6. Historial de actuaciones

| Regla ID | Condicion | Efecto |
|---|---|---|
| `AURORA.HISTORIAL.BOTONES.1` | accion visible en historial | texto "Actualizar actuacion" |
| `AURORA.HISTORIAL.CREAR.1` | click en "Crear nueva actuacion" | crea actuacion y abre formulario limpio |
| `AURORA.HISTORIAL.CREAR.2` | flujo condenado sin datos desde P29 | bloquea creacion de nueva actuacion |
| `AURORA.HISTORIAL.GUARDADO.1` | guardar actuacion con `actuacionId` | actualiza la actuacion seleccionada |
| `AURORA.HISTORIAL.GUARDADO.2` | guardar sin `actuacionId` | actualiza la ultima actuacion del documento |

---

## 7. Preguntas clave (Sindicado)

| ID | Campo | Tipo | Obligatoria | Nota |
|---|---|---|---|---|
| Q19 | Defensor(a) público(a) asignado para tramitar la solicitud | datalist | Si | |
| Q20 | Fecha de análisis jurídico del caso | date | Si | |
| Q21 | Análisis jurídico y actuación a desplegar | select | Si | Incluye opción de no avance por cambio de defensor |
| Q22 | Resumen del análisis jurídico del caso | textarea | Si | |
| Q23 | Fecha de la entrevista para informar al usuario | date | Si | Habilita bloque 5 |
| Q24 | Fecha de presentación de la solicitud de audiencia | date | No | |
| Q25 | Fecha de realización de la audiencia | date | No | |
| Q26 | Sentido de la decisión | select | No | |
| Q28 | Se presenta recurso | select | No | |
| Q29 | Fecha de presentación del recurso | date | No | Si tiene fecha, pasa a pendiente decisión |
| Q30 | Fecha de la decisión del recurso | date | No | Si tiene respuesta, cierra caso |
| Q31 | Sentido de la decisión que resuelve recurso | select | No | Si tiene respuesta, cierra caso |

---

## 8. Visibilidad de bloques (Sindicado)

| Regla ID | Condicion | Efecto |
|---|---|---|
| `SINDICADO.B1_3.VISIBILIDAD.1` | Siempre | visibles `bloque1`, `bloque2Celeste`, `bloque3Celeste` |
| `SINDICADO.B3.CIERRE.LOCK.1` | Q21 inicia con `No se avanzará...` | lock activo, sin bloque 4 ni 5 |
| `SINDICADO.B4.VISIBILIDAD.1` | bloque 3 obligatorio completo | agrega `bloque4Celeste` |
| `SINDICADO.B5.VISIBILIDAD.2` | bloque 4 completo (Q23) | agrega `bloque5Celeste` |

---

## 9. Estado derivado del trámite (Sindicado)

| Regla ID | Condicion | Estado |
|---|---|---|
| `SINDICADO.STATUS.ANALIZAR.1` | faltan Q19-Q22 | `Analizar el caso` |
| `SINDICADO.STATUS.CIERRE.Q21.1` | Q21 inicia con `No se avanzará...` | `Caso cerrado` |
| `SINDICADO.STATUS.ENTREVISTAR.1` | Q21 inicia con `Se avanzará...` y Q23 vacía | `Entrevistar al usuario` |
| `SINDICADO.STATUS.SOLICITUD.1` | Q23 diligenciada y sin resultado de audiencia | `Presentar solicitud` |
| `SINDICADO.STATUS.PENDIENTE_AUDIENCIA.Q24.1` | Q24 diligenciada y Q25 vacía | `Pendiente audiencia` |
| `SINDICADO.STATUS.PENDIENTE_DECISION_AUDIENCIA.Q25.1` | Q25 diligenciada y Q26 vacía o `-` | `Pendiente decisión de audiencia` |
| `SINDICADO.STATUS.CIERRE.Q26.1` | Q24+Q25 y Q26 = `Revoca...` o `Sustituye...` | `Caso cerrado` |
| `SINDICADO.STATUS.CIERRE.RECURSO.1` | Q24+Q25, Q26 = `Niega la solicitud` y Q28 vacia o `No` | `Caso cerrado` |
| `SINDICADO.STATUS.PENDIENTE.Q28.1` | en flujo de recurso, Q28 = `Si` | `Pendiente decisión` |
| `SINDICADO.STATUS.PENDIENTE.Q29.1` | Q29 diligenciada despues de Q28 = `Si` | `Pendiente decisión` |
| `SINDICADO.STATUS.CIERRE.Q30_31.1` | Q30 o Q31 con respuesta | `Caso cerrado` |

## 10. Acceso y operación administrativa

| Regla ID | Condición | Efecto |
|---|---|---|
| `ACCESS.DATA_NOTICE.1` | Sesión autenticada sin aceptación en la sesión de interfaz | Bloquea la aplicación y presenta el aviso de tratamiento de datos |
| `ACCESS.DATA_NOTICE.2` | El usuario selecciona `No aceptar` | Cierra la sesión y vuelve al ingreso |
| `ACCESS.MANAGED.1` | Cuenta Azure AD administrada con `enabled=false` | Toda petición autenticada responde `403 AUTH_USER_DISABLED` |
| `ACCESS.ROLE_REFRESH.1` | Los roles administrados difieren de los claims del JWT | La API utiliza los roles administrados vigentes |
| `ACCESS.PAG.1` | Rol normalizado contiene `pag` | Permite validar PAG, asignar/reasignar y crear defensor |
| `ACCESS.PAG.2` | Rol normalizado no contiene `pag` | Las mutaciones PAG responden `403 PAG_FORBIDDEN` |
| `ACCESS.ADMIN.1` | Roles `admin` y `pag` en la misma cuenta | Muestra `Accesos PAG` dentro del módulo de asignación |
| `ACCESS.CSV.1` | CSV con correo nuevo y válido | Crea cuenta habilitada con rol `user` |
| `ACCESS.CSV.2` | Correo existente, repetido o inválido | Lo informa en la vista previa y no modifica el directorio |

## 11. Consulta y categorización

| Regla ID | Condición | Efecto |
|---|---|---|
| `LIST.USUARIOS.1` | Entrada inicial a `Usuarios asignados` | Carga opciones de filtro sin consultar filas |
| `LIST.USUARIOS.2` | El usuario ejecuta una búsqueda | Consulta hasta el límite configurado y pagina 25 filas en la interfaz |
| `LIST.CACHE.1` | Misma sesión, filtros y solicitud dentro de cinco minutos | Reutiliza la respuesta cliente; una mutación invalida la caché |
| `PAG.CATEGORIA.MUJER_UTILIDAD.1` | `CATEGORIZACION` es exactamente `Utilidad Pública`, categoría funcional reservada a mujeres | Incluye el registro en `mujeres_potenciales_utilidad_publica` |

## 12. Validación técnica vigente

| Comando | Resultado |
|---|---|
| `npm --prefix frontend run lint` | OK |
| `npm --prefix frontend test -- --run src/utils/evaluateCelesteRules.test.ts` | OK |
| `npm --prefix frontend run build` | OK |
