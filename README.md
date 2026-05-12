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

- Backend ya cuenta con una prueba automatizada mínima de configuración segura de autenticación en `npm test`; falta ampliar cobertura a rutas e integración Oracle.
- `npm audit --audit-level=moderate` queda en 0 vulnerabilidades para frontend y backend al 2026-05-06.
- El build frontend conserva una advertencia no bloqueante de bundle principal mayor a 500 kB; conviene dividir rutas con `import()` antes de un despliegue con tráfico alto.
