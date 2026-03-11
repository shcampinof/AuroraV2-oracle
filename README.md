---
title: AURORA
emoji: ⚖️
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

AURORA es una aplicación web para la gestión de atención jurídica de personas privadas de la libertad.
Incluye un frontend en React y un backend en Node.js/Express, desplegados en un único contenedor Docker.

## Estado Actual del Proyecto (2026-03-09)

- Estado general: funcional.
- Publicación: desplegado en Hugging Face Space (`main`) con commit `adff172` el 2026-03-09.
- Validación frontend: `lint`, `test` y `build` en verde.
- Validación backend:
  - Se ejecutó una suite funcional de integración en entorno temporal aislado (backend clonado en puerto `8899`).
  - Resultado: 17/17 checks exitosos.
  - Cobertura validada:
    - validación de cédula PAG;
    - asignación de defensor por PAG;
    - filtros de PAG y Usuarios asignados (documento, departamento, defensor y estado);
    - guardado de formulario (`PUT /api/ppl/:documento`);
    - creación de nueva actuación (`POST /api/ppl/:documento/actuaciones`);
    - persistencia y consulta de historial (`GET /api/ppl/:documento/actuaciones`).

## Cambios Técnicos Relevantes en esta actualización

- Ajuste de configuración de Vite para usar `VITE_DEV_API_TARGET` vía entorno de Node sin romper `vitest`/`vite build`.
- Limpieza de dependencias innecesarias en `useMemo` de `FormularioAtencion` (sin impacto funcional esperado).
- Se mantienen cambios funcionales previos del repositorio en backend/frontend para flujo de PAG, defensores e historial.

## Evidencia de Validación Ejecutada

- Frontend:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- Backend (funcional, integración):
  - pruebas API end-to-end sobre copia temporal del backend, sin modificar datos de trabajo del repositorio.

## Riesgos/Pendientes

- Backend aún no cuenta con suite formal de pruebas unitarias/integración en `npm test`.
- Dependencias con vulnerabilidades reportadas por `npm audit`:
  - backend: 2 (1 low, 1 high)
  - frontend: 8 (6 moderate, 2 high)

## Variante Oracle v2 (híbrida)

Esta carpeta corresponde a la variante `AuroraV2-oracle`:

- Core PPL/actuaciones migrado a Oracle:
  - `DNDP.PERSONA`
  - `DNDP.SITUACION_CARCELARIA`
  - `DNDP.GESTION_JURIDICA`
- PAG y defensores se mantienen temporalmente en CSV (v2 híbrida).

Variables Oracle requeridas en backend:

- `ORACLE_USER`
- `ORACLE_PASSWORD`
- `ORACLE_HOST`
- `ORACLE_PORT`
- `ORACLE_SERVICE_NAME`

Opcional:

- `ORACLE_GESTION_ID_SEQUENCE` (fallback para generar `ID_GESTION` si no autogenera).

Health DB:

- `GET /api/health/db` ejecuta `SELECT 1 FROM dual`.

Scripts backend:

- `npm run smoke:oracle` (conectividad Oracle)
- `npm run test:api` (regresión API básica contra backend levantado)
