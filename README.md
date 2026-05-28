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

## Estado Actual del Proyecto (2026-05-15)

- Estado general: funcional.
- Despliegue recomendado: contenedor único Docker/Compose, backend Express sirviendo API y frontend compilado.
- PWA: instalable, con precache de shell/assets y cola offline acotada para escrituras criticas.
- Validación frontend reciente: pruebas de reglas de estado y build en verde.
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

- Los estados de actuación se derivan con reglas centralizadas en `frontend/src/config/estadoActuaciones.rules.ts`.
- El historial de actuaciones recalcula la fila activa con el registro vivo del formulario; así la "Acción a impulsar" se actualiza sin depender de recargar toda la aplicación.
- La vista de asignación de defensores usa el mismo derivador para mostrar "Acción a impulsar", en lugar de depender solo del valor crudo persistido.
- Se actualizó la exclusión de respaldos locales (`.cleanup-backups/`) para que no entren a Git ni a la imagen Docker.
- Ajuste de configuración de Vite para usar `VITE_DEV_API_TARGET` vía entorno de Node sin romper `vitest`/`vite build`.
- Limpieza de dependencias innecesarias en `useMemo` de `FormularioAtencion` (sin impacto funcional esperado).
- PWA endurecida para produccion: manifest con scope/id, service worker con assets hash de Vite, cola IndexedDB limitada, Background Sync cuando esta disponible y reintento por evento `online`.
- Se mantienen cambios funcionales previos del repositorio en backend/frontend para flujo de PAG, defensores e historial.

## Evidencia de Validación Ejecutada

- Frontend:
  - `npm --prefix frontend run test -- pwaConfig.test.ts`
  - `npm --prefix frontend run test -- estadoActuaciones.rules.test.ts evaluateAuroraRules.test.ts`
  - `npm --prefix frontend run build`
- Backend (funcional, integración):
  - pruebas API end-to-end sobre copia temporal del backend, sin modificar datos de trabajo del repositorio.

## Documentación

- `documentacion/documentacion_tecnica/`: documentación técnica formal.
- `documentacion/documentacion_tecnica/base_datos/`: documentación técnica del modelo de base de datos.
- `documentacion/soporte/`: reglas de negocio, pruebas, operación e integraciones.
- `scripts/cargas_bd/`: servicio Python para cargas mensuales a staging/ETL.

## Riesgos/Pendientes

- Backend ya cuenta con una prueba automatizada mínima de configuración segura de autenticación en `npm test`; falta ampliar cobertura a rutas e integración Oracle.
- La PWA no cachea consultas de negocio (`GET /api/...`) para evitar datos desactualizados; la cola offline cubre solo escrituras controladas y acotadas.
- `npm audit --audit-level=moderate` queda en 0 vulnerabilidades para frontend y backend al 2026-05-06.
- El build frontend conserva una advertencia no bloqueante de bundle principal mayor a 500 kB; conviene dividir rutas con `import()` antes de un despliegue con tráfico alto.
