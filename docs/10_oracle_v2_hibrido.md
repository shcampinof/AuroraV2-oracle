# Aurora Oracle v2

## 1) Estado actual

Aurora usa Oracle como fuente operativa para PPL, actuaciones, PAG y defensores. Los endpoints consumidos por frontend se mantienen bajo `/api/ppl/*`, `/api/defensores*`, `/api/formatos*` y `/api/health`.

## 2) Archivos principales Oracle

- `backend/db/oracleConsolidado.repo.js`: fachada usada por las rutas PPL.
- `backend/routes/ppl.js`: lectura/escritura contra Oracle.
- `backend/repositories/oracle/pagRepository.js`: validación PAG.
- `backend/repositories/oracle/defensoresRepository.js`: consulta y creación de defensores.

## 3) Estructura orientada a Oracle
- `backend/config/oracle.js`: variables de entorno y validación.
- `backend/db/oraclePool.js`: pool, ejecución SQL, health check Oracle.
- `backend/repositories/oracle/sqlFragments.js`: CTE de situación activa + alcance regional.
- `backend/repositories/oracle/personaRepository.js`: consultas de persona+situación+gestión.
- `backend/repositories/oracle/situacionRepository.js`: updates de situación.
- `backend/repositories/oracle/gestionRepository.js`: historial/insert/update/asignación de gestión.
- `backend/services/pplService.js`: lógica de negocio y adapter Oracle -> contrato legacy.
- `backend/routes/health.js`: `GET /api/health/db` (`SELECT 1 FROM dual`).
- `backend/db/oracleConsolidado.repo.js`: fachada compatible con el contrato del router actual.
- `ORACLE_SCHEMA`: variable opcional para redirigir consultas a un esquema Oracle distinto en pruebas.

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
- `backend/scripts/api-write-regression.js`
- `backend/scripts/test-db/setup-test-db.js`

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

## 8) Checklist de validación Oracle
- [ ] `/api/ppl/condenados` devuelve columnas/rows/meta y soporta filtros.
- [ ] `/api/ppl/:documento` conserva shape `{ tipo, registro }`.
- [ ] `/api/ppl/:documento/actuaciones` conserva shape `{ documento, actuaciones }`.
- [ ] `POST /api/ppl/:documento/actuaciones` crea actuación y retorna `actuacion.id` compatible.
- [ ] `PUT /api/ppl/:documento` actualiza con `actuacionId` y sin `actuacionId` (fallback).
- [ ] `POST /api/ppl/asignar-defensor` valida PAG en Oracle y asigna en Oracle.
- [ ] `GET /api/health/db` responde `ok=true` y ejecuta `SELECT 1 FROM dual`.
- [ ] Frontend carga sin cambios de rutas ni shape esperado.

## 9) Documentacion del modelo DNDP recibida

Durante la revision del 2026-05-12 se incorporo la carpeta `BD Documentation/` con documentos del modelo de base de datos:

- `DICCIONARIO_MODELO_DNDP.html`
- `Diagrama.png`
- `Diagrama_modelo.log`
- `Explicación del modelo y objetos.docx`
- `Manual de despliegue.pdf`

El diccionario describe 12 tablas principales: `REGIONALES`, `PAG`, `DEFENSORES`, `ASIGNACION`, `PERSONA`, `SITUACION_CARCELARIA`, `CALIFICACION_CONDUCTA`, `GESTION_JURIDICA`, `PONAL`, `SISIPEC`, `AURORA_10` y `LOG_CARGA`. El manual indica despliegue sobre el esquema `DNDP` y menciona objetos adicionales como `VW_DETALLE_CON_DEFENSOR` y procedimientos ETL (`PRC_CARGA_PONAL`, `PRC_CARGA_SISIPEC_V3`, `PRC_CARGA_AURORA10`). En la carpeta recibida no se encontro un archivo ejecutable `BD.sql`; por eso el setup de pruebas creado en el repositorio arma desde codigo las 12 tablas documentadas y carga una semilla pequena para que las pruebas del backend tengan registros reales de trabajo.

## 10) Esquema Oracle de pruebas

El backend permite redirigir las consultas que hoy referencian `DNDP.` hacia otro esquema mediante `ORACLE_SCHEMA`. Si no se define, se usa `ORACLE_USER`. Esto permite levantar una base temporal con las mismas tablas base sin cambiar cada SQL de la aplicacion.

Variables recomendadas para pruebas:

```bash
export DOTENV_CONFIG_PATH=/ruta/aurora/backend/.env.test
export ORACLE_SCHEMA=DNDP_TEST
```

Comandos preparados:

```bash
npm --prefix backend run test-db:setup
npm --prefix backend run smoke:oracle
npm --prefix backend run test:api
npm --prefix backend run test:api:write
```

`test-db:setup` crea las 12 tablas del diccionario cuando no existen, valida que las tablas existentes tengan las columnas esperadas y carga datos semilla controlados para dos PPL de prueba (`900000001` y `900000002`), un PAG (`900001`) y un defensor base (`900002`). El script tiene una proteccion: si el esquema efectivo es `DNDP`, se niega a ejecutar escrituras salvo que se defina explicitamente `ALLOW_DNDP_TEST_SETUP=1`. Esta proteccion evita modificar la base operativa por error.

## Notas de compatibilidad
- `HERRAMIENTA` se trata como eliminado (se retorna vacío estable).
- Alcance regional por defecto conservado: Antioquia, Norte de Santander, Cauca, Santander.
- Catálogos PAG/defensores se consultan desde Oracle en la implementacion actual.
