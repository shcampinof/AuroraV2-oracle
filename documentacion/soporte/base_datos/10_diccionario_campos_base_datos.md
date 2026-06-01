# AURORA - Campos para base de datos



## RESUMEN

- Hoy el consolidado maneja `83` columnas canonicas.
- El formulario usa `71` nombres de campo visibles.
- Hay campos auxiliares y metadatos que no conviene guardar como columnas del usuario.
- `PAG` debe quedar relacionado aunque no se diligencie desde el formulario.
- `Defensor` debe quedar relacionado y no solo como texto libre.
- `Estado del caso` y `Estado/accion a impulsar` deben quedar separados.

## POSIBLES TABLAS

### Tabla `ppl`

Tabla principal del usuario/caso base.

Campos recomendados:

- `id`
- `nombre`
- `tipo_identificacion`
- `numero_identificacion`
- `situacion_juridica`
- `genero`
- `enfoque_etnico_racial_cultural`
- `nacionalidad`
- `fecha_nacimiento`
- `edad`
- `lugar_privacion_libertad`
- `establecimiento`
- `departamento`
- `municipio`
- `sigue_en_cdt`
- `autoridad_cargo`
- `numero_proceso`
- `delitos`
- `situacion_juridica_actualizada`
- `fecha_captura`
- `pena_texto`
- `pena_total_dias`
- `tiempo_privacion_dias`
- `redencion_total_dias`
- `tiempo_efectivo_dias`
- `porcentaje_avance_pena`
- `fase_tratamiento`
- `requerimientos_judiciales`
- `fecha_ultima_calificacion`
- `calificacion_conducta`
- `numero_acta_calificacion`
- `evaluacion_conducta_desde`
- `evaluacion_conducta_hasta`

### Tabla `actuaciones`

Tabla historial por gestion/entrevista/seguimiento.

Campos recomendados:

- `id`
- `ppl_id`
- `defensor_id`
- `pag_id`
- `herramienta`
- `fecha_asignacion_pag`
- `estado_caso_raw`
- `estado_tramite_logico`
- `accion_a_realizar`
- `actuacion_a_adelantar`
- `fecha_analisis_juridico`
- `requiere_atencion_medica_permanente`
- `gestacion`
- `mujer_cabeza_familia`
- `procedencia_vencimiento_terminos`
- `procedencia_utilidad_publica`
- `procedencia_libertad_condicional`
- `procedencia_prision_domiciliaria`
- `procedencia_pena_cumplida`
- `procedencia_acumulacion_penas`
- `proceso_para_acumular_penas`
- `otras_solicitudes_tramitar`
- `resumen_analisis_caso`
- `resumen_analisis_juridico_presente_caso`
- `fecha_entrevista`
- `decision_usuario`
- `requiere_pruebas`
- `poder_avanzar_solicitud`
- `fecha_entrevista_psicosocial`
- `cumple_marginalidad`
- `cumple_jefatura_hogar`
- `requiere_mision_trabajo`
- `fecha_solicitud_mision_trabajo`
- `fecha_asignacion_investigador`
- `fecha_recepcion_total_pruebas`
- `fecha_recepcion_pruebas_usuario`
- `fecha_solicitud_documentos_inpec`
- `fecha_revision_expediente_emps`
- `confirmacion_procedencia_vencimiento`
- `fecha_solicitud_audiencia_control`
- `fecha_realizacion_audiencia`
- `fecha_presentacion_solicitud_autoridad`
- `fecha_decision_autoridad`
- `sentido_decision`
- `motivo_decision_negativa`
- `se_presenta_recurso`
- `fecha_recurso_desfavorable`
- `sentido_decision_resuelve_recurso`
- `sentido_decision_resuelve_solicitud`
- `se_recurrio_decision_negativa`
- `fecha_presentacion_recurso`
- `redirected_to_aurora`
- `cierre_imposibilidad_avanzar`
- `cierre_imposibilidad_avanzar_utilidad_publica`
- `fecha_radicacion_solicitud_utilidad_publica`
- `created_at`
- `updated_at`

### Tabla `pag`

Campos que hoy existen en el archivo actual de PAG:

- `cedula`
- `nombre`
- `clase`
- `gr`
- `denominacion`
- `dependencia`
- `correo`

### Tabla `defensores`

Campo que hoy existe en el archivo actual de defensores:

- `nombre`

## Inventario canonico actual de columnas persistidas

Esta es la lista canonica que hoy reconoce el backend para la integración con base de datos.

### Identificacion, ubicacion y proceso

- `Nombre`
- `Tipo de indentificación`
- `Número de identificación`
- `Situación Jurídica`
- `Género`
- `Enfoque Étnico/Racial/Cultural`
- `Nacionalidad`
- `Fecha de nacimiento`
- `Edad`
- `Lugar de privación de la libertad`
- `Nombre del lugar de privación de la libertad`
- `Departamento del lugar de privación de la libertad`
- `Distrito/municipio del lugar de privación de la libertad`
- `¿ La persona sigue en el CDT?`
- `Autoridad a cargo`
- `Número de proceso`
- `Delitos`
- `Situación Jurídica actualizada (de conformidad con la rama judicial)`
- `Fecha de captura`
- `Pena (años, meses y días)`
- `Pena total en días`
- `Tiempo que la persona lleva privada de la libertad (en días)`
- `Redención total acumulada en días`
- `Tiempo efectivo de pena cumplida en días (teniendo en cuenta la redención)`
- `Porcentaje de avance de pena cumplida`
- `Fase de tramiento`
- `Requerimientos`
- `Fecha última calificación`
- `Calificación de conducta`
- `No.Acta de calificación de conducta`
- `Evaluación de conducta desde`
- `Evaluación de conducta hasta`

### Asignacion y control del caso

- `PAG`
- `Defensor(a) Público(a) Asignado para tramitar la solicitud`
- `Herramienta`
- `Estado del caso`
- `Acción a realizar`
- `redirectedToAurora`

### Analisis juridico y procedencias

- `Fecha de análisis jurídico del caso`
- `¿REQUIERE ATENCIÓN MÉDICA PERMANENTE?`
- `¿ESTÁ EN ESTADO DE GESTACIÓN?`
- `¿ES MUJER CABEZA DE FAMILIA?`
- `PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS`
- `Procedencia de utilidad pública (solo para mujeres)`
- `Procedencia de libertad condicional`
- `Procedencia de prisión domiciliaria de mitad de pena`
- `Procedencia de pena cumplida`
- `Procedencia de acumulación de penas`
- `Con qué proceso(s) debe acumular penas (si aplica)`
- `Otras solicitudes a tramitar`
- `Resumen del análisis del caso`
- `RESUMEN DEL ANÁLISIS JURÍDICO DEL PRESENTE CASO`

### Entrevista y decision del usuario

- `Fecha de entrevista`
- `Decisión del usuario`
  - En reglas de flujo Aurora, cualquier opcion afirmativa que inicie por `Sí` permite continuidad (incluye: `Sí desea que el defensor presente solicitud, pero suscrita por la persona privada de la Libertad.`).
- `Actuación a adelantar`
- `Requiere pruebas`
- `Poder en caso de avanzar con la solicitud`
  - Incluye opcion catalogada: `No requiere poder` (sin efectos adicionales de bloqueo/desbloqueo).
  - Regla: en tramite normal, `Requiere pruebas` controla la habilitacion de `Fecha de recepción de pruebas aportadas por el usuario (Si aplica)`.

### Tramite de utilidad publica

- `Fecha de entrevista psicosocial`
- `Cumple el requisito de marginalidad`
- `Cumple el requisito de jefatura de hogar`
- `Se requiere misión de trabajo`
- `Fecha de solicitud de misión de trabajo`
- `Fecha de asignación de investigador`
- `Fecha en la que se reciben todas las pruebas`
- `Fecha de radicación de solicitud de utilidad pública`

### Tramite general, recursos y decisiones

- `Fecha de recepción de pruebas aportadas por el usuario (Si aplica)`
  - Regla: solo aplica/habilita cuando `Requiere pruebas` = `Sí`.
- `Fecha de solicitud de documentos al INPEC (Si aplica)`
- `FECHA DE REVISIÓN DEL EXPEDIENTE Y ELEMENTOS MATERIALES PROBATORIOS`
- `CONFIRMACIÓN DE LA PROCEDENCIA DE LA SOLICITUD DE VENCIMIENTO DE TÉRMINOS`
- `FECHA DE SOLICITUD DE AUDIENCIA DE CONTROL DE GARANTÍAS PARA SUSTENTAR REVOCATORIA`
- `FECHA DE REALIZACIÓN DE AUDIENCIA`
- `Fecha de presentación de solicitud a la autoridad`
- `Fecha de decisión de la autoridad`
- `Sentido de la decisión`
  - En tramite normal (Q47): opciones de interfaz `Concede la solicitud` / `No concede la solicitud` (con compatibilidad para valores historicos `Concede/No concede subrogado penal`).
- `Motivo de la decisión negativa`
- `Se presenta recurso`
- `Fecha de recurso en caso desfavorable` (alias legacy, mantener compatibilidad)
- `Sentido de la decisión que resuelve recurso`
- `Sentido de la decisión que resuelve la solicitud`
- `¿SE RECURRIÓ EN CASO DE DECISIÓN NEGATIVA?`
- `Fecha de presentación del recurso`
- `Fecha de la decisión del recurso`

### Cierres

- `Cierre del caso por imposibilidad de avanzar (si aplica)`
- `Cierre del caso por imposibilidad de avanzar (si aplica) - Utilidad pública`

## Campos que no conviene guardar como columnas directas del usuario

Estos campos aparecen en UI o en la logica, pero no corresponden a datos base del usuario:

- `Días restantes para cumplir requisito temporal de prisión domiciliaria`
- `Días restantes para cumplir requisito temporal de libertad condicional`
- `esPotencialSubrogado`
- `actuacionId`
- `rowIndex`
- `caseId`
- `activeCaseId`
- `casos`
- `actuaciones`
- `createdAt` como reemplazo de historial improvisado

Lo mejor es resolverlos como:

- calculos en backend,
- PK/FK reales,
- historial en tabla `actuaciones`,
- timestamps tecnicos.

## Estado del caso vs estado/accion a impulsar

Esto conviene dejarlo separado en la base:

- `Estado del caso` hoy no representa por si solo todo el estado funcional del tramite.
- El sistema usa tambien `Acción a realizar`, `Actuación a adelantar` y reglas derivadas del formulario.
- En listados se manejan estados logicos como:
  - `Analizar el caso`
  - `Entrevistar al usuario`
  - `Pendiente audiencia`
  - `Pendiente decisión de audiencia`
  - `Presentar solicitud`
  - `Pendiente decisión`
  - `Presentar recurso`
  - `Caso cerrado`

Por eso conviene guardar por separado:

- `estado_caso_raw`
- `estado_tramite_logico`
- `accion_a_realizar`
- `actuacion_a_adelantar`

## Alias y duplicidades que conviene unificar

No vale la pena repetir columnas por variaciones heredadas. En la base esto deberia quedar unificado.

Casos importantes:

- `Defensor` debe unificarse como FK a `defensores`.
- `PAG` debe unificarse como FK a `pag`.
- `Fecha de presentación de solicitud a la autoridad` y `Fecha de presentación de la solicitud a la autoridad` deben ser una sola.
- `Fecha de radicación de solicitud de utilidad pública` y `Fecha de radicación de la solicitud de utilidad pública` deben ser una sola.
- Las variantes por mayusculas/minusculas de campos de Celeste deben mapear a una sola columna canonica.
- `Tipo de indentificación` hoy tiene error de escritura heredado; en base nueva debe quedar como `tipo_identificacion`.

## Criterio sugerido para implementacion

Si la idea es dejar la base ordenada, este seria el criterio:

1. Crear `ppl` como tabla base del usuario/caso.
2. Crear `actuaciones` como tabla historica de todo lo diligenciado desde bloque 3 en adelante.
3. Mantener catalogos separados de `pag` y `defensores`.
4. Guardar `pag_id` y `defensor_id` al menos en `actuaciones`.
5. Agregar `fecha_asignacion_pag`, aunque hoy no este formalizada como columna de formulario.
6. Separar `estado_caso_raw` de `estado_tramite_logico`.
7. Eliminar de la base toda duplicidad nacida por aliases historicos.

## Fuentes del inventario

El inventario se consolido revisando estas piezas del proyecto:

- `backend/db/oracleConsolidado.repo.js`
- `backend/routes/ppl.js`
- `backend/repositories/oracle/pagRepository.js`
- `backend/repositories/oracle/defensoresRepository.js`
- `frontend/src/pages/FormularioAtencion.jsx`
- `frontend/src/config/formRules.aurora.ts`
- `frontend/src/config/formRules.celeste.ts`
- `frontend/src/config/estadoActuaciones.rules.ts`

## Nota operativa sobre ultimo estado

- El estado funcional (`estado_caso_raw` y `estado_tramite_logico`) debe calcularse y persistirse sobre la actuacion activa o mas reciente.
- Conviene guardar un puntero explicito (`actuacion_id_activa` o equivalente) para asegurar lectura/escritura del ultimo estado.
