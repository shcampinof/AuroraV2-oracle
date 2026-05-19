"""
CARGADOR EXCEL → ORACLE | Tabla: DNDP.AURORA_10
──────────────────────────────────────────────
Archivo fuente : AURORA_1_0.xlsx (exportación SharePoint)
Filas aprox.   : 17.157
Columnas       : hasta CREADO (inclusive)

Comportamiento:
  - Si la tabla NO existe → la crea con el DDL exacto
  - Si ya existe → trunca y recarga
  - Elimina duplicados por cédula (Title), conserva el más reciente (Creado)

Requisitos:
  pip install pandas openpyxl oracledb

Uso:
  python cargar_aurora_10.py --archivo AURORA_1_0.xlsx
"""

import argparse
import sys
import math
import pandas as pd
import oracledb

# ──────────────────────────────────────────────
# CONFIGURACIÓN DE CONEXIÓN
# ──────────────────────────────────────────────
DB_HOST    = "kannon.defensoria.gov.co"
DB_PORT    = 1521
DB_SERVICE = "DNDPDEV.defensoria.gov.co"
DB_USER    = "DNDP"
DB_PASS    = "jDVk5fgrq$26."

ESQUEMA    = "DNDP"
TABLA      = "AURORA_10"
BATCH_SIZE = 500

DDL_CREAR_TABLA = """
CREATE TABLE DNDP.AURORA_10 (
    CEDULA                              NVARCHAR2(50),
    NOMBRE_USUARIO                      NVARCHAR2(400),
    GENERO                              NVARCHAR2(50),
    FECHA_NACIMIENTO                    DATE,
    CONDICION_ESPECIAL                  NVARCHAR2(255),
    ESTABLECIMIENTO                     NVARCHAR2(400),
    DEPARTAMENTO                        NVARCHAR2(255),
    MUNICIPIO                           NVARCHAR2(255),
    FASE_TRATAMIENTO                    NVARCHAR2(100),
    AUTORIDAD_CARGO                     NVARCHAR2(500),
    PROCESO                             NVARCHAR2(255),
    DELITOS                             NVARCHAR2(2000),
    SITUACION_JURIDICA                  NVARCHAR2(255),
    PENA_ANIOS                          NUMBER,
    PENA_MESES                          NUMBER,
    PENA_DIAS                           NUMBER,
    PENA_TOTAL_DIAS                     NUMBER,
    REDENCION                           NUMBER,
    TIEMPO_PRIVACION                    NUMBER,
    TIEMPO_EFECTIVO                     NUMBER,
    PORCENTAJE_AVANCE                   NUMBER,
    CALIFICACION_CONDUCTA               NUMBER,
    FECHA_ULTIMA_CALIFICACION           DATE,
    REQUERIMIENTOS                      NVARCHAR2(255),
    DEFENSOR                            NVARCHAR2(400),
    FECHA_ANALISIS                      DATE,
    LIBERTAD_CONDICIONAL                NVARCHAR2(255),
    PRISION_DOMICILIARIA_MITAD_PENA     NVARCHAR2(255),
    PROCEDENCIA_PENA_CUMPLIDA           NVARCHAR2(255),
    PROCEDENCIA_ACUMULACION_PENAS       NVARCHAR2(255),
    CON_QUE_PROCESOS_ACUMULAR           NVARCHAR2(255),
    RESUMEN_ANALISIS_CASO               NVARCHAR2(2000),
    OTRAS_SOLICITUDES_TRAMITAR          NVARCHAR2(255),
    FECHA_ENTREVISTA                    DATE,
    DECISION_USUARIO                    NVARCHAR2(255),
    PODER_AVANZAR_SOLICITUD             NVARCHAR2(255),
    REQUIERE_PRUEBAS                    NVARCHAR2(255),
    FECHA_RECEPCION_PRUEBAS_USUARIO     DATE,
    FECHA_SOLICITUD_DOCS_INPEC          DATE,
    FECHA_RECEPCION_TODAS_PRUEBAS       DATE,
    FECHA_PRESENTACION_SOLICITUD        DATE,
    FECHA_DECISION_AUTORIDAD            DATE,
    SENTIDO_DECISION                    NVARCHAR2(255),
    MOTIVO_DECISION_NEGATIVA_LC         NVARCHAR2(255),
    MOTIVO_DECISION_NEGATIVA_PD         NVARCHAR2(255),
    FECHA_RECURSO_DESFAVORABLE          DATE,
    SENTIDO_DECISION_RECURSO            NVARCHAR2(255),
    TIPO_SOLICITUD                      NVARCHAR2(255),
    FECHA_REGISTRO                      DATE
)
"""

COLUMNAS = [
    "CEDULA", "NOMBRE_USUARIO", "GENERO", "FECHA_NACIMIENTO",
    "CONDICION_ESPECIAL", "ESTABLECIMIENTO", "DEPARTAMENTO", "MUNICIPIO",
    "FASE_TRATAMIENTO", "AUTORIDAD_CARGO", "PROCESO", "DELITOS",
    "SITUACION_JURIDICA", "PENA_ANIOS", "PENA_MESES", "PENA_DIAS",
    "PENA_TOTAL_DIAS", "REDENCION", "TIEMPO_PRIVACION", "TIEMPO_EFECTIVO",
    "PORCENTAJE_AVANCE", "CALIFICACION_CONDUCTA", "FECHA_ULTIMA_CALIFICACION",
    "REQUERIMIENTOS", "DEFENSOR", "FECHA_ANALISIS", "LIBERTAD_CONDICIONAL",
    "PRISION_DOMICILIARIA_MITAD_PENA", "PROCEDENCIA_PENA_CUMPLIDA",
    "PROCEDENCIA_ACUMULACION_PENAS", "CON_QUE_PROCESOS_ACUMULAR",
    "RESUMEN_ANALISIS_CASO", "OTRAS_SOLICITUDES_TRAMITAR",
    "FECHA_ENTREVISTA", "DECISION_USUARIO", "PODER_AVANZAR_SOLICITUD",
    "REQUIERE_PRUEBAS", "FECHA_RECEPCION_PRUEBAS_USUARIO",
    "FECHA_SOLICITUD_DOCS_INPEC", "FECHA_RECEPCION_TODAS_PRUEBAS",
    "FECHA_PRESENTACION_SOLICITUD", "FECHA_DECISION_AUTORIDAD",
    "SENTIDO_DECISION", "MOTIVO_DECISION_NEGATIVA_LC",
    "MOTIVO_DECISION_NEGATIVA_PD", "FECHA_RECURSO_DESFAVORABLE",
    "SENTIDO_DECISION_RECURSO", "TIPO_SOLICITUD", "FECHA_REGISTRO"
]

COLUMNAS_FECHA = {
    "FECHA_NACIMIENTO", "FECHA_ULTIMA_CALIFICACION", "FECHA_ANALISIS",
    "FECHA_ENTREVISTA", "FECHA_RECEPCION_PRUEBAS_USUARIO",
    "FECHA_SOLICITUD_DOCS_INPEC", "FECHA_RECEPCION_TODAS_PRUEBAS",
    "FECHA_PRESENTACION_SOLICITUD", "FECHA_DECISION_AUTORIDAD",
    "FECHA_RECURSO_DESFAVORABLE", "FECHA_REGISTRO"
}

COLUMNAS_NUM = {
    "PENA_ANIOS", "PENA_MESES", "PENA_DIAS", "PENA_TOTAL_DIAS",
    "REDENCION", "TIEMPO_PRIVACION", "TIEMPO_EFECTIVO",
    "PORCENTAJE_AVANCE", "CALIFICACION_CONDUCTA"
}

# Mapeo columnas Excel → columnas tabla
MAPEO = {
    "Title":                                                          "CEDULA",
    "Nombre usuario":                                                 "NOMBRE_USUARIO",
    "Género":                                                         "GENERO",
    "Fecha de nacimiento":                                            "FECHA_NACIMIENTO",
    "Condición especial":                                             "CONDICION_ESPECIAL",
    "Establecimiento":                                                "ESTABLECIMIENTO",
    "Departamento del ERON":                                          "DEPARTAMENTO",
    "Municipio del ERON":                                             "MUNICIPIO",
    "Fase de tratamiento":                                            "FASE_TRATAMIENTO",
    "Autoridad a cargo":                                              "AUTORIDAD_CARGO",
    "Proceso":                                                        "PROCESO",
    "Delitos":                                                        "DELITOS",
    "Situación jurídica ":                                            "SITUACION_JURIDICA",
    "Pena años":                                                      "PENA_ANIOS",
    "Pena meses":                                                     "PENA_MESES",
    "Pena días":                                                      "PENA_DIAS",
    "Pena total en días":                                             "PENA_TOTAL_DIAS",
    "Redención ":                                                     "REDENCION",
    "Tiempo de privación de la libertad":                             "TIEMPO_PRIVACION",
    "Tiempo efectivo con redención":                                  "TIEMPO_EFECTIVO",
    "% de avance de pena cumplida":                                   "PORCENTAJE_AVANCE",
    "Calificación de conducta":                                       "CALIFICACION_CONDUCTA",
    "Fecha ultima calificación":                                      "FECHA_ULTIMA_CALIFICACION",
    "¿Cuenta con requerimientos judiciales por otros procesos?":      "REQUERIMIENTOS",
    "Defensor(a) Público(a) Asignado para tramitar la solicitud":     "DEFENSOR",
    "Fecha de análisis jurídico del caso":                            "FECHA_ANALISIS",
    "Procedencia de libertad condicional":                            "LIBERTAD_CONDICIONAL",
    "Procedencia de prisión domiciliaria de mitad de pena":           "PRISION_DOMICILIARIA_MITAD_PENA",
    "Procedencia de pena cumplida":                                   "PROCEDENCIA_PENA_CUMPLIDA",
    "Procedencia de acumulación de penas":                            "PROCEDENCIA_ACUMULACION_PENAS",
    "Con qué proceso(s) debe acumular penas (si aplica)":             "CON_QUE_PROCESOS_ACUMULAR",
    "Resumen del anális del caso":                                    "RESUMEN_ANALISIS_CASO",
    "Otras solicitudes a tramitar":                                   "OTRAS_SOLICITUDES_TRAMITAR",
    "Fecha entrevista":                                               "FECHA_ENTREVISTA",
    "Decisión del usuario":                                           "DECISION_USUARIO",
    "Poder en caso de avanzar con la solicitud":                      "PODER_AVANZAR_SOLICITUD",
    "Requiere pruebas":                                               "REQUIERE_PRUEBAS",
    "Fecha de recepción de pruebas aportadas por el usuario":         "FECHA_RECEPCION_PRUEBAS_USUARIO",
    "Fecha de solicitud de documentos al INPEC":                      "FECHA_SOLICITUD_DOCS_INPEC",
    "Fecha de recepción de documentos del INPEC":                     "FECHA_RECEPCION_TODAS_PRUEBAS",
    "Fecha de presentación de solicitud a la autoridad judicial":     "FECHA_PRESENTACION_SOLICITUD",
    "Fecha de decisión de la autoridad judicial":                     "FECHA_DECISION_AUTORIDAD",
    "Sentido de la decisión":                                         "SENTIDO_DECISION",
    "Motivo de la decisión negativa (Libertad condicional si aplica)":"MOTIVO_DECISION_NEGATIVA_LC",
    "Motivo de la decisión negativa (Prisión domiciliaria si aplica)":"MOTIVO_DECISION_NEGATIVA_PD",
    "Fecha de recurso en caso desfavorable":                          "FECHA_RECURSO_DESFAVORABLE",
    "Sentido de la decisión que resuelve recurso":                    "SENTIDO_DECISION_RECURSO",
    "Tipo de solicitud a tramitar":                                   "TIPO_SOLICITUD",
    "Creado":                                                         "FECHA_REGISTRO",
}


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
    print(f"  Cargador AURORA_10 -> Oracle")
    print(f"  Archivo : {archivo}")
    print(f"  Destino : {nombre_completo}")
    print(f"{'='*58}\n")

    # 1. Leer Excel
    print("[1/5] Leyendo Excel...")
    try:
        df = pd.read_excel(archivo, dtype=str)
    except FileNotFoundError:
        print(f"  ERROR: No se encontro '{archivo}'")
        sys.exit(1)

    # Tomar solo columnas hasta CREADO
    if 'Creado' in df.columns:
        idx_creado = df.columns.get_loc('Creado')
        df = df.iloc[:, :idx_creado + 1].copy()

    # Renombrar columnas según mapeo
    df = df.rename(columns=MAPEO)

    # Agregar columnas faltantes como NULL
    for c in COLUMNAS:
        if c not in df.columns:
            df[c] = None

    # Eliminar filas sin cédula
    df = df[df['CEDULA'].notna()].reset_index(drop=True)

    # Quedarse con el más reciente por cédula
    df['FECHA_REGISTRO'] = pd.to_datetime(df['FECHA_REGISTRO'], errors='coerce')
    df = df.sort_values('FECHA_REGISTRO', ascending=False)
    df = df.drop_duplicates(subset='CEDULA', keep='first').reset_index(drop=True)

    # Convertir fechas de vuelta a string para limpiar_valor
    df = df.astype(str)
    df = df.replace('NaT', None).replace('nan', None).replace('None', None)

    total_filas = len(df)
    print(f"  Filas a cargar   : {total_filas:,}")
    print(f"  Columnas         : {len(COLUMNAS)}\n")

    # 2. Conectar
    print("[2/5] Conectando a Oracle...")
    try:
        dsn  = oracledb.makedsn(DB_HOST, DB_PORT, service_name=DB_SERVICE)
        conn = oracledb.connect(user=DB_USER, password=DB_PASS, dsn=dsn)
        cursor = conn.cursor()
        print(f"  Conexion exitosa -> {DB_HOST}:{DB_PORT}/{DB_SERVICE}\n")
    except oracledb.Error as e:
        print(f"  ERROR de conexion: {e}")
        sys.exit(1)

    # 3. Crear o truncar tabla
    print("[3/5] Verificando tabla en Oracle...")
    if not tabla_existe(cursor):
        print(f"  La tabla {nombre_completo} NO existe -> creando...")
        cursor.execute(DDL_CREAR_TABLA)
        conn.commit()
        print(f"  Tabla creada correctamente.\n")
    else:
        print(f"  La tabla {nombre_completo} ya existe -> truncando...")
        cursor.execute(f"TRUNCATE TABLE {nombre_completo}")
        conn.commit()
        print(f"  Tabla truncada.\n")

    # 4. Insertar
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
            print(f"  Lote {num_lote:>4}/{total_lotes} | {insertados:>6,}/{total_filas:,} filas ({pct:.1f}%)")
        except oracledb.Error as e:
            errores += len(lote)
            conn.rollback()
            print(f"  ERROR lote {num_lote}: {e}")

    # 5. Ejecutar procedimiento ETL
    if errores == 0:
        print(f"\n[5/5] Ejecutando PRC_CARGA_AURORA10...")
        try:
            cursor.callproc("DNDP.PRC_CARGA_AURORA10")
            conn.commit()
            print(f"  Procedimiento ejecutado correctamente.")
        except oracledb.Error as e:
            print(f"  ERROR al ejecutar PRC_CARGA_AURORA10: {e}")
    else:
        print(f"\n[5/5] Se omite PRC_CARGA_AURORA10 — la carga presentó {errores} errores. Corrija el archivo fuente y vuelva a ejecutar.")

    # 6. Resumen
    print(f"\n[6/6] Resumen final")
    print(f"{'─'*45}")
    print(f"  Filas insertadas : {insertados:,}")
    print(f"  Filas con error  : {errores:,}")
    print(f"  Tabla destino    : {nombre_completo}")
    print(f"{'─'*45}")

    cursor.close()
    conn.close()

    if errores == 0:
        print("\n  CARGA COMPLETADA EXITOSAMENTE\n")
    else:
        print(f"\n  CARGA COMPLETADA CON {errores:,} ERRORES\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--archivo", required=True, help="Ruta al archivo Excel Aurora 1.0")
    args = parser.parse_args()
    cargar(args.archivo)
