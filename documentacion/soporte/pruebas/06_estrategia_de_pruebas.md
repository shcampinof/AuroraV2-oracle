# AURORA - Estrategia de Pruebas

Fecha de actualización: 2026-07-24

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
  - `frontend/src/utils/actuacionesValidation.test.ts`
  - `frontend/src/pages/ManualInteractivo.test.jsx`
  - `frontend/src/utils/pwaConfig.test.ts`

Cobertura actual de tests:

- Validacion de visibilidad Aurora (`AURORA.B4.VISIBILIDAD.2`).
- Validacion de dependencias Aurora en bloque 5A y 5B (`AURORA.B5A.*`, `AURORA.B5B.*`).
- Consistencia del flujo de recurso con dos fechas (presentacion/decision) en formularios activos.
- Validacion de visibilidad Celeste (`CELESTE.B4.VISIBILIDAD.1`, `CELESTE.B5.VISIBILIDAD.2`).
- Validacion de estado de actuaciones y semaforo (`ESTADO.*`).
- Primera actuación virtual y bloqueo de actuaciones sucesivas incompletas.
- Catálogo de los tres tutoriales, rutas locales y reproducción embebida.
- Configuración PWA y activos precacheados.

## 1.2 Backend

- Script `test`: ejecuta autenticación/roles, autorización PAG, importación CSV, cargas staging/ETL, depuración transaccional de actuaciones y blindaje de asignaciones.
- `auth-config.test.js`: configuración segura de producción y normalización de roles `admin`, `user` y `pag`.
- `pag-access.test.js`: middleware PAG, actualización inmediata de roles y revocación de cuenta.
- `user-csv-import.test.js`: delimitadores, normalización, duplicados, inválidos y preservación de cuentas existentes.
- `carga-bd-service.test.js`: fuentes, reparación y limpieza controlada del registro de cargas.
- `actuacion-cleanup-service.test.js`: conteos esperados, confirmación, eliminación de actuaciones/asignaciones y concurrencia.
- `asignacion-safety.test.js`: protecciones de escritura de asignaciones.
- Script `smoke:oracle`: valida conexion Oracle con `SELECT 1 AS DB_OK FROM dual`.
- Script `test:api`: valida endpoints principales de lectura con autenticacion.
- Script `test-db:setup`: crea tablas y datos semilla en un esquema Oracle de pruebas.
- Script `test:api:write`: valida escrituras controladas contra la base de pruebas (`PUT /ppl/:documento`, `POST /ppl/:documento/actuaciones`, `POST /defensores`, `POST /ppl/asignar-defensor`).

El 2026-05-12 no se ejecutaron escrituras porque `.env.test` apuntaba efectivamente al esquema `DNDP`. El setup de base de pruebas se nego a correr por proteccion. Para habilitar la suite de escritura se debe configurar `ORACLE_SCHEMA` con un esquema temporal distinto a `DNDP`.

## 2. Objetivo de estrategia (alineado al codigo actual)

- Validar reglas de formulario por flujo (Aurora/Celeste).
- Validar contratos de API usados por frontend.
- Reducir riesgo en persistencia Oracle (lectura/escritura y actuacion nueva).

## 3. Enfoque vigente

La estrategia se ejecuta en tres niveles:

1. humo técnico por commit/PR;
2. regresión funcional por flujos de negocio;
3. preliberación con evidencia y control de severidad.

El detalle de casos, criterios de salida y política de severidad está formalizado en `documentacion/soporte/pruebas/11_protocolo_de_pruebas.md`.

## 4. Cobertura objetivo por capa

## 4.1 Nivel unitario

- Frontend:
  - ampliar pruebas de `evaluateAuroraRules`.
  - crear pruebas para `evaluateCelesteRules`.
- Backend:
  - pruebas de repositorios Oracle:
    - `computeTipo`
    - normalizacion de headers
    - `updateByDocumento`
    - `createActuacionByDocumento`
  - pruebas del servicio de cargas staging/ETL:
    - fuentes soportadas;
    - limpieza de nombres de archivo;
    - deshabilitacion de Aurora 1.0 por variable de entorno.

## 4.2 Nivel integracion

- Pruebas de rutas Express contra esquema Oracle temporal:
  - `GET/PUT /api/ppl/:documento`
  - `GET/POST /api/ppl/:documento/actuaciones`
  - `GET /api/ppl/condenados` (sin `tipo`) valida que solo retorne `condenado` y excluya `sindicado` (regresion critica para PAG).
  - `GET /api/ppl/condenados?tipo=all` valida que incluya tanto `condenado` como `sindicado` (regresion critica para Usuarios asignados).
  - `GET /api/defensores`, `GET /api/defensores?source=condenados` y `POST /api/defensores`
  - rutas `/api/admin/cargas` con rol autorizado, archivo `.xlsx` y errores controlados.

## 4.3 Nivel UI (flujo critico)

- Buscar PPL -> editar -> guardar -> verificar persistencia.
- Crear nueva actuacion -> diligenciar -> guardar -> verificar historial.

## 5. Criterios mínimos de calidad

- Ejecutar en CI:
  - `root: npm run encoding:check` (bloquea mojibake y archivos no UTF-8)
  - `root: npm run qa:smoke`
- Definir un baseline de cobertura para utilidades de reglas.

Control local recomendado antes de PR:

1. `npm run encoding:check`
2. Si hay errores de codificacion: `npm run encoding:normalize`
3. `npm run encoding:check`
4. `npm --prefix frontend run lint`
5. `npm --prefix frontend test`
6. `python -m py_compile scripts/cargas_bd/*.py`

Para una entrega Docker:

7. `docker compose config`
8. `docker compose build aurora`
9. Verificar dentro de la imagen los tres MP4 y `SHA256SUMS`.
10. Levantar el contenedor con configuración no productiva y comprobar `/api/health`, `/tutorial-videos/...` y respuestas HTTP `206` para solicitudes Range.

## 6. Línea base verificada

La validación local del 2026-07-24 obtuvo:

| Validación | Resultado |
|---|---|
| ESLint frontend | OK |
| Vitest frontend | 7 archivos, 90 pruebas aprobadas |
| Build Vite/PWA | OK, 449 módulos y 6 activos precacheados |
| Suite backend | OK en los 6 scripts |
| Integridad de tutoriales | OK para los 3 archivos SHA-256 |
| Auditoría npm raíz/frontend/backend | 0 vulnerabilidades reportadas |
| Compilación Python | OK para `scripts/cargas_bd/*.py` |
| Build Docker | OK con dependencias productivas instaladas mediante `npm ci` |
| Prueba efímera de imagen | API `200`, frontend `200`, tutorial `206 Partial Content` |
