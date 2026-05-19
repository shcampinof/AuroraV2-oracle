"""
========================================================
  CARGA DE DATOS PPL → TABLA PONAL EN ORACLE DEVELOPER
  Archivo fuente: CONSOLIDADO_PPL_REGIONES.xlsx
========================================================
  Dependencias:
    python carga_ponal_oracle.pypip install oracledb pandas openpyxl

  Instrucciones:
    1. Modifica la sección CREDENCIALES con tus datos.
    2. Ejecuta:  python carga_ponal_oracle.py
========================================================
"""

import oracledb
import pandas as pd
import os
import sys
from datetime import datetime

# ─────────────────────────────────────────────────────────
#  CREDENCIALES — MODIFICA AQUÍ
#  Referencia: Conexión AURORA en Oracle SQL Developer
#  Tipo de conexión : Básico
#  Puerto           : 1521
#  Tipo             : Nombre del Servicio (no SID)
# ─────────────────────────────────────────────────────────
ORACLE_USER     = "DNDP"           # Campo "Usuario" en Oracle Developer
ORACLE_PASSWORD = "jDVk5fgrq$26."        # Campo "Contraseña" en Oracle Developer
ORACLE_HOST     = "kannon.defensoria.gov.co"      # Campo "Nombre del Host" en Oracle Developer
ORACLE_PORT     = 1521                   # Puerto (ya configurado en 1521)
ORACLE_SERVICE  = "DNDPDEV.defensoria.gov.co"  # Campo "Nombre del Servicio" en Oracle Developer

# DSN construido con Nombre del Servicio (igual que tu conexión AURORA)
ORACLE_DSN = f"{ORACLE_HOST}:{ORACLE_PORT}/{ORACLE_SERVICE}"

# ─────────────────────────────────────────────────────────
#  MODO DE CONEXIÓN
#  oracledb funciona en modo "thin" por defecto (sin Instant Client).
#  Si tu servidor Oracle requiere wallets o conexiones avanzadas,
#  descomenta la siguiente línea y apunta a tu Instant Client:
# oracledb.init_oracle_client(lib_dir=r"C:\oracle\instantclient_21_9")
# ─────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────
#  RUTA DEL ARCHIVO FUENTE
# ─────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
EXCEL_FILE = os.path.join(BASE_DIR, "CONSOLIDADO_PPL_REGIONES.xlsx")

# ─────────────────────────────────────────────────────────
#  CONFIGURACIÓN
# ─────────────────────────────────────────────────────────
TABLE_NAME  = "PONAL"
BATCH_SIZE  = 500      # Filas por lote de inserción
DROP_FIRST  = True     # True = elimina y recrea la tabla si ya existe


# ─────────────────────────────────────────────────────────
#  DDL DE LA TABLA
# ─────────────────────────────────────────────────────────
DDL_CREATE = f"""
CREATE TABLE {TABLE_NAME} (
    ID                    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    UNIDAD                VARCHAR2(100),
    ESTACION_CDT          VARCHAR2(250),
    DEPARTAMENTO          VARCHAR2(100),
    MUNICIPIO             VARCHAR2(100),
    DIRECCION_CDT         VARCHAR2(300),
    NOMBRES               VARCHAR2(200),
    APELLIDOS             VARCHAR2(200),
    TIPO_IDENTIFICACION   VARCHAR2(100),
    NUMERO_DOCUMENTO      VARCHAR2(50),
    NACIONALIDAD          VARCHAR2(100),
    SITUACION_JURIDICA    VARCHAR2(100),
    FECHA_CAPTURA_RAW     VARCHAR2(500),
    RADICADO              VARCHAR2(150),
    DELITOS_IMPUTADOS     VARCHAR2(4000),
    AUTORIDAD_JUDICIAL    VARCHAR2(500),
    LUGAR_PRIVACION       VARCHAR2(50),
    FUENTE                VARCHAR2(50),
    FECHA_CORTE           DATE
)
"""

DDL_DROP = f"DROP TABLE {TABLE_NAME} PURGE"

# ─────────────────────────────────────────────────────────
#  SQL DE INSERCIÓN
#  LUGAR_PRIVACION y FUENTE son constantes: 'CDT' y 'PONAL'
# ─────────────────────────────────────────────────────────
SQL_INSERT = f"""
INSERT INTO {TABLE_NAME} (
    UNIDAD, ESTACION_CDT, DEPARTAMENTO, MUNICIPIO,
    DIRECCION_CDT, NOMBRES, APELLIDOS, TIPO_IDENTIFICACION,
    NUMERO_DOCUMENTO, NACIONALIDAD, SITUACION_JURIDICA,
    FECHA_CAPTURA_RAW, RADICADO, DELITOS_IMPUTADOS, AUTORIDAD_JUDICIAL,
    LUGAR_PRIVACION, FUENTE, FECHA_CORTE
) VALUES (
    :1, :2, :3, :4, :5, :6, :7, :8,
    :9, :10, :11, :12, :13, :14, :15,
    'CDT', 'PONAL', :16
)
"""


# ─────────────────────────────────────────────────────────
#  CARGA Y LIMPIEZA DEL EXCEL
# ─────────────────────────────────────────────────────────
def celda_a_str(val) -> str | None:
    """Convierte cualquier tipo Python/numpy a str puro o None."""
    if val is None:
        return None
    try:
        import math
        if isinstance(val, float) and math.isnan(val):
            return None
    except Exception:
        pass
    texto = str(val).strip()
    return None if texto in ("nan", "NaT", "None", "NaN", "") else texto


def celda_a_fecha(val):
    """Convierte un valor a datetime para columnas DATE de Oracle, o None si inválido."""
    if val is None:
        return None
    try:
        import math
        if isinstance(val, float) and math.isnan(val):
            return None
    except Exception:
        pass
    if str(val).strip() in ("nan", "NaT", "None", "NaN", ""):
        return None
    try:
        ts = pd.Timestamp(val)
        return None if pd.isna(ts) else ts.to_pydatetime()
    except Exception:
        return None


def cargar_excel(ruta: str) -> list:
    print(f"\n[1/4] Leyendo archivo: {ruta}")
    if not os.path.exists(ruta):
        print(f"  ERROR: No se encontró el archivo {ruta}")
        sys.exit(1)

    df = pd.read_excel(ruta, sheet_name="CONSOLIDADO")

    # Las primeras 15 columnas van como texto puro.
    # La última columna (FECHA_CORTE) se convierte a datetime para Oracle DATE.
    filas = []
    for fila_raw in df.values.tolist():
        *cols_texto, fecha_corte_raw = fila_raw
        filas.append(
            tuple(celda_a_str(v) for v in cols_texto) + (celda_a_fecha(fecha_corte_raw),)
        )

    print(f"  Filas cargadas del Excel  : {len(filas):,}")
    print(f"  Columnas por fila         : {len(filas[0]) if filas else 0}")
    return filas


# ─────────────────────────────────────────────────────────
#  PREPARAR TABLA EN ORACLE
# ─────────────────────────────────────────────────────────
def preparar_tabla(cursor):
    print(f"\n[2/4] Preparando tabla {TABLE_NAME} en Oracle")
    if DROP_FIRST:
        try:
            cursor.execute(DDL_DROP)
            print(f"  Tabla {TABLE_NAME} eliminada.")
        except oracledb.DatabaseError as e:
            error, = e.args
            if error.code == 942:   # ORA-00942: tabla no existe, ignorar
                print(f"  La tabla {TABLE_NAME} no existía, se crea desde cero.")
            else:
                raise

    cursor.execute(DDL_CREATE)
    print(f"  Tabla {TABLE_NAME} creada correctamente.")


# ─────────────────────────────────────────────────────────
#  INSERCIÓN POR LOTES
# ─────────────────────────────────────────────────────────
def insertar_datos(connection, cursor, filas: list):
    print(f"\n[3/4] Insertando {len(filas):,} registros en lotes de {BATCH_SIZE}...")

    filas_ok    = 0
    filas_error = 0
    errores_log = []
    total       = len(filas)

    for inicio in range(0, total, BATCH_SIZE):
        lote = filas[inicio: inicio + BATCH_SIZE]

        try:
            cursor.executemany(SQL_INSERT, lote)
            connection.commit()
            filas_ok += len(lote)
        except oracledb.DatabaseError:
            connection.rollback()
            # Reintento fila a fila para no perder registros buenos
            for i, fila in enumerate(lote):
                try:
                    cursor.execute(SQL_INSERT, fila)
                    connection.commit()
                    filas_ok += 1
                except oracledb.DatabaseError as e2:
                    connection.rollback()
                    filas_error += 1
                    errores_log.append({
                        "fila_excel": inicio + i + 2,
                        "documento": fila[8],
                        "error": str(e2)
                    })

        procesados = min(inicio + BATCH_SIZE, total)
        if procesados % 2000 == 0 or procesados == total:
            pct = procesados / total * 100
            print(f"  → {procesados:>6,} / {total:,} ({pct:.1f}%)  |  OK: {filas_ok:,}  |  Errores: {filas_error}")

    return filas_ok, filas_error, errores_log


# ─────────────────────────────────────────────────────────
#  RESUMEN FINAL
# ─────────────────────────────────────────────────────────
def imprimir_resumen(filas, filas_ok, filas_error, errores_log, t_inicio):
    duracion = (datetime.now() - t_inicio).total_seconds()
    print(f"\n{'='*55}")
    print(f"  RESUMEN DE CARGA — {TABLE_NAME}")
    print(f"{'='*55}")
    print(f"  Total registros en Excel  : {len(filas):,}")
    print(f"  Insertados correctamente  : {filas_ok:,}")
    print(f"  Errores de inserción      : {filas_error}")
    print(f"  Tiempo total              : {duracion:.1f} seg")
    print(f"{'='*55}")

    if errores_log:
        log_path = os.path.join(BASE_DIR, "errores_carga_ponal.txt")
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(f"ERRORES DE CARGA — {datetime.now()}\n")
            f.write("="*55 + "\n")
            for e in errores_log:
                f.write(f"Fila Excel {e['fila_excel']} | Doc: {e['documento']} | {e['error']}\n")
        print(f"\n  Log de errores guardado en: {log_path}")


# ─────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────
def main():
    t_inicio = datetime.now()
    print("="*55)
    print(f"  CARGA PPL → ORACLE  |  {t_inicio.strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*55)

    # 1. Leer Excel → lista de tuplas con str puro / None
    filas = cargar_excel(EXCEL_FILE)

    # 2. Conectar a Oracle
    print(f"\n[  ] Conectando a Oracle: {ORACLE_DSN}")
    try:
        connection = oracledb.connect(
            user=ORACLE_USER,
            password=ORACLE_PASSWORD,
            dsn=ORACLE_DSN
        )
        cursor = connection.cursor()
        print(f"  Conexión exitosa.")
    except oracledb.DatabaseError as e:
        print(f"  ERROR de conexión: {e}")
        sys.exit(1)

    # 3. Preparar tabla
    preparar_tabla(cursor)

    # 4. Insertar datos
    filas_ok, filas_error, errores_log = insertar_datos(connection, cursor, filas)

    # 5. Ejecutar procedimiento ETL
    if filas_error == 0:
        print(f"\n[4/4] Ejecutando PRC_CARGA_PONAL...")
        try:
            cursor.callproc("DNDP.PRC_CARGA_PONAL")
            connection.commit()
            print(f"  Procedimiento ejecutado correctamente.")
        except oracledb.DatabaseError as e:
            print(f"  ERROR al ejecutar PRC_CARGA_PONAL: {e}")
    else:
        print(f"\n[4/4] Se omite PRC_CARGA_PONAL — la carga presentó {filas_error} errores. Corrija el archivo fuente y vuelva a ejecutar.")

    # 6. Resumen
    imprimir_resumen(filas, filas_ok, filas_error, errores_log, t_inicio)

    cursor.close()
    connection.close()
    print("\n  Conexión cerrada. Proceso finalizado.\n")


if __name__ == "__main__":
    main()