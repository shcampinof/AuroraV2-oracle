# scripts/cargas_bd

Esta carpeta contiene el servicio Python usado por Aurora para cargar archivos Excel mensuales hacia tablas staging Oracle y ejecutar los procedimientos ETL correspondientes.

Fecha de actualización técnica: 2026-07-30.

Los archivos de datos no deben guardarse en esta carpeta ni versionarse en Git. Las cargas operativas se reciben desde el módulo administrativo de Aurora y se almacenan en `AURORA_CARGAS_DIR`; para ejecución por consola se debe pasar siempre la ruta del archivo con `--archivo`.

## Comandos

```bash
python scripts/cargas_bd/loader_service.py --fuente ponal --archivo /ruta/CONSOLIDADO_PPL_REGIONES.xlsx
python scripts/cargas_bd/loader_service.py --fuente sisipec --archivo /ruta/Consolidado_SISIPEC.xlsx
python scripts/cargas_bd/loader_service.py --fuente aurora_10 --archivo /ruta/Aurora_1_0.xlsx
```

## Dependencias

```bash
pip install -r scripts/cargas_bd/requirements.txt
```

## Fuentes e integración

- `ponal`: ejecuta la carga del consolidado PONAL mediante `carga_ponal_oracle.py`.
- `sisipec`: carga el consolidado SISIPEC y ejecuta el procedimiento configurado en `CARGUEBD_SISIPEC_PROCEDURE`.
- `aurora_10`: procesa la fuente histórica Aurora 1.0; puede deshabilitarse con `CARGUEBD_AURORA10_ENABLED=false`.

El backend inicia `loader_service.py` como proceso hijo con argumentos explícitos, sin intérprete de comandos. La conexión usa las variables `ORACLE_*` del ambiente y los nombres de objetos Oracle se validan antes de formar SQL dinámico.

Cuando el ETL termina correctamente, el backend recalcula la acción vigente de
la última gestión asociada a cada situación activa usando las mismas reglas de
Usuarios asignados. El cargue solo se marca como exitoso después de persistir
esa reconciliación. Finalmente incrementa la versión global de datos; los
navegadores abiertos la detectan, eliminan sus cachés de PPL y refrescan las
consultas visibles sin recargar formularios que puedan tener cambios sin guardar.

Los cargues ejecutados con `CARGUEBD_SKIP_ETL=true` omiten la reconciliación,
porque solo modifican staging.

## Almacenamiento y operación

- `AURORA_CARGAS_DIR`: carpeta persistente para archivos recibidos, `cargas.json` y logs.
- `AURORA_CARGAS_TMP_DIR`: carpeta temporal opcional para la recepción inicial.
- `CARGUEBD_MAX_FILE_MB`: tamaño máximo de archivos `.xlsx`.
- `CARGUEBD_SKIP_ETL`: permite validar staging sin ejecutar ETL cuando el ambiente lo requiera.
- `CARGUEBD_REPAIR_REGISTRY_ON_START`: repara un registro JSON inválido conservando respaldo.
- `CARGUEBD_CLEAR_REGISTRY_ON_START`: limpia una sola vez el historial visual conservando respaldo.

En Docker, `AURORA_CARGAS_DIR` debe apuntar a `/app/backend/storage/cargas_bd`, respaldado por el volumen `aurora_cargas_bd`. Los archivos operativos, logs, respaldos y hojas de cálculo no se versionan.

## Validación

```bash
npm --prefix backend test
python3 -m unittest discover -s scripts/cargas_bd -p 'test_*.py' -v
python3 -m py_compile scripts/cargas_bd/*.py
```

La prueba real contra Oracle requiere un ambiente autorizado y se ejecuta por separado; no debe apuntar a producción cuando pueda modificar staging o disparar ETL.
