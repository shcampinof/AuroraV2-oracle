# Inventario de preguntas y catálogos — AURORA / CELESTE

Fuente principal: `frontend/src/pages/FormularioAtencion.jsx` en el commit `b9a4bba`.

Este documento no contiene datos personales. Conserva los textos visibles y las opciones del formulario, incluidos errores ortográficos existentes.

## Resumen

- Preguntas/filas inventariadas: **87**.
- Comunes a ambos flujos: **13**.
- Flujo condenado (incluidas ambas variantes del bloque 5): **56**.
- Flujo sindicado: **18**.
- Exclusivas del bloque de utilidad pública: **16**.
- Catálogos: **29**.

## Ambos — Común

Bloque: **BLOQUE 1. Información de la persona privada de la libertad**

| ID | Pregunta exacta | Tipo | Catálogo | Exclusiva utilidad pública | Condición |
|---|---|---|---|---|---|
| AMB-COM-01 | 1. Nombre | Texto | — | No | — |
| AMB-COM-02 | 2. Tipo de indentificación | Selección única | TIPO_IDENTIFICACION | No | — |
| AMB-COM-03 | 3. Número de identificación | Texto | — | No | — |
| AMB-COM-04 | 4. Situación Jurídica | Selección única | SITUACION_JURIDICA | No | — |
| AMB-COM-05 | 5. Género | Selección única | GENERO | No | — |
| AMB-COM-06 | 6. Enfoque Étnico/Racial/Cultural | Selección única | ENFOQUE_ETNICO | No | — |
| AMB-COM-07 | 7. Nacionalidad | Texto | — | No | — |
| AMB-COM-08 | 8. Fecha de nacimiento | Fecha | — | No | — |
| AMB-COM-09 | 9. Edad | Número | — | No | — |
| AMB-COM-10 | 10. Lugar de privación de la libertad | Selección única | LUGAR_PRIVACION | No | — |
| AMB-COM-11 | 11. Nombre del lugar de privación de la libertad | Texto | — | No | — |
| AMB-COM-12 | 12. Departamento del lugar de privación de la libertad | Texto | — | No | — |
| AMB-COM-13 | 13. Distrito/municipio del lugar de privación de la libertad | Texto | — | No | — |

## Condenado — AURORA general

Bloque: **BLOQUE 2 (AURORA) - Información del proceso SISIPEC**

| ID | Pregunta exacta | Tipo | Catálogo | Exclusiva utilidad pública | Condición |
|---|---|---|---|---|---|
| CON-AUR-14 | 14. Autoridad a cargo | Texto | — | No | — |
| CON-AUR-15 | 15. Número de proceso | Texto | — | No | — |
| CON-AUR-16 | 16. Delitos | Texto largo | — | No | — |
| CON-AUR-17 | 17. Fecha de captura | Fecha | — | No | — |
| CON-AUR-18 | 18. Pena (años, meses y días) | Texto | — | No | — |
| CON-AUR-19 | 19. Pena total en días | Número | — | No | — |
| CON-AUR-20 | 20. Tiempo que la persona lleva privada de la libertad (en días) | Número | — | No | — |
| CON-AUR-21 | 21. Redención total acumulada en días | Número | — | No | — |
| CON-AUR-22 | 22. Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención) | Número | — | No | — |
| CON-AUR-23 | 23. Porcentaje de avance de pena cumplida | Porcentaje | — | No | — |
| CON-AUR-24 | 24. Fase de tramiento | Selección única | FASE_TRATAMIENTO | No | — |
| CON-AUR-25 | 25. ¿Cuenta con requerimientos judiciales por otros procesos? | Selección única | REQUERIMIENTOS_JUDICIALES | No | — |
| CON-AUR-26 | 26. Calificación actual (más reciente) | Grupo repetible | CALIFICACION_CONDUCTA | No | — |
| CON-AUR-27 | 27. Otras calificaciones anteriores: | Selección única | CALIFICACION_CONDUCTA | No | Registros repetibles: hasta tres calificaciones anteriores. |

## Condenado — AURORA general

Bloque: **BLOQUE 3 - Análisis jurídico**

| ID | Pregunta exacta | Tipo | Catálogo | Exclusiva utilidad pública | Condición |
|---|---|---|---|---|---|
| CON-AUR-28 | 28. Defensor(a) público(a) asignado para tramitar la solicitud | Catálogo dinámico / autocompletar | DEFENSORES | No | — |
| CON-AUR-29 | 29. Fecha de análisis jurídico del caso | Fecha | — | No | — |
| CON-AUR-30 | 30. Procedencia de libertad condicional | Selección única | PROCEDENCIA_LIBERTAD | No | — |
| CON-AUR-31 | 31. Procedencia de prisión domiciliaria de mitad de pena | Selección única | PROCEDENCIA_DOMICILIARIA | No | — |
| CON-AUR-32 | 32. Procedencia de utilidad pública (solo para mujeres) | Selección única | PROCEDENCIA_UTILIDAD_PUBLICA | No | Solo para mujeres; evalúa la procedencia de utilidad pública. |
| CON-AUR-33 | 33. Procedencia de pena cumplida | Selección única | SI_NO | No | — |
| CON-AUR-34 | 34. Procedencia de acumulación de penas | Selección única | PROCEDENCIA_ACUMULACION | No | — |
| CON-AUR-35 | 35. Con qué proceso(s) debe acumular penas (si aplica) | Texto | — | No | Se habilita cuando 34. Procedencia de acumulación de penas = Sí. |
| CON-AUR-36 | 36. Otras solicitudes a tramitar | Selección múltiple | OTRAS_SOLICITUDES | No | Selección múltiple; “Ninguna” es exclusiva. |
| CON-AUR-37 | 37. Resumen del análisis del caso | Texto largo | — | No | — |

## Condenado — AURORA general

Bloque: **BLOQUE 4 - Entrevista con el usuario**

| ID | Pregunta exacta | Tipo | Catálogo | Exclusiva utilidad pública | Condición |
|---|---|---|---|---|---|
| CON-AUR-38 | 38. Fecha de la entrevista | Fecha | — | No | Visible después de completar el análisis jurídico requerido. |
| CON-AUR-39 | 39. Decisión del usuario | Selección única | DECISION_USUARIO_AURORA | No | — |
| CON-AUR-40 | 40. Actuación a adelantar | Selección única | ACTUACION_ADELANTAR_AURORA | No | Define si el bloque 5 continúa por utilidad pública o por trámite general. |
| CON-AUR-41 | 41. Requiere pruebas | Selección única | SI_NO | No | — |
| CON-AUR-42 | 42. Poder en caso de avanzar con la solicitud | Selección única | PODER | No | — |

## Condenado — Utilidad pública

Bloque: **BLOQUE 5. Utilidad pública**

| ID | Pregunta exacta | Tipo | Catálogo | Exclusiva utilidad pública | Condición |
|---|---|---|---|---|---|
| CON-UP-43 | 43. Fecha de entrevista psicosocial | Fecha | — | Sí | Visible cuando 40. Actuación a adelantar corresponde a una actuación de utilidad pública. |
| CON-UP-44 | 44. Cumple el requisito de marginalidad | Selección única | SI_NO | Sí | Visible exclusivamente en la variante de utilidad pública. |
| CON-UP-45 | 45. Cumple el requisito de jefatura de hogar | Selección única | SI_NO | Sí | Visible exclusivamente en la variante de utilidad pública. |
| CON-UP-46 | 46. Se requiere misión de trabajo | Selección única | SI_NO | Sí | Visible exclusivamente en la variante de utilidad pública. |
| CON-UP-47 | 47. Fecha de solicitud de misión de trabajo | Fecha | — | Sí | Se deshabilita si 46. Se requiere misión de trabajo = No. |
| CON-UP-48 | 48. Fecha de asignación de investigador | Fecha | — | Sí | Se deshabilita si 46. Se requiere misión de trabajo = No. |
| CON-UP-49 | 49. Fecha en la que se reciben todas las pruebas | Fecha | — | Sí | Visible exclusivamente en la variante de utilidad pública. |
| CON-UP-50 | 50. Fecha de radicación de solicitud de utilidad pública | Fecha | — | Sí | Visible exclusivamente en la variante de utilidad pública. |
| CON-UP-51 | 51. Fecha de decisión de la autoridad | Fecha | — | Sí | Visible exclusivamente en la variante de utilidad pública. |
| CON-UP-52 | 52. Sentido de la decisión | Selección única | UP_SENTIDO_DECISION | Sí | Visible exclusivamente en la variante de utilidad pública. |
| CON-UP-53 | 53. Motivo de la decisión negativa | Selección única | UP_MOTIVO_NEGATIVA | Sí | Se habilita cuando 52. Sentido de la decisión = Niega utilidad pública. |
| CON-UP-54 | 54. Se presenta recurso | Selección única | SI_NO | Sí | Se habilita cuando 52. Sentido de la decisión = Niega utilidad pública. |
| CON-UP-55 | 55. Fecha de presentación del recurso | Fecha | — | Sí | Se habilita cuando 52 = Niega utilidad pública y 54 = Sí. |
| CON-UP-56 | 56. Fecha de la decisión del recurso | Fecha | — | Sí | Se habilita cuando 52 = Niega utilidad pública y 54 = Sí. |
| CON-UP-57 | 57. Sentido de la decisión que resuelve recurso | Selección única | UP_SENTIDO_RECURSO | Sí | Se habilita cuando 52 = Niega utilidad pública y 54 = Sí. |
| CON-UP-58 | 58. Cierre del caso por imposibilidad de avanzar (si aplica) | Selección única | CIERRE_IMPOSIBILIDAD | Sí | Visible exclusivamente en la variante de utilidad pública. |

## Condenado — Trámite general

Bloque: **BLOQUE 5. Trámite de la solicitud**

| ID | Pregunta exacta | Tipo | Catálogo | Exclusiva utilidad pública | Condición |
|---|---|---|---|---|---|
| CON-TG-43 | 43. Fecha de recepción de pruebas aportadas por el usuario (si aplica) | Fecha | — | No | Se habilita cuando 41. Requiere pruebas = Sí. |
| CON-TG-44 | 44. Fecha de solicitud de documentos al Inpec (si aplica) | Fecha | — | No | — |
| CON-TG-45 | 45. Fecha de presentación de la solicitud a la autoridad | Fecha | — | No | — |
| CON-TG-46 | 46. Fecha de decisión de la autoridad | Fecha | — | No | — |
| CON-TG-47 | 47. Sentido de la decisión | Selección única | TRAMITE_SENTIDO_DECISION | No | — |
| CON-TG-48 | 48. Motivo de la decisión negativa | Selección única | TRAMITE_MOTIVO_NEGATIVA | No | Se habilita cuando 47. Sentido de la decisión = No concede la solicitud. |
| CON-TG-49 | 49. Se presenta recurso | Selección única | SI_NO | No | Se habilita cuando 47. Sentido de la decisión = No concede la solicitud. |
| CON-TG-50 | 50. Fecha de presentación del recurso | Fecha | — | No | Se habilita cuando 47 = No concede la solicitud y 49 = Sí. |
| CON-TG-51 | 51. Fecha de la decisión del recurso | Fecha | — | No | Se habilita cuando 47 = No concede la solicitud y 49 = Sí. |
| CON-TG-52 | 52. Sentido de la decisión que resuelve recurso | Selección única | TRAMITE_SENTIDO_RECURSO | No | Se habilita cuando 47 = No concede la solicitud y 49 = Sí. |
| CON-TG-53 | 53. Cierre del caso por imposibilidad de avanzar (si aplica) | Selección única | CIERRE_IMPOSIBILIDAD | No | — |

## Sindicado — CELESTE

Bloque: **BLOQUE 2 (SINDICADOS) - Información del proceso SISIPEC**

| ID | Pregunta exacta | Tipo | Catálogo | Exclusiva utilidad pública | Condición |
|---|---|---|---|---|---|
| SIN-CEL-14 | 14. Autoridad a cargo | Texto | — | No | — |
| SIN-CEL-15 | 15. Número de proceso | Texto | — | No | — |
| SIN-CEL-16 | 16. Delitos | Texto largo | — | No | — |
| SIN-CEL-17 | 17. Fecha de captura | Fecha | — | No | — |
| SIN-CEL-18 | 18. Tiempo que la persona lleva privada de la libertad (en meses) | Número | — | No | — |

## Sindicado — CELESTE

Bloque: **BLOQUE 3 (SINDICADOS) - Análisis jurídico**

| ID | Pregunta exacta | Tipo | Catálogo | Exclusiva utilidad pública | Condición |
|---|---|---|---|---|---|
| SIN-CEL-19 | 19. Defensor(a) público(a) asignado para tramitar la solicitud | Catálogo dinámico / autocompletar | DEFENSORES | No | — |
| SIN-CEL-20 | 20. Fecha de análisis jurídico del caso | Fecha | — | No | — |
| SIN-CEL-21 | 21. Análisis jurídico y actuación a desplegar | Selección única | CELESTE_ACTUACION | No | — |
| SIN-CEL-22 | 22. Resumen del análisis jurídico del caso | Texto largo | — | No | — |

## Sindicado — CELESTE

Bloque: **BLOQUE 4 (SINDICADOS) - Entrevista con el usuario**

| ID | Pregunta exacta | Tipo | Catálogo | Exclusiva utilidad pública | Condición |
|---|---|---|---|---|---|
| SIN-CEL-23 | 23. Fecha de la entrevista para informar al usuario | Fecha | — | No | Visible después de completar las preguntas 19 a 22 y si 21 inicia con “Se avanzará”. |

## Sindicado — CELESTE

Bloque: **BLOQUE 5 (SINDICADOS) - Trámite de la solicitud**

| ID | Pregunta exacta | Tipo | Catálogo | Exclusiva utilidad pública | Condición |
|---|---|---|---|---|---|
| SIN-CEL-24 | 24. Fecha de presentación de la solicitud de audiencia | Fecha | — | No | Visible después de diligenciar 23. Fecha de la entrevista para informar al usuario. |
| SIN-CEL-25 | 25. Fecha de realización de la audiencia | Fecha | — | No | — |
| SIN-CEL-26 | 26. Sentido de la decisión | Selección única | CELESTE_SENTIDO_DECISION | No | — |
| SIN-CEL-27 | 27. Motivo de la decisión negativa | Selección única | CELESTE_MOTIVO_NEGATIVA | No | Se habilita cuando 26. Sentido de la decisión = Niega la solicitud. |
| SIN-CEL-28 | 28. Se presenta recurso | Selección única | SI_NO | No | — |
| SIN-CEL-29 | 29. Fecha de presentación del recurso | Fecha | — | No | Se habilita cuando 28. Se presenta recurso = Sí. |
| SIN-CEL-30 | 30. Fecha de la decisión del recurso | Fecha | — | No | Se habilita cuando 28. Se presenta recurso = Sí. |
| SIN-CEL-31 | 31. Sentido de la decisión que resuelve recurso | Selección única | CELESTE_SENTIDO_RECURSO | No | Se habilita cuando 28. Se presenta recurso = Sí. |

## Catálogos y opciones exactas

### TIPO_IDENTIFICACION — Tipo de identificación

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | CC | CC |
| 2 | CE | CE |
| 3 | PASAPORTE | PASAPORTE |
| 4 | OTRA | OTRA |

### SITUACION_JURIDICA — Situación jurídica

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Condenado | Condenado |
| 2 | Sindicado | Sindicado |

### GENERO — Género

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Masculino | Masculino |
| 2 | Femenino | Femenino |
| 3 | Queer | Queer |
| 4 | Mujer trans | Mujer trans |
| 5 | Hombre trans | Hombre trans |
| 6 | Persona no binaria | Persona no binaria |
| 7 | Prefiere no responder | Prefiere no responder |
| 8 | Otra identidad | Otra identidad |

### ENFOQUE_ETNICO — Enfoque étnico/racial/cultural

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Negro | Negro |
| 2 | Afrocolombiano (a) / Afrodescendiente | Afrocolombiano (a) / Afrodescendiente |
| 3 | Raizal | Raizal |
| 4 | Palenquero | Palenquero |
| 5 | Gitano (a) o Rrom | Gitano (a) o Rrom |
| 6 | Indígena | Indígena |

### LUGAR_PRIVACION — Lugar de privación de la libertad

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | CDT | CDT |
| 2 | ERON | ERON |

### FASE_TRATAMIENTO — Fase de tratamiento

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | OBS | Observación |
| 2 | ALT | Alta |
| 3 | MED | Mediana |
| 4 | MIN | Mínima |
| 5 | CON | Confianza |
| 6 | SIN | No reporta |

### REQUERIMIENTOS_JUDICIALES — Requerimientos judiciales

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | S | Sí |
| 2 | N | No |

### CALIFICACION_CONDUCTA — Calificación de conducta

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Ejemplar | Ejemplar |
| 2 | Excelente | Excelente |
| 3 | Buena | Buena |
| 4 | Regular | Regular |
| 5 | Mala | Mala |
| 6 | Pendiente | Pendiente |
| 7 | Sin registro | Sin registro |

### DEFENSORES — Defensores públicos

Catálogo dinámico obtenido por la API `getDefensoresCatalogo`; las opciones no están codificadas en el repositorio.

### PROCEDENCIA_LIBERTAD — Procedencia de libertad condicional

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Sí procede solicitud de libertad condicional | 1. Sí procede solicitud de libertad condicional |
| 2 | Sí procederá proximamente libertad condicional (90 días o menos para cumplir tiempo) | 2. Sí procederá proximamente libertad condicional (90 días o menos para cumplir tiempo) |
| 3 | No aplica porque ya hay solicitud de libertad o subrogado penal en trámite | 3. No aplica porque ya hay solicitud de libertad o subrogado penal en trámite |
| 4 | No aplica porque ya está en libertad por pena cumplida | 4. No aplica porque ya está en libertad por pena cumplida |
| 5 | No aplica porque ya se concedió libertad condicional | 5. No aplica porque ya se concedió libertad condicional |
| 6 | No aplica porque ya se concedió prisión domiciliaria | 6. No aplica porque ya se concedió prisión domiciliaria |
| 7 | No aplica porque ya se concedió utilidad pública | 7. No aplica porque ya se concedió utilidad pública |
| 8 | No aplica porque el proceso no ha sido asignado a JEPMS | 8. No aplica porque el proceso no ha sido asignado a JEPMS |
| 9 | No aplica porque el proceso está en otro circuito judicial (falta trasladar el proceso al actual) | 9. No aplica porque el proceso está en otro circuito judicial (falta trasladar el proceso al actual) |
| 10 | No aplica porque la condena está por delito excluido del subrogado | 10. No aplica porque la condena está por delito excluido del subrogado |
| 11 | No aplica porque recientemente se le revocó subrogado penal | 11. No aplica porque recientemente se le revocó subrogado penal |
| 12 | No aplica porque recientemente se le negó subrogado penal | 12. No aplica porque recientemente se le negó subrogado penal |
| 13 | No aplica porque la evaluación de conducta es negativa | 13. No aplica porque la evaluación de conducta es negativa |
| 14 | No aplica porque se determinó que no ha cumplido requisito temporal para acceder | 14. No aplica porque se determinó que no ha cumplido requisito temporal para acceder |
| 15 | No aplica porque tiene acumulación de penas | 15. No aplica porque tiene acumulación de penas |
| 16 | No aplica porque la persona fue trasladada a otro ERON | 16. No aplica porque la persona fue trasladada a otro ERON |
| 17 | No aplica porque la persona está sindicada | 17. No aplica porque la persona está sindicada |
| 18 | No aplica porque la cartilla biográfica no está actualizada | 18. No aplica porque la cartilla biográfica no está actualizada |
| 19 | Revisión suspendida porque se requiere primero trámite de acumulación de penas | 19. Revisión suspendida porque se requiere primero trámite de acumulación de penas |
| 20 | No aplica porque el usuario no puede demostrar arraigo | 20. No aplica porque el usuario no puede demostrar arraigo |
| 21 | No aplica porque está en trámite solicitud de acumulación de penas | 21. No aplica porque está en trámite solicitud de acumulación de penas |

### PROCEDENCIA_DOMICILIARIA — Procedencia de prisión domiciliaria

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Sí procede solicitud de prisión domiciliaria de mitad de pena | 1. Sí procede solicitud de prisión domiciliaria de mitad de pena |
| 2 | Sí procederá proximamente prisión domiciliaria (90 días o menos para cumplir tiempo) | 2. Sí procederá proximamente prisión domiciliaria (90 días o menos para cumplir tiempo) |
| 3 | No aplica porque ya hay solicitud de libertad o subrogado penal en trámite | 3. No aplica porque ya hay solicitud de libertad o subrogado penal en trámite |
| 4 | No aplica porque ya está en libertad por pena cumplida | 4. No aplica porque ya está en libertad por pena cumplida |
| 5 | No aplica porque ya se concedió libertad condicional | 5. No aplica porque ya se concedió libertad condicional |
| 6 | No aplica porque ya se concedió prisión domiciliaria | 6. No aplica porque ya se concedió prisión domiciliaria |
| 7 | No aplica porque ya se concedió utilidad pública | 7. No aplica porque ya se concedió utilidad pública |
| 8 | No aplica porque el proceso no ha sido asignado a jepms | 8. No aplica porque el proceso no ha sido asignado a jepms |
| 9 | No aplica porque el proceso está en otro circuito judicial (falta trasladar el proceso al actual) | 9. No aplica porque el proceso está en otro circuito judicial (falta trasladar el proceso al actual) |
| 10 | No aplica porque la condena está por delito excluido del subrogado | 10. No aplica porque la condena está por delito excluido del subrogado |
| 11 | No aplica porque recientemente se le revocó un subrogado penal | 11. No aplica porque recientemente se le revocó un subrogado penal |
| 12 | No aplica porque recientemente se le negó subrogado penal | 12. No aplica porque recientemente se le negó subrogado penal |
| 13 | No aplica porque la evaluación de conducta es negativa | 13. No aplica porque la evaluación de conducta es negativa |
| 14 | No aplica porque se determinó que no ha cumplido requisito temporal para acceder | 14. No aplica porque se determinó que no ha cumplido requisito temporal para acceder |
| 15 | No aplica porque tiene acumulación de penas | 15. No aplica porque tiene acumulación de penas |
| 16 | No aplica porque la persona fue trasladada a otro ERON | 16. No aplica porque la persona fue trasladada a otro ERON |
| 17 | No aplica porque la persona está sindicada | 17. No aplica porque la persona está sindicada |
| 18 | No aplica porque la cartilla biográfica no está actualizada | 18. No aplica porque la cartilla biográfica no está actualizada |
| 19 | Revisión suspendida porque se requiere primero trámite de acumulación de penas | 19. Revisión suspendida porque se requiere primero trámite de acumulación de penas |
| 20 | No aplica porque el usuario no puede demostrar arraigo | 20. No aplica porque el usuario no puede demostrar arraigo |
| 21 | No aplica porque está en trámite solicitud de acumulación de penas | 21. No aplica porque está en trámite solicitud de acumulación de penas |

### PROCEDENCIA_UTILIDAD_PUBLICA — Procedencia de utilidad pública

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Sí cumple requisitos objetivos | 1. Sí cumple requisitos objetivos |
| 2 | No cumple por tipo de delito | 2. No cumple por tipo de delito |
| 3 | No cumple monto de pena | 3. No cumple monto de pena |
| 4 | No cumple por reincidencia | 4. No cumple por reincidencia |
| 5 | No cumple por delito excluido | 5. No cumple por delito excluido |
| 6 | No aplica porque está en trámite solicitud de acumulación de penas | 6. No aplica porque está en trámite solicitud de acumulación de penas |

### SI_NO — Sí / No

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Sí | Sí |
| 2 | No | No |

### PROCEDENCIA_ACUMULACION — Procedencia de acumulación de penas

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Sí | Sí |
| 2 | No | No |
| 3 | No aplica porque está en trámite solicitud de acumulación de penas | No aplica porque está en trámite solicitud de acumulación de penas |

### OTRAS_SOLICITUDES — Otras solicitudes a tramitar

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Ninguna | Ninguna |
| 2 | Solicitud de actualización de conducta | Solicitud de actualización de conducta |
| 3 | Solicitud de asignación de JEPMS | Solicitud de asignación de JEPMS |
| 4 | Solicitud de traslado del proceso al distrito judicial correspondiente | Solicitud de traslado del proceso al distrito judicial correspondiente |
| 5 | Solicitud de actualización de cartilla biográfica | Solicitud de actualización de cartilla biográfica |
| 6 | Solicitud de redención de pena 2x3 trabajo | Solicitud de redención de pena 2x3 trabajo |
| 7 | Solicitud de redención de pena 2x3 analógica en actividades distintas a trabajo | Solicitud de redención de pena 2x3 analógica en actividades distintas a trabajo |
| 8 | Permiso de 72 horas | Permiso de 72 horas |
| 9 | Otra | Otra |

### DECISION_USUARIO_AURORA — Decisión del usuario

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Sí, desea que el defensor(a) público(a) avance con la solicitud | Sí, desea que el defensor(a) público(a) avance con la solicitud |
| 2 | Sí desea que el defensor presente solicitud, pero suscrita por la persona privada de la Libertad. | Sí desea que el defensor presente solicitud, pero suscrita por la persona privada de la Libertad. |
| 3 | No, porque desea tramitar la solicitud a través de su defensor de confianza | No, porque desea tramitar la solicitud a través de su defensor de confianza |
| 4 | No desea tramitar la solicitud | No desea tramitar la solicitud |
| 5 | No avanzará porque no puede demostar arraigo fuera de prisión | No avanzará porque no puede demostar arraigo fuera de prisión |
| 6 | El usuario es renuente a la atención | El usuario es renuente a la atención |

### ACTUACION_ADELANTAR_AURORA — Actuación a adelantar

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Libertad condicional | Libertad condicional |
| 2 | Prisión domiciliaria | Prisión domiciliaria |
| 3 | Utilidad pública (solo mujeres) | Utilidad pública (solo mujeres) |
| 4 | Utilidad pública (solo mujeres) y prisión domiciliaria | Utilidad pública (solo mujeres) y prisión domiciliaria |
| 5 | Utilidad pública (solo mujeres) y libertad condicional | Utilidad pública (solo mujeres) y libertad condicional |
| 6 | Redención de pena y libertad condicional | Redención de pena y libertad condicional |
| 7 | Redención de pena y prisión domiciliaria | Redención de pena y prisión domiciliaria |
| 8 | Libertad condicional y en subsidio prisión domiciliaria | Libertad condicional y en subsidio prisión domiciliaria |
| 9 | Acumulación de penas | Acumulación de penas |
| 10 | Libertad por pena cumplida | Libertad por pena cumplida |
| 11 | Redención de pena y libertad por pena cumplida | Redención de pena y libertad por pena cumplida |
| 12 | Redención de pena | Redención de pena |
| 13 | Permiso de 72 horas | Permiso de 72 horas |
| 14 | Solicitud de actualización de conducta | Solicitud de actualización de conducta |
| 15 | Solicitud de asginación de JEPMS | Solicitud de asginación de JEPMS |
| 16 | Solicitud de traslado del proceso al distrito judicial correspondiente | Solicitud de traslado del proceso al distrito judicial correspondiente |
| 17 | Reiterar solicitud de subrogado penal ya radicada | Reiterar solicitud de subrogado penal ya radicada |
| 18 | Solicitud de actualización de cartilla biográfica | Solicitud de actualización de cartilla biográfica |
| 19 | Otra | Otra |
| 20 | Ninguna porque la persona está sindicada | Ninguna porque la persona está sindicada |
| 21 | Ninguna porque está en trámite una solicitud de subrogado penal o pena cumplida | Ninguna porque está en trámite una solicitud de subrogado penal o pena cumplida |
| 22 | Ninguna porque no procede subrogado penal en este momento por falta de cumplimiento de requisitos | Ninguna porque no procede subrogado penal en este momento por falta de cumplimiento de requisitos |
| 23 | Ninguna porque no procede subrogado penal por exclusión de delito | Ninguna porque no procede subrogado penal por exclusión de delito |
| 24 | Ninguna porque ya no está en prisión | Ninguna porque ya no está en prisión |

### PODER — Poder

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Sí se requiere | Sí se requiere |
| 2 | Ya se cuenta con poder | Ya se cuenta con poder |
| 3 | No requiere poder | No requiere poder |

### UP_SENTIDO_DECISION — Sentido de decisión de utilidad pública

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Otorga utilidad pública | Otorga utilidad pública |
| 2 | Niega utilidad pública | Niega utilidad pública |

### UP_MOTIVO_NEGATIVA — Motivo negativo de utilidad pública

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | No concede por requisito objetivo | No concede por requisito objetivo |
| 2 | No concede por requisito subjetivo | No concede por requisito subjetivo |
| 3 | No concede por requisitos objetivos y subjetivos | No concede por requisitos objetivos y subjetivos |
| 4 | Niega por falta de pruebas | Niega por falta de pruebas |
| 5 | Concede otro beneficio | Concede otro beneficio |
| 6 | Pena cumplida | Pena cumplida |

### UP_SENTIDO_RECURSO — Sentido de recurso de utilidad pública

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Otorga utilidad pública | Otorga utilidad pública |
| 2 | Niega utilidad pública | Niega utilidad pública |

### TRAMITE_SENTIDO_DECISION — Sentido de decisión del trámite general

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Concede la solicitud | Concede la solicitud |
| 2 | No concede la solicitud | No concede la solicitud |

### TRAMITE_MOTIVO_NEGATIVA — Motivo negativo del trámite general

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Porque no cumple aún con el tiempo para aplicar al subrogado | Porque no cumple aún con el tiempo para aplicar al subrogado |
| 2 | Porque falta documentación a remitir por parte del Inpec | Porque falta documentación a remitir por parte del Inpec |
| 3 | Porque la autoridad judicial no tuvo en cuenta todo el tiempo de privación de libertad de la persona en otros ERON o centro de detención transitoria | Porque la autoridad judicial no tuvo en cuenta todo el tiempo de privación de libertad de la persona en otros ERON o centro de detención transitoria |
| 4 | Por la valoración de la conducta punible contenida en la sentencia | Por la valoración de la conducta punible contenida en la sentencia |
| 5 | Porque el juez encuentra que el avance en el tratamiento penitenciario de la persona aún no es suficiente | Porque el juez encuentra que el avance en el tratamiento penitenciario de la persona aún no es suficiente |
| 6 | Porque tiene calificaciones de conducta negativa de periodos anteriores | Porque tiene calificaciones de conducta negativa de periodos anteriores |
| 7 | Porque no se demostró el arraigo familiar o social de la persona privada de la libertad | Porque no se demostró el arraigo familiar o social de la persona privada de la libertad |
| 8 | Porque no se ha reparado a la víctima o asegurado el pago de la indemnización a esta a través de garantía personal, real, bancaria o acuerdo de pago y tampoco se ha demostrado la insolvencia del condenado | Porque no se ha reparado a la víctima o asegurado el pago de la indemnización a esta a través de garantía personal, real, bancaria o acuerdo de pago y tampoco se ha demostrado la insolvencia del condenado |
| 9 | Porque determinó que hay un delito excluido que impide concesión | Porque determinó que hay un delito excluido que impide concesión |
| 10 | Porque la persona privada de la libertad pertenece al grupo familiar de la víctima | Porque la persona privada de la libertad pertenece al grupo familiar de la víctima |
| 11 | Porque no se demostró el arraigo familiar o social de la persona privada de la libertad | Porque no se demostró el arraigo familiar o social de la persona privada de la libertad |
| 12 | Porque la persona no tiene un lugar al que ir por fuera de prisión (no tiene arraigo) | Porque la persona no tiene un lugar al que ir por fuera de prisión (no tiene arraigo) |
| 13 | Porque no cumple requisito de jefatura de hogar para utilidad pública | Porque no cumple requisito de jefatura de hogar para utilidad pública |
| 14 | Porque no cumple requisito de marginalidad para utilidad pública | Porque no cumple requisito de marginalidad para utilidad pública |
| 15 | Se consideró que no cumple algún requisito para su procedencia | Se consideró que no cumple algún requisito para su procedencia |

### TRAMITE_SENTIDO_RECURSO — Sentido de recurso del trámite general

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Favorable | Favorable |
| 2 | Desfavorable | Desfavorable |

### CIERRE_IMPOSIBILIDAD — Cierre por imposibilidad de avanzar

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | - | - |
| 2 | Se cierra porque la persona ya no está en el ERON por razón ajena a este trámite. | Se cierra porque la persona ya no está en el ERON por razón ajena a este trámite. |
| 3 | Otro motivo. | Otro motivo. |

### CELESTE_ACTUACION — Análisis y actuación de sindicados

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Se avanzará con solicitud de revocatoria o sustitución de la medida | Se avanzará con solicitud de revocatoria o sustitución de la medida |
| 2 | No se avanzará con la revocatoria porque la persona ya fue condenada | No se avanzará con la revocatoria porque la persona ya fue condenada |
| 3 | No se avanzará con la revocatoria porque aún no reúne el tiempo exigido por la norma para solicitar el levantamiento de la detención preventiva | No se avanzará con la revocatoria porque aún no reúne el tiempo exigido por la norma para solicitar el levantamiento de la detención preventiva |
| 4 | No se avanzará con la revocatoria porque la persona está procesada por delitos en los que procede prórroga de la detención preventiva y aún no cumple ese tiempo | No se avanzará con la revocatoria porque la persona está procesada por delitos en los que procede prórroga de la detención preventiva y aún no cumple ese tiempo |
| 5 | No se avanzará con la revocatoria porque son tres o más los acusados y aún no se cumple el tiempo para solicitar el levantamiento de la detención preventiva en este supuesto | No se avanzará con la revocatoria porque son tres o más los acusados y aún no se cumple el tiempo para solicitar el levantamiento de la detención preventiva en este supuesto |
| 6 | No se avanzará con la revocatoria porque la persona está procesada por delitos atribuibles a Grupos Delictivos Organizados (GDO) o Grupos Armados Organizados (GAO) y aún no cumple el tiempo permitido | No se avanzará con la revocatoria porque la persona está procesada por delitos atribuibles a Grupos Delictivos Organizados (GDO) o Grupos Armados Organizados (GAO) y aún no cumple el tiempo permitido |
| 7 | No se avanzará con la revocatoria porque ya hay una solicitud en trámite | No se avanzará con la revocatoria porque ya hay una solicitud en trámite |
| 8 | No se avanzará porque no tiene defensor público asignado | No se avanzará porque no tiene defensor público asignado |
| 9 | No se avanzará porque ya no soy el defensor en este caso | No se avanzará porque ya no soy el defensor en este caso |

### CELESTE_SENTIDO_DECISION — Sentido de decisión de sindicados

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Revoca medida de aseguramiento privativa de la libertad | Revoca medida de aseguramiento privativa de la libertad |
| 2 | Sustituye medida de aseguramiento privativa de la libertad | Sustituye medida de aseguramiento privativa de la libertad |
| 3 | Niega la solicitud | Niega la solicitud |

### CELESTE_MOTIVO_NEGATIVA — Motivo negativo de sindicados

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Porque no cumple aún con los términos exigidos | Porque no cumple aún con los términos exigidos |
| 2 | Porque está procesado por causales en las que procede la prórroga de la medida | Porque está procesado por causales en las que procede la prórroga de la medida |
| 3 | Otra | Otra |

### CELESTE_SENTIDO_RECURSO — Sentido de recurso de sindicados

| Orden | Valor almacenado exacto | Opción visible exacta |
|---:|---|---|
| 1 | Concede levantamiento de medida de aseguramiento | Concede levantamiento de medida de aseguramiento |
| 2 | No concede levantamiento de medida de aseguramiento | No concede levantamiento de medida de aseguramiento |
