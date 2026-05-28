# scripts/cargas_bd

Esta carpeta contiene el servicio Python usado por Aurora para cargar archivos Excel mensuales hacia tablas staging Oracle y ejecutar los procedimientos ETL correspondientes.

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
