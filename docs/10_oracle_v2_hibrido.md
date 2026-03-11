# Aurora Oracle v2 (híbrida segura)

## 1) Cómo funcionaba la app con CSV
- Fuente principal de datos PPL y actuaciones: `backend/data/consolidado_ppl.csv` vía `backend/db/consolidado.repo.js`.
- Catálogos auxiliares:
  - PAG: `backend/data/PAG.csv` vía `backend/db/pag.repo.js`.
  - Defensores: `backend/data/defensores.csv` vía `backend/db/defensores.repo.js`.
- Persistencia CSV en backend original:
  - lectura con cache en memoria;
  - escritura por reescritura completa del archivo.
- Endpoints consumidos por frontend: `/api/ppl/*`, `/api/defensores*`, `/api/formatos*`, `/api/health`.

## 2) Archivos CSV reemplazados y qué quedó temporal
### Reemplazado a Oracle
- `backend/db/consolidado.repo.js` -> `backend/db/oracleConsolidado.repo.js`.
- `backend/routes/ppl.js` migrado a lectura/escritura Oracle (async).

### Se mantiene temporal en CSV (por decisión v2 híbrida)
- `GET /api/ppl/pag/:cedula/validar` -> `backend/db/pag.repo.js`.
- `GET/POST /api/defensores` -> `backend/db/defensores.repo.js`.

## 3) Nueva estructura orientada a Oracle
- `backend/config/oracle.js`: variables de entorno y validación.
- `backend/db/oraclePool.js`: pool, ejecución SQL, health check Oracle.
- `backend/repositories/oracle/sqlFragments.js`: CTE de situación activa + alcance regional.
- `backend/repositories/oracle/personaRepository.js`: consultas de persona+situación+gestión.
- `backend/repositories/oracle/situacionRepository.js`: updates de situación.
- `backend/repositories/oracle/gestionRepository.js`: historial/insert/update/asignación de gestión.
- `backend/services/pplService.js`: lógica de negocio y adapter Oracle -> contrato legacy.
- `backend/routes/health.js`: `GET /api/health/db` (`SELECT 1 FROM dual`).
- `backend/db/oracleConsolidado.repo.js`: fachada compatible con el contrato del router actual.

## 4) SQL principales implementadas
### 4.1 CTE de situación activa (prioridad funcional)
1. `ACTIVO = 1`
2. `FECHA_CAPTURA` más reciente
3. mayor longitud numérica de `PROCESO` (sin guiones)
4. `FECHA_REGISTRO` más reciente

Implementación: `backend/repositories/oracle/sqlFragments.js` + uso en `personaRepository.js`.

### 4.2 Listados y detalle PPL
- Base: `DNDP.PERSONA` + CTE de situación activa (`DNDP.SITUACION_CARCELARIA`) + `LEFT JOIN DNDP.GESTION_JURIDICA`.
- Usado para:
  - `/api/ppl`
  - `/api/ppl/condenados`
  - `/api/ppl/:documento`

### 4.3 Historial de actuaciones
- Lectura por `ID_SITUACION` ordenada por `FECHA_REGISTRO, ID_GESTION`.
- Usado para `/api/ppl/:documento/actuaciones`.

### 4.4 Crear actuación
- `INSERT INTO DNDP.GESTION_JURIDICA ... RETURNING ID_GESTION`.
- Fallback de ID cuando no hay autogeneración:
  - secuencia opcional `ORACLE_GESTION_ID_SEQUENCE`;
  - o fallback por `MAX(ID_GESTION)+1`.

### 4.5 Actualizar actuación
- `UPDATE DNDP.GESTION_JURIDICA` por `ID_GESTION` derivado de `actuacionId` (`${documento}-${idGestion}`),
  con fallback a la gestión más reciente.

## 5) Archivos nuevos y modificados
### Nuevos
- `backend/config/oracle.js`
- `backend/db/oraclePool.js`
- `backend/db/oracleConsolidado.repo.js`
- `backend/repositories/oracle/sqlFragments.js`
- `backend/repositories/oracle/personaRepository.js`
- `backend/repositories/oracle/situacionRepository.js`
- `backend/repositories/oracle/gestionRepository.js`
- `backend/services/pplService.js`
- `backend/routes/health.js`
- `backend/scripts/oracle-smoke.js`
- `backend/scripts/api-regression.js`

### Modificados
- `backend/index.js`
- `backend/routes/ppl.js`
- `backend/routes/defensores.js`
- `backend/package.json`
- `backend/package-lock.json`

## 6) Cómo correr localmente
1. Backend:
```bash
cd backend
npm install
```
2. Variables de entorno Oracle:
```bash
set ORACLE_USER=DNDP
set ORACLE_PASSWORD=<tu_password>
set ORACLE_HOST=kannon.defensoria.gov.co
set ORACLE_PORT=1521
set ORACLE_SERVICE_NAME=DNDPDEV.defensoria.gov.co
```
Opcional:
```bash
set ORACLE_GESTION_ID_SEQUENCE=<schema.secuencia>
```
3. Levantar backend:
```bash
npm run dev
```
4. Verificar:
- `GET http://localhost:7860/api/health`
- `GET http://localhost:7860/api/health/db`
5. Smoke DB:
```bash
npm run smoke:oracle
```

## 7) Cómo correr en Linux por SSH
1. Conectarse por SSH y entrar al backend.
2. Exportar variables Oracle:
```bash
export ORACLE_USER=DNDP
export ORACLE_PASSWORD='<tu_password>'
export ORACLE_HOST=kannon.defensoria.gov.co
export ORACLE_PORT=1521
export ORACLE_SERVICE_NAME=DNDPDEV.defensoria.gov.co
# opcional
export ORACLE_GESTION_ID_SEQUENCE='<schema.secuencia>'
```
3. Instalar y ejecutar:
```bash
npm install
npm run start:prod
```
4. Validación mínima:
```bash
curl -s http://127.0.0.1:7860/api/health
curl -s http://127.0.0.1:7860/api/health/db
```

## 8) Checklist de validación CSV vs Oracle
- [ ] `/api/ppl/condenados` devuelve columnas/rows/meta y soporta filtros.
- [ ] `/api/ppl/:documento` conserva shape `{ tipo, registro }`.
- [ ] `/api/ppl/:documento/actuaciones` conserva shape `{ documento, actuaciones }`.
- [ ] `POST /api/ppl/:documento/actuaciones` crea actuación y retorna `actuacion.id` compatible.
- [ ] `PUT /api/ppl/:documento` actualiza con `actuacionId` y sin `actuacionId` (fallback).
- [ ] `POST /api/ppl/asignar-defensor` sigue validando PAG en CSV y asigna en Oracle.
- [ ] `GET /api/health/db` responde `ok=true` y ejecuta `SELECT 1 FROM dual`.
- [ ] Frontend carga sin cambios de rutas ni shape esperado.

## Notas de compatibilidad
- `HERRAMIENTA` se trata como eliminado (se retorna vacío estable).
- Alcance regional por defecto conservado: Antioquia, Norte de Santander, Cauca, Santander.
- Catálogos PAG/defensores quedan temporalmente en CSV para v2 híbrida.
