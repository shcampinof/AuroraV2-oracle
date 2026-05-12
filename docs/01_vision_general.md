# AURORA - Overview Tecnico

## 1. Alcance del sistema

AURORA es una aplicacion web para atencion juridica de personas privadas de la libertad (PPL). El repositorio se divide en:

- `frontend/`: cliente React + Vite.
- `backend/`: API REST en Node.js + Express.

## 2. Arquitectura de alto nivel

## 2.1 Frontend

- Renderiza las vistas y formularios.
- Consume endpoints HTTP del backend via `frontend/src/services/api.js`.
- Aplica reglas de negocio de formulario en cliente:
  - `frontend/src/utils/evaluateAuroraRules.ts`
  - `frontend/src/utils/evaluateCelesteRules.ts`

## 2.2 Backend

- Expone endpoints bajo prefijo `/api`.
- Organiza rutas por modulo:
  - `backend/routes/auth.js`
  - `backend/routes/ppl.js`
  - `backend/routes/defensores.js`
  - `backend/routes/formatos.js`
- Protege rutas funcionales con JWT propio emitido por login local temporal o SSO Azure AD.
- Usa repositorios de acceso a datos:
  - `backend/db/oracleConsolidado.repo.js`
  - `backend/repositories/oracle/*.js`

## 2.3 Persistencia

- Fuente principal: Oracle, mediante repositorios bajo `backend/repositories/oracle/`.
- Los CSV en `backend/data/` quedan como insumos/mock historicos para desarrollo y referencia.
- Catalogo de formatos: mock en `backend/data/formatos.mock.js`.

## 3. Navegacion principal (frontend)

La app usa navegacion por hash (`frontend/src/App.jsx`) y estas vistas:

- `inicio`
- `formulario`
- `registros`
- `asignacion`
- `herramientas`
- `manual`

## 4. Casos de uso funcionales implementados

- Consulta de PPL por documento.
- Edicion y guardado de entrevista.
- Creacion y consulta de historial de actuaciones.
- Asignacion, reasignacion y creacion de defensores.
- Listado y descarga de formatos.

## 5. Configuracion y ejecucion local

- Frontend:
  - `npm run dev`
  - `npm run build`
  - `npm run lint`
  - `npm run test`
- Backend:
  - `npm run dev`
  - `npm start`

## 6. Riesgos tecnicos observables en codigo

- Normalizacion intensiva de claves para tolerar variantes de codificacion.
- La suite backend automatizada actual cubre configuracion de autenticacion; falta ampliar a rutas e integracion Oracle.

## 7. Pendientes de arquitectura

- Agregar diagrama de componentes (frontend/backend/repositorios Oracle).
- Definir convencion oficial de codificacion de texto para claves de BD y labels de formulario.
- Documentar estrategia de despliegue (ambientes, variables, puertos, observabilidad).
