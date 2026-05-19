import argparse
import sys
import math
import os
import pandas as pd
import oracledb

DB_HOST    = "kannon.defensoria.gov.co"
DB_PORT    = 1521
DB_SERVICE = "DNDPDEV.defensoria.gov.co"
DB_USER    = "DNDP"
DB_PASS    = "jDVk5fgrq$26."

ESQUEMA    = "DNDP"
TABLA      = "SISIPEC"
BATCH_SIZE = 500

DDL_CREAR_TABLA = """
CREATE TABLE DNDP.SISIPEC (
    NUMERO              NVARCHAR2(50),
    NOMBRE              NVARCHAR2(400),
    GENERO              NVARCHAR2(50),
    FECHA_NACIMIENTO    DATE,
    EDAD                NUMBER,
    ENFOQUE             NUMBER,
    ESTABLECIMIENTO     NVARCHAR2(400),
    DEPARTAMENTO        NVARCHAR2(255),
    MUNICIPIO           NVARCHAR2(255),
    FASE                NVARCHAR2(100),
    AUTORIDAD           NVARCHAR2(500),
    PROCESO             NVARCHAR2(255),
    FECHA_CAPTURA       DATE,
    DELITOS             NVARCHAR2(2000),
    SITUACION           NVARCHAR2(255),
    PENA                NUMBER,
    PENA_DIAS           NUMBER,
    REDENCION           NUMBER,
    PRIVACION           NUMBER,
    TIEMPO_EFECTIVO     NUMBER,
    PORCENTAJE          NUMBER,
    CALIFICACION        NUMBER,
    FECHA_CALIFICACION  DATE,
    REQUERIMIENTOS      NVARCHAR2(255),
    CATEGORIZACION      NVARCHAR2(255),
    FUENTE              NVARCHAR2(255),
    FECHA_CORTE         DATE
)
"""

COLUMNAS = [
    "NUMERO", "NOMBRE", "GENERO", "FECHA_NACIMIENTO", "EDAD", "ENFOQUE",
    "ESTABLECIMIENTO", "DEPARTAMENTO", "MUNICIPIO", "FASE", "AUTORIDAD",
    "PROCESO", "FECHA_CAPTURA", "DELITOS", "SITUACION", "PENA", "PENA_DIAS",
    "REDENCION", "PRIVACION", "TIEMPO_EFECTIVO", "PORCENTAJE", "CALIFICACION",
    "FECHA_CALIFICACION", "REQUERIMIENTOS", "CATEGORIZACION", "FUENTE",
    "FECHA_CORTE"
]

COLUMNAS_FECHA  = {"FECHA_NACIMIENTO", "FECHA_CALIFICACION", "FECHA_CAPTURA", "FECHA_CORTE"}
COLUMNAS_NUM    = {"EDAD", "ENFOQUE", "PENA", "PENA_DIAS", "REDENCION", "PRIVACION",
                   "TIEMPO_EFECTIVO", "PORCENTAJE", "CALIFICACION"}


def tabla_existe(cursor):
    cursor.execute(
        "SELECT COUNT(*) FROM ALL_TABLES WHERE OWNER=:1 AND TABLE_NAME=:2",
        [ESQUEMA.upper(), TABLA.upper()]
    )
    return cursor.fetchone()[0] > 0


def es_nulo(val):
    if val is None:
        return True
    try:
        if isinstance(val, float) and math.isnan(val):
            return True
    except TypeError:
        pass
    if str(val).strip() in ('nan', 'NaT', 'None', '<NA>', ''):
        return True
    return False


def limpiar_valor(val, col):
    if es_nulo(val):
        return None
    if col in COLUMNAS_FECHA:
        try:
            ts = pd.Timestamp(val)
            return None if pd.isna(ts) else ts.to_pydatetime()
        except Exception:
            return None
    if col in COLUMNAS_NUM:
        try:
            return float(str(val).strip())
        except Exception:
            return None
    texto = str(val).strip()
    return None if texto in ('nan', 'NaT', 'None', '<NA>', '') else texto


def preparar_fila(row):
    return [limpiar_valor(row[col], col) for col in COLUMNAS]


def cargar(archivo):
    nombre_completo = f"{ESQUEMA}.{TABLA}"
    print(f"\n{'='*58}")
    print(f"  Cargador SISIPEC -> Oracle")
    print(f"  Archivo : {archivo}")
    print(f"  Destino : {nombre_completo}")
    print(f"{'='*58}\n")

    print("[1/5] Leyendo Excel...")
    try:
        df = pd.read_excel(archivo, dtype=str)
    except FileNotFoundError:
        print(f"  ERROR: No se encontro el archivo '{archivo}'")
        sys.exit(1)

    df.columns = [c.strip().upper() for c in df.columns]
    for c in COLUMNAS:
        if c not in df.columns:
            print(f"  ADVERTENCIA: columna '{c}' no encontrada, se cargara como NULL")
            df[c] = None

    df = df.dropna(how='all').reset_index(drop=True)
    total_filas = len(df)
    print(f"  Filas leidas : {total_filas:,}")
    print(f"  Columnas     : {len(df.columns)}\n")

    print("[2/5] Conectando a Oracle...")
    try:
        dsn  = oracledb.makedsn(DB_HOST, DB_PORT, service_name=DB_SERVICE)
        conn = oracledb.connect(user=DB_USER, password=DB_PASS, dsn=dsn)
        cursor = conn.cursor()
        print(f"  Conexion exitosa -> {DB_HOST}:{DB_PORT}/{DB_SERVICE}\n")
    except oracledb.Error as e:
        print(f"  ERROR de conexion: {e}")
        sys.exit(1)

    print("[3/5] Verificando tabla en Oracle...")
    if tabla_existe(cursor):
        print(f"  La tabla {nombre_completo} ya existe -> eliminando para recrear con nueva estructura...")
        cursor.execute(f"DROP TABLE {nombre_completo} PURGE")
        conn.commit()
        print(f"  Tabla eliminada.")
    else:
        print(f"  La tabla {nombre_completo} NO existe.")
    cursor.execute(DDL_CREAR_TABLA)
    conn.commit()
    print(f"  Tabla creada con nueva estructura ({len(COLUMNAS)} columnas).\n")

    print(f"[4/5] Insertando {total_filas:,} filas en lotes de {BATCH_SIZE}...")
    cols_str     = ", ".join(COLUMNAS)
    placeholders = ", ".join([f":{i+1}" for i in range(len(COLUMNAS))])
    sql_insert   = f"INSERT INTO {nombre_completo} ({cols_str}) VALUES ({placeholders})"

    datos       = [preparar_fila(row) for _, row in df[COLUMNAS].iterrows()]
    insertados  = 0
    errores     = 0
    total_lotes = math.ceil(total_filas / BATCH_SIZE)

    for i in range(0, total_filas, BATCH_SIZE):
        lote     = datos[i:i + BATCH_SIZE]
        num_lote = i // BATCH_SIZE + 1
        try:
            cursor.executemany(sql_insert, lote)
            conn.commit()
            insertados += len(lote)
            pct = (insertados / total_filas) * 100
            print(f"  Lote {num_lote:>4}/{total_lotes} | {insertados:>7,}/{total_filas:,} filas ({pct:.1f}%)")
        except oracledb.Error as e:
            errores += len(lote)
            conn.rollback()
            print(f"  ERROR lote {num_lote}: {e}")

    # 5. Ejecutar procedimiento ETL
    if errores == 0:
        print(f"\n[5/5] Ejecutando PRC_CARGA_SISIPEC_V3...")
        try:
            cursor.callproc("DNDP.PRC_CARGA_SISIPEC_V3")
            conn.commit()
            print(f"  Procedimiento ejecutado correctamente.")
        except oracledb.Error as e:
            print(f"  ERROR al ejecutar PRC_CARGA_SISIPEC_V3: {e}")
    else:
        print(f"\n[5/5] Se omite PRC_CARGA_SISIPEC_V3 — la carga presentó {errores} errores. Corrija el archivo fuente y vuelva a ejecutar.")

    # 6. Resumen
    print(f"\n[6/6] Resumen final")
    print("-" * 45)
    print(f"  Filas insertadas : {insertados:,}")
    print(f"  Filas con error  : {errores:,}")
    print(f"  Tabla destino    : {nombre_completo}")
    print("-" * 45)
    cursor.close()
    conn.close()

    if errores == 0:
        print("\n  CARGA COMPLETADA EXITOSAMENTE\n")
    else:
        print(f"\n  CARGA COMPLETADA CON {errores:,} ERRORES\n")


if __name__ == "__main__":
    RUTA_DEFAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Consolidado_SISIPEC.xlsx")
    parser = argparse.ArgumentParser()
    parser.add_argument("--archivo", default=RUTA_DEFAULT, help="Ruta al archivo Excel")
    args = parser.parse_args()
    cargar(args.archivo)
