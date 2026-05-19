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

## 4.1 Estado de actuaciones

El estado visible (`Analizar el caso`, `Entrevistar al usuario`, `Presentar solicitud`, `Pendiente decisión`, `Caso cerrado`, etc.) se trata como dato derivado de las respuestas de formulario.

- En frontend, la fuente central es `frontend/src/config/estadoActuaciones.rules.ts`.
- En listados resumidos, el backend entrega `estadoSource` con los campos necesarios para que la UI derive la etiqueta.
- En el formulario, `Estado del trámite` y `Estado del caso` se sincronizan al guardar para conservar compatibilidad con filtros y reportes.
- El historial mezcla la actuación activa cargada desde Oracle con el registro vivo en memoria, evitando esperar a una recarga para ver el estado actualizado.

## 5. Catálogo de formatos

El único archivo local de datos que permanece en `backend/data/` es `formatos.mock.js`. Este archivo contiene el catálogo de formatos descargables y no reemplaza la base de datos de negocio.

## 5.1 Cargas mensuales staging/ETL

Aurora incluye un flujo administrativo para cargar archivos Excel mensuales hacia tablas staging de Oracle y ejecutar los procedimientos ETL asociados.

Fuentes cubiertas:

- `PONAL` desde `CONSOLIDADO_PPL_REGIONES.xlsx`.
- `SISIPEC` desde `Consolidado_SISIPEC.xlsx`.
- `AURORA_10` desde `Aurora_1_0.xlsx`, mientras Aurora 1.0 siga en operación.

El flujo se opera desde la vista `Cargas mensuales`, protegida por roles administrativos. El backend guarda el archivo, registra la carga, ejecuta `CargueBD/loader_service.py` en segundo plano y conserva logs locales. Si la carga staging termina sin errores, el servicio Python llama el procedimiento Oracle correspondiente.

La documentación operativa completa está en [Cargas mensuales de staging y ETL a Oracle](./16_cargas_staging_etl_bd.md).

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
