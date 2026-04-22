# AURORA - Estrategia de Pruebas

Documento operativo vigente:

- [Protocolo de pruebas v1](./11_protocolo_de_pruebas.md)

## 1. Estado actual verificable

## 1.1 Frontend

- Runner: Vitest (`frontend/package.json` -> script `test`).
- Lint: ESLint (`npm run lint`).
- Build check: `npm run build`.
- Tests presentes:
  - `frontend/src/utils/evaluateAuroraRules.test.ts`
  - `frontend/src/utils/__tests__/evaluateAuroraRules.aurora.spec.ts`
  - `frontend/src/utils/evaluateCelesteRules.test.ts`
  - `frontend/src/config/estadoActuaciones.rules.test.ts`

Cobertura actual de tests observada:

- Validacion de visibilidad Aurora (`AURORA.B4.VISIBILIDAD.2`).
- Validacion de dependencias Aurora en bloque 5A y 5B (`AURORA.B5A.*`, `AURORA.B5B.*`).
- Consistencia del flujo de recurso con dos fechas (presentacion/decision) en formularios activos.
- Validacion de visibilidad Celeste (`CELESTE.B4.VISIBILIDAD.1`, `CELESTE.B5.VISIBILIDAD.2`).
- Validacion de estado de actuaciones y semaforo (`ESTADO.*`).

## 1.2 Backend

- Script `test` actual: imprime `No backend tests configured`.
- No se encontraron archivos de prueba backend en este repositorio.

## 2. Objetivo de estrategia (alineado al codigo actual)

- Validar reglas de formulario por flujo (Aurora/Celeste).
- Validar contratos de API usados por frontend.
- Reducir riesgo en persistencia CSV (lectura/escritura y actuacion nueva).

## 3. Enfoque vigente

La estrategia se ejecuta en tres niveles:

1. humo técnico por commit/PR;
2. regresión funcional por flujos de negocio;
3. preliberación con evidencia y control de severidad.

El detalle de casos, criterios de salida y política de severidad está formalizado en `docs/11_protocolo_de_pruebas.md`.

## 4. Cobertura objetivo por capa

## 4.1 Nivel unitario

- Frontend:
  - ampliar pruebas de `evaluateAuroraRules`.
  - crear pruebas para `evaluateCelesteRules`.
- Backend:
  - pruebas de `consolidado.repo.js`:
    - `computeTipo`
    - normalizacion de headers
    - `updateByDocumento`
    - `createActuacionByDocumento`

## 4.2 Nivel integracion

- Pruebas de rutas Express con fixtures CSV controlados:
  - `GET/PUT /api/ppl/:documento`
  - `GET/POST /api/ppl/:documento/actuaciones`
  - `GET /api/ppl/condenados` (sin `tipo`) valida que solo retorne `condenado` y excluya `sindicado` (regresion critica para PAG).
  - `GET /api/ppl/condenados?tipo=all` valida que incluya tanto `condenado` como `sindicado` (regresion critica para Usuarios asignados).
  - `GET /api/defensores`, `GET /api/defensores?source=condenados` y `POST /api/defensores`

## 4.3 Nivel UI (flujo critico)

- Buscar PPL -> editar -> guardar -> verificar persistencia.
- Crear nueva actuacion -> diligenciar -> guardar -> verificar historial.

## 5. Criterios minimos de calidad sugeridos

- Ejecutar en CI:
  - `root: npm run encoding:check` (bloquea mojibake y archivos no UTF-8, incluyendo CSV fuente)
  - `root: npm run qa:smoke`
- Definir un baseline de cobertura para utilidades de reglas.

Control local recomendado antes de PR:

1. `npm run encoding:check`
2. Si hay errores de codificacion: `npm run encoding:normalize`
3. `npm run encoding:check`
4. `npm --prefix frontend run lint`
5. `npm --prefix frontend test`
