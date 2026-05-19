# Cargas mensuales de staging y ETL a Oracle

Fecha: 2026-05-19

## 1. Alcance

Este documento describe el flujo implementado para cargar archivos Excel mensuales hacia tablas de staging Oracle y ejecutar los procedimientos ETL que alimentan el modelo normalizado de Aurora.

En este contexto, `staging` significa tabla temporal o intermedia de carga cruda. Los archivos fuente se cargan primero en tablas como `PONAL`, `SISIPEC` y `AURORA_10`; luego Oracle ejecuta procedimientos ETL que limpian, estandarizan y propagan la informacion hacia tablas de negocio como `PERSONA`, `SITUACION_CARCELARIA`, `GESTION_JURIDICA` y `ASIGNACION`.

Nota de ambiente: al 2026-05-19 las pruebas operativas de este modulo apuntan al servidor/base de datos de desarrollo (`DNDPDEV`). Cuando Aurora pase a produccion, el despliegue debe configurar `ORACLE_HOST`, `ORACLE_PORT`, `ORACLE_SERVICE_NAME`, `ORACLE_USER`, `ORACLE_PASSWORD` y `ORACLE_SCHEMA` hacia el nuevo servidor de base de datos productivo antes de habilitar cargas mensuales reales.

## 2. Fuentes soportadas

| Fuente | Archivo esperado | Tabla staging | Procedimiento ETL |
|---|---|---|---|
| PONAL | `CONSOLIDADO_PPL_REGIONES.xlsx` | `PONAL` | `PRC_CARGA_PONAL` |
| SISIPEC | `Consolidado_SISIPEC.xlsx` | `SISIPEC` | `PRC_CARGA_SISIPEC_V3` |
| Aurora 1.0 | `Aurora_1_0.xlsx` | `AURORA_10` | `PRC_CARGA_AURORA10` |

`Aurora 1.0` se mantiene habilitada mientras el sistema anterior siga en uso. Cuando deje de operar, se debe configurar `CARGUEBD_AURORA10_ENABLED=false` para ocultarla del modulo de administracion.

## 3. Componentes implementados

| Componente | Ruta | Responsabilidad |
|---|---|---|
| Servicio Python | `CargueBD/loader_service.py` | Lee Excel, valida formato, carga staging y ejecuta ETL. |
| Wrappers Python | `CargueBD/cargar_aurora_10.py`, `cargar_sisipec.py`, `carga_ponal_oracle.py` | Mantienen ejecucion por consola compatible con los scripts historicos. |
| Dependencias Python | `CargueBD/requirements.txt` | Lista `pandas`, `openpyxl` y `oracledb`. |
| Servicio backend | `backend/services/cargaBdService.js` | Guarda archivos, registros, logs y lanza el proceso Python. |
| Ruta backend | `backend/routes/adminCargas.js` | Expone endpoints admin para fuentes, cargas, logs, upload y reintento. |
| Vista frontend | `frontend/src/pages/AdminCargasBD.jsx` | Permite seleccionar fuente, subir Excel, revisar historial y ver logs. |

## 4. Flujo operativo

1. Un usuario con rol autorizado abre `Cargas mensuales`.
2. Selecciona la fuente: `PONAL`, `SISIPEC` o `Aurora 1.0`.
3. Adjunta un archivo `.xlsx`.
4. El backend guarda el archivo en `AURORA_CARGAS_DIR`.
5. El backend crea un registro de carga en `cargas.json`.
6. El backend inicia `CargueBD/loader_service.py` en segundo plano.
7. El proceso Python valida el Excel y prepara la tabla staging.
8. Si se ejecutara ETL, valida que el procedimiento Oracle exista, sea visible y este `VALID`.
9. El proceso inserta filas por lotes.
10. Si no hay errores, llama el procedimiento ETL de Oracle.
11. La vista permite revisar estado, log y reintentar cargas fallidas.

## 5. Almacenamiento de archivos y logs

Por defecto, el backend usa:

```text
backend/storage/cargas_bd/
```

Estructura esperada:

```text
uploads/<id-carga>/<archivo.xlsx>
logs/<id-carga>.log
cargas.json
```

En produccion se recomienda configurar `AURORA_CARGAS_DIR` hacia una ruta persistente fuera del directorio de despliegue, por ejemplo:

```env
AURORA_CARGAS_DIR=/var/aurora/cargas_bd
```

`backend/storage/` esta ignorado por Git porque puede contener archivos Excel con datos sensibles.

## 6. Variables de entorno

| Variable | Uso |
|---|---|
| `AURORA_CARGAS_DIR` | Ruta persistente para uploads, logs y registro JSON de cargas. |
| `AURORA_CARGAS_TMP_DIR` | Ruta temporal opcional para recibir uploads antes de moverlos al almacenamiento final. |
| `CARGUEBD_ADMIN_ROLES` | Roles autorizados para operar el modulo. Default: `admin,carguebd,cargas_bd`. |
| `CARGUEBD_PYTHON` | Ejecutable Python usado por el backend. Default: `python3`. |
| `CARGUEBD_SCRIPT_PATH` | Ruta opcional al `loader_service.py` si se despliega fuera de `CargueBD/`. |
| `CARGUEBD_MAX_FILE_MB` | Tamano maximo del `.xlsx`. Default: `120`. |
| `CARGUEBD_BATCH_SIZE` | Tamano de lote para inserciones Oracle. Default: `500`. |
| `CARGUEBD_AURORA10_ENABLED` | Permite ocultar/deshabilitar Aurora 1.0. Default: `true`. |
| `CARGUEBD_SKIP_ETL` | Si es `true`, carga staging sin ejecutar procedimiento ETL. Solo para diagnostico controlado. |
| `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_HOST`, `ORACLE_PORT`, `ORACLE_SERVICE_NAME`, `ORACLE_SCHEMA` | Conexion Oracle usada por el proceso Python. |

El proceso Python tambien acepta alias historicos `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_SERVICE`, pero en Aurora se recomienda usar las variables `ORACLE_*`.

Para produccion, estas variables no deben heredarse desde el ambiente de desarrollo. El cambio al nuevo servidor de base de datos se controla solo por configuracion de despliegue; no requiere modificar los scripts Python ni el frontend.

## 7. API administrativa

Todas las rutas requieren autenticacion y rol autorizado.

| Metodo | Ruta | Uso |
|---|---|---|
| `GET` | `/api/admin/cargas/fuentes` | Lista fuentes disponibles y estado habilitado/deshabilitado. |
| `GET` | `/api/admin/cargas` | Lista las ultimas cargas registradas. |
| `GET` | `/api/admin/cargas/:id` | Consulta una carga puntual. |
| `GET` | `/api/admin/cargas/:id/log` | Devuelve el log plano de la carga. |
| `POST` | `/api/admin/cargas` | Recibe `multipart/form-data` con `fuente` y `archivo`. |
| `POST` | `/api/admin/cargas/:id/retry` | Reintenta una carga existente usando el mismo archivo. |

Estados posibles:

| Estado | Significado |
|---|---|
| `recibido` | Archivo guardado y pendiente de ejecucion inmediata. |
| `en_ejecucion` | Proceso Python en curso. |
| `exitoso` | Proceso terminado con codigo `0`. |
| `fallido` | Proceso finalizado con error o interrumpido. |

## 8. Reglas de validacion por fuente

### PONAL

- Lee hoja `CONSOLIDADO`.
- Valida el orden de encabezados esperados.
- Carga las 15 primeras columnas como texto.
- Convierte `FECHA_CORTE` a fecha Oracle.
- Inserta `LUGAR_PRIVACION='CDT'` y `FUENTE='PONAL'`.

### SISIPEC

- Lee la primera hoja del Excel.
- Normaliza encabezados con `strip().upper()`.
- Carga columnas faltantes como `NULL`, dejando advertencia en log.
- Convierte fechas y numeros segun configuracion del servicio.

### Aurora 1.0

- Lee columnas hasta `Creado`.
- Mapea encabezados SharePoint al esquema `AURORA_10`.
- Omite filas sin cedula.
- Deduplica por `CEDULA`, conservando el registro con `Creado` mas reciente.
- Se puede deshabilitar cuando Aurora 1.0 salga de operacion.

## 9. Comandos de consola

Los scripts historicos siguen funcionando, pero ahora delegan en el servicio comun:

```bash
python CargueBD/cargar_aurora_10.py --archivo /ruta/Aurora_1_0.xlsx
python CargueBD/cargar_sisipec.py --archivo /ruta/Consolidado_SISIPEC.xlsx
python CargueBD/carga_ponal_oracle.py --archivo /ruta/CONSOLIDADO_PPL_REGIONES.xlsx
```

Tambien se puede llamar el servicio directo:

```bash
python CargueBD/loader_service.py --fuente ponal --archivo /ruta/CONSOLIDADO_PPL_REGIONES.xlsx
python CargueBD/loader_service.py --fuente sisipec --archivo /ruta/Consolidado_SISIPEC.xlsx
python CargueBD/loader_service.py --fuente aurora_10 --archivo /ruta/Aurora_1_0.xlsx
```

Para diagnostico sin ETL:

```bash
python CargueBD/loader_service.py --fuente ponal --archivo /ruta/archivo.xlsx --no-etl
```

## 10. Seguridad y control operativo

- Solo usuarios con rol `admin`, `carguebd` o `cargas_bd` pueden ver y operar el modulo.
- Los archivos `.xlsx` se consideran sensibles y no deben versionarse.
- Las credenciales Oracle no estan en los scripts; se leen desde variables de entorno.
- Los logs no deben incluir secretos.
- La ruta `AURORA_CARGAS_DIR` debe tener permisos restringidos al usuario del proceso backend.
- Antes de ejecutar cargas productivas, confirmar que `ORACLE_SCHEMA` apunta al esquema correcto.
- `CARGUEBD_SKIP_ETL=true` no debe usarse en operacion mensual normal.

## 11. Validacion recomendada

Antes de liberar el modulo:

```bash
python -m py_compile CargueBD/*.py
npm --prefix backend test
npm --prefix frontend run test
npm --prefix frontend run build
```

Antes de cada carga mensual:

1. Confirmar que el archivo corresponde a la fuente seleccionada.
2. Verificar que la fecha de corte del archivo sea la esperada.
3. Confirmar que no haya otra carga en ejecucion.
4. Ejecutar la carga desde el modulo admin.
5. Revisar el log y el estado final.
6. Confirmar con consultas funcionales que los datos normalizados quedaron disponibles.

## 12. Diagnostico validado en desarrollo

Validacion realizada el 2026-05-19 sobre el ambiente de desarrollo configurado en `backend/.env`:

| Fuente | Resultado staging | Resultado ETL |
|---|---:|---|
| PONAL | `DNDP.PONAL` con 18.092 filas | `PRC_CARGA_PONAL` visible, `VALID`, ejecutado OK en `LOG_CARGA` |
| Aurora 1.0 | `DNDP.AURORA_10` con 17.036 filas | `PRC_CARGA_AURORA10` visible, `VALID`, ejecutado OK en `LOG_CARGA` |
| SISIPEC | `DNDP.SISIPEC` con 140.873 filas | Falla al ejecutar `DNDP.PRC_CARGA_SISIPEC_V3`: Oracle responde `PLS-00201`, por lo que el procedimiento no existe, no es visible para el usuario configurado o falta permiso `EXECUTE` |

Conclusiones:

- PONAL y Aurora 1.0 quedaron cargados en staging y ejecutaron ETL correctamente en desarrollo.
- SISIPEC no falla por formato del Excel ni por insercion staging; el bloqueo esta en la disponibilidad/permisos del procedimiento Oracle `PRC_CARGA_SISIPEC_V3`.
- Desde esta validacion, el servicio Python revisa la existencia y estado del procedimiento ETL antes de modificar staging, para evitar recargas largas cuando falta un objeto Oracle.
- Antes de declarar SISIPEC operativo en produccion, el DBA debe confirmar la existencia del procedimiento en el esquema destino, su estado `VALID` y los permisos de ejecucion para el usuario configurado.

## 13. Relacion con `LOG_CARGA`

El diccionario de base de datos referencia `LOG_CARGA` como bitacora de los procedimientos ETL en Oracle. La implementacion del modulo admin mantiene una bitacora operativa adicional en archivos (`cargas.json` y `.log`) para trazabilidad del upload y ejecucion del proceso Python.

Ambas trazabilidades son complementarias:

- `cargas.json` y logs del backend/Python: evidencia de archivo recibido, usuario, estado del proceso y salida tecnica.
- `LOG_CARGA`: evidencia interna del procedimiento ETL en Oracle, con conteos y resultado del procesamiento de datos.
