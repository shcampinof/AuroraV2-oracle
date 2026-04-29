# Mapeo de formularios y campos del aplicativo a Oracle

Documento generado desde el codigo actual. La notacion usada es `TABLA>COLUMNA`.

## Resumen rapido

- Tabla base de persona: `DNDP.PERSONA`.
- Tabla del caso/situacion penal: `DNDP.SITUACION_CARCELARIA`.
- Tabla de actuaciones/gestion juridica: `DNDP.GESTION_JURIDICA`.
- Tabla 1 a 1 de conducta: `DNDP.CALIFICACION_CONDUCTA`.
- Catalogos operativos: `DNDP.PAG` y `DNDP.DEFENSORES`.
- Los tres flujos documentados aqui son:
  - Aurora - condenados, tramite normal.
  - Aurora - condenados, utilidad publica.
  - Celeste - sindicados.

## Bloque 1 Comun

| Pregunta / campo UI | BD | Estado |
|---|---|---|
| 1. Nombre | `PERSONA>NOMBRE` | Lee/escribe |
| 2. Tipo de identificacion | `PERSONA>TIPO_IDENTIFICACION` | Lee/escribe |
| 3. Numero de identificacion | `PERSONA>NUMERO` | Lee/escribe |
| 4. Situacion Juridica | `SITUACION_CARCELARIA>SITUACION` | Lee/escribe |
| 5. Genero | `PERSONA>GENERO` | Lee/escribe |
| 6. Enfoque Etnico/Racial/Cultural | `SITUACION_CARCELARIA>ENFOQUE` | Lee/escribe |
| 7. Nacionalidad | `PERSONA>NACIONALIDAD` | Lee/escribe |
| 8. Fecha de nacimiento | `PERSONA>FECHA_NACIMIENTO` | Lee/escribe |
| 9. Edad | `PERSONA>EDAD` | Lee/escribe |
| 10. Lugar de privacion de la libertad | `SITUACION_CARCELARIA>LUGAR_PRIVACION` | Lee/escribe |
| 11. Nombre del lugar de privacion de la libertad | `SITUACION_CARCELARIA>ESTABLECIMIENTO` | Lee/escribe |
| 12. Departamento del lugar de privacion de la libertad | `SITUACION_CARCELARIA>DEPARTAMENTO` | Lee/escribe |
| 13. Distrito/municipio del lugar de privacion de la libertad | `SITUACION_CARCELARIA>MUNICIPIO` | Lee/escribe |

## Aurora - Bloque 2 Condenados

| Pregunta / campo UI | BD | Estado |
|---|---|---|
| 14. Autoridad a cargo | `SITUACION_CARCELARIA>AUTORIDAD` | Lee/escribe |
| 15. Numero de proceso | `SITUACION_CARCELARIA>PROCESO` | Lee/escribe |
| 16. Delitos | `SITUACION_CARCELARIA>DELITOS` | Lee/escribe |
| 17. Fecha de captura | `SITUACION_CARCELARIA>FECHA_CAPTURA` | Lee/escribe |
| 18. Pena (anos, meses y dias) | `SITUACION_CARCELARIA>PENA` | Lee/escribe |
| 19. Pena total en dias | `SITUACION_CARCELARIA>PENA_DIAS` | Lee/escribe |
| 20. Tiempo privada de la libertad en dias | `SITUACION_CARCELARIA>PRIVACION` | Lee/escribe |
| 21. Redencion total acumulada en dias | `SITUACION_CARCELARIA>REDENCION` | Lee/escribe |
| 22. Tiempo efectivo de pena cumplida | `SITUACION_CARCELARIA>TIEMPO_EFECTIVO` | Lee/escribe |
| 23. Porcentaje de avance de pena cumplida | `SITUACION_CARCELARIA>PORCENTAJE` | Lee/escribe |
| Dias restantes para prision domiciliaria | `SITUACION_CARCELARIA>DIAS_PRISION` | Lee/escribe por alias; UI usa fallback calculado si viene vacio |
| Dias restantes para libertad condicional | `SITUACION_CARCELARIA>DIAS_LIBERTAD` | Lee/escribe por alias; UI usa fallback calculado si viene vacio |
| 24. Fase de tratamiento | `SITUACION_CARCELARIA>FASE` | Lee/escribe |
| 25. Requerimientos judiciales por otros procesos | `SITUACION_CARCELARIA>REQUERIMIENTOS` | Lee/escribe |
| 26-27. Resumen de calificaciones de conducta | `CALIFICACION_CONDUCTA>CALIFICACION_1..4`, `ACTA_1..4`, `FECHA_INICIO_1..4`, `FECHA_FIN_1..4`, `FECHA_CALIFICACION_1..4` | Lee/escribe |
| 26. Fecha ultima calificacion | `CALIFICACION_CONDUCTA>FECHA_CALIFICACION_1` | Lee/escribe |
| 26. No. acta de calificacion | `CALIFICACION_CONDUCTA>ACTA_1` | Lee/escribe |
| 26. Evaluacion desde | `CALIFICACION_CONDUCTA>FECHA_INICIO_1` | Lee/escribe |
| 26. Evaluacion hasta | `CALIFICACION_CONDUCTA>FECHA_FIN_1` | Lee/escribe |
| 27. Calificacion de conducta | `CALIFICACION_CONDUCTA>CALIFICACION_1` | Lee/escribe |
| Calificaciones anteriores 2 a 4 | `CALIFICACION_CONDUCTA>*_2`, `*_3`, `*_4` | Lee/escribe |

## Aurora - Bloque 3 Analisis Juridico

| Pregunta / campo UI | BD | Estado |
|---|---|---|
| 28. Defensor(a) publico(a) asignado | `GESTION_JURIDICA>DEFENSOR` y opcionalmente `GESTION_JURIDICA>CEDULA_DEFENSOR` | Lee/escribe; asignacion usa catalogo |
| 29. Fecha de analisis juridico del caso | `GESTION_JURIDICA>FECHA_ANALISIS` | Lee/escribe |
| 30. Procedencia de libertad condicional | `GESTION_JURIDICA>LIBERTAD_CONDICIONAL` | Lee/escribe |
| 31. Procedencia de prision domiciliaria de mitad de pena | `GESTION_JURIDICA>PRISION_DOMICILIARIA_MITAD_PENA` | Lee/escribe |
| 32. Procedencia de utilidad publica | `GESTION_JURIDICA>UTILIDAD_PUBLICA` | Lee/escribe |
| 33. Procedencia de pena cumplida | `GESTION_JURIDICA>PROCEDENCIA_PENA_CUMPLIDA` | Lee/escribe |
| 34. Procedencia de acumulacion de penas | `GESTION_JURIDICA>PROCEDENCIA_ACUMULACION_PENAS` | Lee/escribe |
| 35. Con que proceso(s) debe acumular penas | `GESTION_JURIDICA>CON_QUE_PROCESOS_ACUMULAR` | Lee/escribe |
| 36. Otras solicitudes a tramitar | `GESTION_JURIDICA>OTRAS_SOLICITUDES_TRAMITAR` | Lee/escribe |
| 37. Resumen del analisis del caso | `GESTION_JURIDICA>RESUMEN_ANALISIS_CASO` | Lee/escribe |

## Aurora - Bloque 4 Entrevista

| Pregunta / campo UI | BD | Estado |
|---|---|---|
| 38. Fecha de entrevista | `GESTION_JURIDICA>FECHA_ENTREVISTA` | Lee/escribe |
| 39. Decision del usuario | `GESTION_JURIDICA>DECISION_USUARIO` | Lee/escribe |
| 40. Actuacion a adelantar | `GESTION_JURIDICA>ACTUACION_ADELANTAR` | Lee/escribe |
| 41. Requiere pruebas | `GESTION_JURIDICA>REQUIERE_PRUEBAS` | Lee/escribe |
| 42. Poder en caso de avanzar con la solicitud | `GESTION_JURIDICA>PODER_AVANZAR_SOLICITUD` | Lee/escribe |

## Aurora - Bloque 5A Utilidad Publica

| Pregunta / campo UI | BD | Estado |
|---|---|---|
| 43. Fecha de entrevista psicosocial | `GESTION_JURIDICA>FECHA_ENTREVISTA_PSICOSOCIAL` | Lee/escribe |
| 44. Cumple requisito de marginalidad | `GESTION_JURIDICA>CUMPLE_REQUISITO_MARGINALIDAD` | Lee/escribe |
| 45. Cumple requisito de jefatura de hogar | `GESTION_JURIDICA>CUMPLE_REQUISITO_JEFATURA_HOGAR` | Lee/escribe |
| 46. Se requiere mision de trabajo | `GESTION_JURIDICA>REQUIERE_MISION_TRABAJO` | Lee/escribe |
| 47. Fecha de solicitud de mision de trabajo | `GESTION_JURIDICA>FECHA_SOLICITUD_MISION_TRABAJO` | Lee/escribe |
| 48. Fecha de asignacion de investigador | `GESTION_JURIDICA>FECHA_ASIGNACION_INVESTIGADOR` | Lee/escribe |
| 49. Fecha en la que se reciben todas las pruebas | `GESTION_JURIDICA>FECHA_RECEPCION_TODAS_PRUEBAS` | Lee/escribe |
| 50. Fecha de radicacion de solicitud de utilidad publica | `GESTION_JURIDICA>FECHA_RADICACION_UTILIDAD` | Lee/escribe |
| 51. Fecha de decision de la autoridad | `GESTION_JURIDICA>FECHA_DECISION_AUTORIDAD` | Lee/escribe |
| 52. Sentido de la decision | `GESTION_JURIDICA>SENTIDO_DECISION` | Lee/escribe |
| 53. Motivo de la decision negativa | `GESTION_JURIDICA>MOTIVO_DECISION_NEGATIVA` | Lee/escribe |
| 54. Se presenta recurso | `GESTION_JURIDICA>SE_PRESENTA_RECURSO` | Lee/escribe |
| 55. Fecha de presentacion del recurso | `GESTION_JURIDICA>FECHA_PRESENTACION_RECURSO` | Lee/escribe |
| 56. Fecha de la decision del recurso | `GESTION_JURIDICA>FECHA_DECISION_RECURSO` | Lee/escribe |
| 57. Sentido de la decision que resuelve recurso | `GESTION_JURIDICA>SENTIDO_DECISION_RESUELVE_RECURSO` | Lee/escribe |
| 58. Cierre del caso por imposibilidad de avanzar | `GESTION_JURIDICA>CIERRE_CASO` | Lee/escribe |

## Aurora - Bloque 5B Tramite Normal

| Pregunta / campo UI | BD | Estado |
|---|---|---|
| 43. Fecha de recepcion de pruebas aportadas por el usuario | `GESTION_JURIDICA>FECHA_RECEPCION_PRUEBAS_USUARIO` | Lee/escribe |
| 44. Fecha de solicitud de documentos al INPEC | `GESTION_JURIDICA>FECHA_SOLICITUD_DOCS_INPEC` | Lee/escribe |
| 45. Fecha de presentacion de la solicitud a la autoridad | `GESTION_JURIDICA>FECHA_PRESENTACION_SOLICITUD_AUTORIDAD` | Lee/escribe |
| 46. Fecha de decision de la autoridad | `GESTION_JURIDICA>FECHA_DECISION_AUTORIDAD` | Lee/escribe |
| 47. Sentido de la decision | `GESTION_JURIDICA>SENTIDO_DECISION` | Lee/escribe |
| 48. Motivo de la decision negativa | `GESTION_JURIDICA>MOTIVO_DECISION_NEGATIVA` | Lee/escribe |
| 49. Se presenta recurso | `GESTION_JURIDICA>SE_PRESENTA_RECURSO` | Lee/escribe |
| 50. Fecha de presentacion del recurso | `GESTION_JURIDICA>FECHA_PRESENTACION_RECURSO` | Lee/escribe |
| 51. Fecha de la decision del recurso | `GESTION_JURIDICA>FECHA_DECISION_RECURSO` | Lee/escribe |
| 52. Sentido de la decision que resuelve la solicitud | `GESTION_JURIDICA>SENTIDO_DECISION_RESUELVE_RECURSO` | Lee/escribe temporalmente en la misma columna de recurso |
| 53. Cierre del caso por imposibilidad de avanzar | `GESTION_JURIDICA>CIERRE_CASO` | Lee/escribe |

## Celeste - Sindicados

| Pregunta / campo UI | BD | Estado |
|---|---|---|
| 14. Autoridad a cargo | `SITUACION_CARCELARIA>AUTORIDAD` | Lee/escribe |
| 15. Numero de proceso | `SITUACION_CARCELARIA>PROCESO` | Lee/escribe |
| 16. Delitos | `SITUACION_CARCELARIA>DELITOS` | Lee/escribe |
| 17. Fecha de captura | `SITUACION_CARCELARIA>FECHA_CAPTURA` | Lee/escribe |
| 18. Tiempo privada de la libertad en meses | Sin columna directa | Calculado en frontend desde `PRIVACION` o `FECHA_CAPTURA`; no guarda en BD |
| 19. Defensor(a) publico(a) asignado | `GESTION_JURIDICA>DEFENSOR` y opcionalmente `GESTION_JURIDICA>CEDULA_DEFENSOR` | Lee/escribe |
| 20. Fecha de analisis juridico del caso | `GESTION_JURIDICA>FECHA_ANALISIS` | Lee/escribe |
| 21. Analisis juridico y actuacion a desplegar | `GESTION_JURIDICA>ACTUACION_ADELANTAR` | Lee/escribe |
| 22. Resumen del analisis juridico del presente caso | `GESTION_JURIDICA>RESUMEN_ANALISIS_CASO` | Lee/escribe |
| 23. Fecha de entrevista para informar al usuario | `GESTION_JURIDICA>FECHA_ENTREVISTA` | Lee/escribe |
| 24. Fecha de presentacion de solicitud de audiencia | `GESTION_JURIDICA>FECHA_SOLICITUD_AUDIENCIA_CONTROL` | Lee/escribe |
| 25. Fecha de realizacion de la audiencia | `GESTION_JURIDICA>FECHA_REALIZACION_AUDIENCIA` | Lee/escribe |
| 26. Sentido de la decision | `GESTION_JURIDICA>SENTIDO_DECISION` | Lee/escribe |
| 27. Motivo de la decision negativa | `GESTION_JURIDICA>MOTIVO_DECISION_NEGATIVA` | Lee/escribe si el payload usa el nombre sin mayusculas exactas; el nombre actual de Celeste en mayusculas no tiene alias directo |
| 28. Se presenta recurso | `GESTION_JURIDICA>SE_PRESENTA_RECURSO` | Lee/escribe |
| 29. Fecha de presentacion del recurso | `GESTION_JURIDICA>FECHA_PRESENTACION_RECURSO` | Lee/escribe |
| 30. Fecha de la decision del recurso | `GESTION_JURIDICA>FECHA_DECISION_RECURSO` | Lee/escribe |
| 31. Sentido de la decision que resuelve recurso | `GESTION_JURIDICA>SENTIDO_DECISION_RESUELVE_RECURSO` | Lee/escribe |

## PAG - Asignacion y reasignacion

| Campo UI / operativo | BD | Estado |
|---|---|---|
| Validacion de cedula PAG | `PAG>CEDULA`, `PAG>NOMBRE_PAG` | Lee catalogo |
| Cedula del PAG que asigna | `GESTION_JURIDICA>CEDULA_PAG` | Guarda al asignar/reasignar defensor |
| Nombre/cadena PAG asignador | `GESTION_JURIDICA>PAG` | Guarda texto tipo `Nombre (cedula)` |
| Nuevo defensor | `DEFENSORES>CEDULA`, `DEFENSORES>NOMBRE` y `GESTION_JURIDICA>DEFENSOR`, `GESTION_JURIDICA>CEDULA_DEFENSOR` | Lee catalogo y guarda asignacion |
| Crear defensor | `DEFENSORES>CEDULA`, `DEFENSORES>NOMBRE`, `DEFENSORES>CORREO`, `DEFENSORES>REGIONAL`, `DEFENSORES>CEDULA_PAG` | Inserta catalogo |
| Potenciales beneficiarios / proximos a cumplir requisito temporal | `SITUACION_CARCELARIA>CATEGORIZACION` | Lee para filtro; beneficiarios: Prision Domiciliaria y Libertad condicional, Prision Domiciliaria, Revisar por pena, Libertad condicional, Utilidad Publica; proximos: Preliminar Prision Domiciliaria, Preliminar Libertad condicional |
| Accion a impulsar en tabla PAG | `GESTION_JURIDICA>ACCION_REALIZAR` | Lee valor directo de base de datos |
| Filtros departamento/municipio/lugar/documento | `SITUACION_CARCELARIA>DEPARTAMENTO`, `MUNICIPIO`, `ESTABLECIMIENTO`; `PERSONA>NUMERO` | Lee |

## Otros campos del aplicativo

| Campo | BD | Estado |
|---|---|---|
| Estado del caso | Sin columna Oracle directa | Derivado en frontend como Activo/Cerrado; no se lee desde BD |
| Estado del tramite | Sin columna Oracle directa | Derivado por reglas Aurora/Celeste y por `ACCION_REALIZAR`/`ACTUACION_ADELANTAR` en listados |
| Accion a impulsar / Accion a realizar | `GESTION_JURIDICA>ACCION_REALIZAR` | Lee/escribe si llega en payload; usado en tabla PAG |
| Fecha de asignacion del PAG | Sin columna mapeada actualmente | En listados Oracle se proyecta como `NULL`; no guarda |
| Herramienta | Sin columna Oracle mapeada | Campo legado/CSV; no persiste en Oracle |
| redirectedToAurora | Sin columna Oracle mapeada | Control de flujo legado; no persiste en Oracle |
| posibleActuacionJudicial | Derivado de `GESTION_JURIDICA>ACTUACION_ADELANTAR` | No es columna |
| Fecha de actualizacion de datos (corte) | Constante UI `15/04/2026` | No viene de BD |
| IDs internos de actuacion | `PERSONA>ID_PERSONA`, `SITUACION_CARCELARIA>ID_SITUACION`, `GESTION_JURIDICA>ID_GESTION` | Internos para actualizar/consultar |

## Columnas conocidas por el codigo con uso parcial o sin uso visible

### `DNDP.PERSONA`

| Columna | Uso actual |
|---|---|
| `ID_PERSONA` | Interna para joins y updates |
| `FECHA_CREACION` | Proyectada/permitida en repositorio, pero no se muestra ni se diligencia en formulario |

### `DNDP.SITUACION_CARCELARIA`

| Columna | Uso actual |
|---|---|
| `ID_SITUACION` | Interna para joins y relacion 1 a 1 con gestion/calificacion |
| `ID_PERSONA` | Interna para join con persona |
| `FECHA_REGISTRO` | Usada para ordenar situacion activa; no UI |
| `ACTIVO` | Usada para elegir situacion activa; no UI |
| `ATENCION_MEDICA` | Proyectada en SELECT y permitida para update, pero no tiene campo visible activo ni alias de formulario |
| `GESTACION` | Proyectada en SELECT y permitida para update, pero no tiene campo visible activo ni alias de formulario |
| `CABEZA_FAMILIA` | Proyectada en SELECT y permitida para update, pero no tiene campo visible activo ni alias de formulario |
| `CATEGORIZACION` | Usada en PAG para potenciales beneficiarios y proximos a cumplir requisito temporal; no se edita en formulario |
| `DIAS_PRISION`, `DIAS_LIBERTAD` | Leidas por formulario; si vienen vacias, UI calcula un fallback |

### `DNDP.GESTION_JURIDICA`

| Columna | Uso actual |
|---|---|
| `ID_GESTION` | Interna para historial/actuacion activa |
| `ID_SITUACION` | Interna para relacion con situacion |
| `FECHA_REGISTRO` | Se asigna al insertar y ordena historial; no UI |
| `CEDULA_DEFENSOR` | Se guarda desde catalogo/asignacion; no se diligencia manualmente |
| `CEDULA_PAG` | Se guarda al asignar defensor; no se muestra como pregunta |
| `PAG` | Guarda texto de asignador PAG; no es pregunta del formulario juridico |
| `FECHA_RECURSO_DESFAVORABLE` | Alias legacy; se mantiene compatibilidad, pero el campo nuevo principal es `FECHA_PRESENTACION_RECURSO` |
| `CONFIRMACION_PROCEDENCIA_VENCIMIENTO` | Mapeada para Celeste/legado, pero no aparece como pregunta independiente visible en el formulario actual |
| `SENTIDO_DECISION_RESUELVE_RECURSO` | Usada por utilidad publica, por la pregunta 52 de tramite normal y por Celeste Q31 |

### `DNDP.CALIFICACION_CONDUCTA`

| Columna | Uso actual |
|---|---|
| `ID_CALIFICACION` | Interna; se genera por `MAX + 1` en upsert |
| `ID_SITUACION` | Relacion 1 a 1 con `SITUACION_CARCELARIA` |
| `FECHA_REGISTRO` | Se actualiza automaticamente en upsert; no UI |
| `CALIFICACION_1..4`, `ACTA_1..4`, `FECHA_INICIO_1..4`, `FECHA_FIN_1..4`, `FECHA_CALIFICACION_1..4` | Usadas por tabla de calificacion de conducta |

## Campos de UI que no halan informacion de BD

- `Estado del caso`: derivado en frontend; no se lee desde una columna.
- `Estado del tramite`: derivado por reglas; no se lee desde una columna.
- `Fecha de asignacion del PAG`: proyectada como `NULL` en listados.
- `Herramienta`: legado/CSV, sin mapeo Oracle.
- `redirectedToAurora`: control de flujo, sin mapeo Oracle.
- `Fecha de actualizacion de datos (corte)`: constante de UI.
- `Tiempo que la persona lleva privada de la libertad (en meses)`: calculado en frontend para Celeste.
## Recomendaciones de ajuste

1. Decidir si `Estado del caso` y `Estado del tramite` deben persistirse en `GESTION_JURIDICA`; hoy son derivados.
2. Definir si `ATENCION_MEDICA`, `GESTACION` y `CABEZA_FAMILIA` volveran a UI o se retiraran del contrato activo.
