# AURORA - Protocolo de Pruebas (v1)

## 1. Objetivo

Definir un protocolo mínimo, pero robusto, para validar la aplicación en sus flujos críticos y reducir regresiones funcionales antes de cada despliegue.

Este protocolo cubre:

- flujo Aurora (personas condenadas);
- flujo Celeste (personas sindicadas);
- asignación de defensores y listados operativos;
- persistencia de actuaciones en CSV e historial;
- contratos API críticos;
- calidad de codificación de texto (UTF-8 y mojibake).

## 2. Niveles de prueba

1. Pruebas automáticas de humo:
   - lint, unit tests y build de frontend;
   - validación rápida de backend (runner actual).
2. Pruebas de regresión funcional:
   - escenarios de negocio por flujo con datos representativos.
3. Pruebas de preliberación:
   - muestra ampliada de casos, validaciones de persistencia y verificación de evidencias.

## 3. Criterios de entrada y salida

### 3.1 Entrada para ejecutar protocolo

- rama integrada y sin conflictos;
- datos base cargados (`backend/data/consolidado_ppl.csv`, `defensores.csv`);
- variables de entorno del backend configuradas según entorno local.

### 3.2 Criterios de salida para aprobar versión

- 0 fallos en suite de humo;
- 0 fallos en casos críticos de flujos Aurora/Celeste;
- 0 errores 5xx no controlados en rutas validadas;
- evidencia registrada de los casos manuales ejecutados;
- incidencias no bloqueantes clasificadas con plan de corrección.

## 4. Suites y frecuencia

| Suite | Cobertura | Tipo | Frecuencia |
|---|---|---|---|
| S0 | Humo técnico | Automática | Cada commit local y cada PR |
| S1 | Aurora (condenados) | Mixta (auto + manual) | Cada PR funcional |
| S2 | Celeste (sindicados) | Mixta (auto + manual) | Cada PR funcional |
| S3 | Persistencia e historial | Mixta (auto + manual) | Cada PR con cambios de formulario/backend |
| S4 | API crítica | Manual guiada + smoke | Cada PR de backend |
| S5 | Calidad de texto (UTF-8) | Automática | Diario y preliberación |

## 5. Comandos operativos

Desde raíz del repositorio:

```bash
npm run qa:smoke
npm run qa:encoding
```

Comandos individuales:

```bash
npm --prefix frontend run lint
npm --prefix frontend run test
npm --prefix frontend run build
npm --prefix backend test
npm run encoding:check
```

## 6. Matriz mínima por flujo

### 6.1 Flujo Aurora (condenados)

| ID | Escenario | Resultado esperado | Tipo |
|---|---|---|---|
| AUR-01 | Caso sin análisis jurídico completo | Estado: `Analizar el caso` | Automática (existente) |
| AUR-02 | Análisis completo sin entrevista/actuación | Estado: `Entrevistar al usuario` | Automática (existente) |
| AUR-03 | Trámite completo sin radicación | Estado: `Presentar solicitud` | Automática (existente) |
| AUR-04 | Radicación presente sin decisión | Estado: `Pendiente decisión` | Automática (existente) |
| AUR-05 | Decisión final diligenciada | Estado: `Caso cerrado` | Automática (existente) |
| AUR-06 | Dependencias 5B (Q41/Q43) | Habilita y deshabilita según regla | Automática + Manual |
| AUR-07 | Secuencia de fechas inválida en trámite | Bloquea guardado con mensaje claro | Manual |

### 6.2 Flujo Celeste (sindicados)

| ID | Escenario | Resultado esperado | Tipo |
|---|---|---|---|
| CEL-01 | Faltan Q19-Q22 | Estado: `Analizar el caso` | Automática (existente) |
| CEL-02 | Q21 inicia con `No se avanzará...` | Estado: `Caso cerrado` y lock activo | Automática (existente) |
| CEL-03 | Q21 `Se avanzará...` y sin entrevista | Estado: `Entrevistar al usuario` | Automática (existente) |
| CEL-04 | Q24 diligenciada, Q25 vacía | Estado: `Pendiente audiencia` | Automática (existente) |
| CEL-05 | Q25 diligenciada, Q26 vacía | Estado: `Pendiente decisión de audiencia` | Automática (existente) |
| CEL-06 | Q26 niega + Q28 sí + Q29 con fecha | Estado: `Pendiente decisión` | Automática (existente) |
| CEL-07 | Q30 o Q31 diligenciada | Estado: `Caso cerrado` | Automática (existente) |

### 6.3 Asignación y listados operativos

| ID | Escenario | Resultado esperado | Tipo |
|---|---|---|---|
| OPS-01 | `GET /api/ppl/condenados` sin `tipo` | Solo registros `condenado` | Manual guiada |
| OPS-02 | `GET /api/ppl/condenados?tipo=all` | Incluye `condenado` + `sindicado` | Manual guiada |
| OPS-03 | Asignación masiva por PAG válido | Actualiza defensor y metadato PAG | Manual |
| OPS-04 | Filtro por estado y documento | Resultados consistentes y trazables | Manual |

### 6.4 Persistencia de actuaciones e historial

| ID | Escenario | Resultado esperado | Tipo |
|---|---|---|---|
| HIS-01 | Crear nueva actuación | Se crea fila nueva con base heredada | Manual |
| HIS-02 | Editar actuación activa y guardar | Cambios persisten en actuación correcta | Manual |
| HIS-03 | Consulta historial por documento | Orden y contenido coherentes | Manual |
| HIS-04 | Guardado de estado derivado | `Estado del trámite` y `Estado del caso` sincronizados | Manual |

### 6.5 API crítica

| ID | Escenario | Resultado esperado | Tipo |
|---|---|---|---|
| API-01 | `GET /api/health` | `200` y payload de salud | Manual |
| API-02 | `GET /api/ppl/:documento` inexistente | `404` controlado | Manual |
| API-03 | `PUT /api/ppl/:documento` con payload válido | `200` y registro actualizado | Manual |
| API-04 | `POST /api/ppl/:documento/actuaciones` sin base | `404` o `400` controlado | Manual |
| API-05 | `POST /api/defensores` duplicado | `409` controlado | Manual |

### 6.6 Calidad de texto y codificación

| ID | Escenario | Resultado esperado | Tipo |
|---|---|---|---|
| TXT-01 | `npm run encoding:check` | Sin archivos inválidos UTF-8 | Automática |
| TXT-02 | Búsqueda de mojibake en fuentes | Cero ocurrencias nuevas | Automática |
| TXT-03 | Render de tildes y Ñ/ñ en UI crítica | Visualización correcta | Manual |

## 7. Evidencia mínima por ejecución

Cada ciclo de pruebas debe registrar:

- fecha y versión/commit evaluado;
- suites ejecutadas;
- casos fallidos con severidad (`bloqueante`, `alta`, `media`, `baja`);
- evidencia (captura, log o respuesta API);
- decisión final (`aprobado`, `aprobado con observaciones`, `rechazado`).

## 8. Política de severidad y decisión

- Bloqueante: impide despliegue.
- Alta: no bloquea solo si existe mitigación temporal explícita y fecha de corrección.
- Media/Baja: se agenda en backlog con responsable y prioridad.

Regla de liberación:

- no se libera con fallos bloqueantes;
- no se libera con fallos altos sin plan de mitigación aceptado.

## 9. Plan de evolución del protocolo

1. Incorporar pruebas de integración backend reales (runner + fixtures aisladas).
2. Convertir casos manuales API en pruebas automatizadas.
3. Publicar reporte consolidado en CI con resultados de S0 y S5 por commit.
