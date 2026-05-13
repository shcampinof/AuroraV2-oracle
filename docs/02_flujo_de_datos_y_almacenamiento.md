# AURORA - Flujo de datos y almacenamiento

## 1. Fuente principal

La fuente operativa de Aurora es Oracle. El backend accede a la base por medio de:

- `backend/db/oraclePool.js`
- `backend/db/oracleConsolidado.repo.js`
- `backend/repositories/oracle/personaRepository.js`
- `backend/repositories/oracle/gestionRepository.js`
- `backend/repositories/oracle/asignacionRepository.js`
- `backend/repositories/oracle/defensoresRepository.js`
- `backend/repositories/oracle/pagRepository.js`

El repositorio no debe depender de archivos locales para consultar o guardar información de PPL, PAG, defensores o actuaciones.

## 2. Pool y ejecución SQL

`backend/db/oraclePool.js` crea el pool de conexiones con las variables `ORACLE_*` y expone:

- `execute`: ejecuta consultas y reemplaza referencias `DNDP.` por el esquema configurado.
- `healthCheck`: valida conectividad con Oracle.
- `closePool`: cierra conexiones durante el apagado del proceso.

`ORACLE_SCHEMA` permite apuntar a un esquema distinto sin cambiar cada consulta. Si no se define, se usa `ORACLE_USER`.

## 3. Consulta de personas

`personaRepository.js` arma los listados y detalles desde `PERSONA`, `SITUACION_CARCELARIA`, `GESTION_JURIDICA`, `ASIGNACION` y tablas relacionadas. La fachada `oracleConsolidado.repo.js` mantiene el contrato que consumen las rutas actuales.

Flujo general:

1. El frontend llama rutas bajo `/api/ppl`.
2. `backend/routes/ppl.js` valida parámetros y autenticación.
3. La ruta consulta la fachada o repositorios Oracle.
4. La respuesta se normaliza para mantener compatibilidad con la interfaz.

## 4. Escrituras

Las escrituras de negocio se hacen contra Oracle:

- Creación y actualización de actuaciones jurídicas.
- Actualización de situación carcelaria.
- Asignación o reasignación de defensor.
- Creación de defensores.
- Calificaciones de conducta cuando aplica.

Las pruebas de escritura deben ejecutarse únicamente contra un esquema temporal, nunca contra el esquema operativo.

## 5. Catálogo de formatos

El único archivo local de datos que permanece en `backend/data/` es `formatos.mock.js`. Este archivo contiene el catálogo de formatos descargables y no reemplaza la base de datos de negocio.

## 6. Política de codificación UTF-8

Para evitar mojibake en UI, reglas y documentación, el repositorio aplica UTF-8 de forma obligatoria.

Controles implementados:

- `.editorconfig` fija `charset = utf-8` y `end_of_line = lf`.
- `.gitattributes` normaliza fin de línea para documentación, JavaScript, TypeScript, JSON y hojas de estilo.
- Scripts de verificación global en raíz:
  - `npm run encoding:normalize`
  - `npm run encoding:check`

Flujo operativo recomendado:

1. Antes de commit: ejecutar `npm run encoding:check`.
2. Si falla por mojibake o archivo no UTF-8: ejecutar `npm run encoding:normalize`.
3. Volver a ejecutar `npm run encoding:check` y luego pruebas funcionales.
