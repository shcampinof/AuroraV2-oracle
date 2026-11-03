import argparse
import math
import os
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import oracledb


BATCH_SIZE = int(os.getenv("CARGUEBD_BATCH_SIZE", "500"))
DEFAULT_SCHEMA = (
    os.getenv("ORACLE_SCHEMA")
    or os.getenv("DB_SCHEMA")
    or os.getenv("ORACLE_USER")
    or os.getenv("DB_USER")
    or "DNDP"
).strip() or "DNDP"


def env_first(*names, default=""):
    for name in names:
        value = os.getenv(name)
        if value is not None and str(value).strip() != "":
            return str(value).strip()
    return default


def oracle_config():
    return {
        "host": env_first("ORACLE_HOST", "DB_HOST", default="kannon.defensoria.gov.co"),
        "port": int(env_first("ORACLE_PORT", "DB_PORT", default="1521")),
        "service": env_first("ORACLE_SERVICE", "ORACLE_SERVICE_NAME", "DB_SERVICE", default="DNDPDEV.defensoria.gov.co"),
        "user": env_first("ORACLE_USER", "DB_USER", default="DNDP"),
        "password": env_first("ORACLE_PASSWORD", "DB_PASS"),
    }


def require_oracle_password(config):
    if not config["password"]:
        raise RuntimeError("Falta ORACLE_PASSWORD/DB_PASS en variables de entorno.")


def qualified_name(table, schema=DEFAULT_SCHEMA):
    safe_table = str(table).strip().upper()
    safe_schema = str(schema or "").strip().upper()
    return f"{safe_schema}.{safe_table}" if safe_schema else safe_table


AURORA_COLUMNS = [
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
    "SENTIDO_DECISION_RECURSO", "TIPO_SOLICITUD", "FECHA_REGISTRO",
]

AURORA_DATE_COLUMNS = {
    "FECHA_NACIMIENTO", "FECHA_ULTIMA_CALIFICACION", "FECHA_ANALISIS",
    "FECHA_ENTREVISTA", "FECHA_RECEPCION_PRUEBAS_USUARIO",
    "FECHA_SOLICITUD_DOCS_INPEC", "FECHA_RECEPCION_TODAS_PRUEBAS",
    "FECHA_PRESENTACION_SOLICITUD", "FECHA_DECISION_AUTORIDAD",
    "FECHA_RECURSO_DESFAVORABLE", "FECHA_REGISTRO",
}

AURORA_NUMBER_COLUMNS = {
    "PENA_ANIOS", "PENA_MESES", "PENA_DIAS", "PENA_TOTAL_DIAS",
    "REDENCION", "TIEMPO_PRIVACION", "TIEMPO_EFECTIVO",
    "PORCENTAJE_AVANCE",
}

AURORA_MAPPING = {
    "Title": "CEDULA",
    "Nombre usuario": "NOMBRE_USUARIO",
    "Genero": "GENERO",
    "Género": "GENERO",
    "Fecha de nacimiento": "FECHA_NACIMIENTO",
    "Condicion especial": "CONDICION_ESPECIAL",
    "Condición especial": "CONDICION_ESPECIAL",
    "Establecimiento": "ESTABLECIMIENTO",
    "Departamento del ERON": "DEPARTAMENTO",
    "Municipio del ERON": "MUNICIPIO",
    "Fase de tratamiento": "FASE_TRATAMIENTO",
    "Autoridad a cargo": "AUTORIDAD_CARGO",
    "Proceso": "PROCESO",
    "Delitos": "DELITOS",
    "Situacion juridica ": "SITUACION_JURIDICA",
    "Situación jurídica ": "SITUACION_JURIDICA",
    "Pena años": "PENA_ANIOS",
    "Pena meses": "PENA_MESES",
    "Pena días": "PENA_DIAS",
    "Pena dias": "PENA_DIAS",
    "Pena total en días": "PENA_TOTAL_DIAS",
    "Pena total en dias": "PENA_TOTAL_DIAS",
    "Redencion ": "REDENCION",
    "Redención ": "REDENCION",
    "Tiempo de privación de la libertad": "TIEMPO_PRIVACION",
    "Tiempo de privacion de la libertad": "TIEMPO_PRIVACION",
    "Tiempo efectivo con redención": "TIEMPO_EFECTIVO",
    "Tiempo efectivo con redencion": "TIEMPO_EFECTIVO",
    "% de avance de pena cumplida": "PORCENTAJE_AVANCE",
    "Calificación de conducta": "CALIFICACION_CONDUCTA",
    "Calificacion de conducta": "CALIFICACION_CONDUCTA",
    "Fecha ultima calificación": "FECHA_ULTIMA_CALIFICACION",
    "Fecha ultima calificacion": "FECHA_ULTIMA_CALIFICACION",
    "¿Cuenta con requerimientos judiciales por otros procesos?": "REQUERIMIENTOS",
    "Defensor(a) Público(a) Asignado para tramitar la solicitud": "DEFENSOR",
    "Defensor(a) Publico(a) Asignado para tramitar la solicitud": "DEFENSOR",
    "Fecha de análisis jurídico del caso": "FECHA_ANALISIS",
    "Fecha de analisis juridico del caso": "FECHA_ANALISIS",
    "Procedencia de libertad condicional": "LIBERTAD_CONDICIONAL",
    "Procedencia de prisión domiciliaria de mitad de pena": "PRISION_DOMICILIARIA_MITAD_PENA",
    "Procedencia de prision domiciliaria de mitad de pena": "PRISION_DOMICILIARIA_MITAD_PENA",
    "Procedencia de pena cumplida": "PROCEDENCIA_PENA_CUMPLIDA",
    "Procedencia de acumulación de penas": "PROCEDENCIA_ACUMULACION_PENAS",
    "Procedencia de acumulacion de penas": "PROCEDENCIA_ACUMULACION_PENAS",
    "Con qué proceso(s) debe acumular penas (si aplica)": "CON_QUE_PROCESOS_ACUMULAR",
    "Con que proceso(s) debe acumular penas (si aplica)": "CON_QUE_PROCESOS_ACUMULAR",
    "Resumen del anális del caso": "RESUMEN_ANALISIS_CASO",
    "Resumen del analis del caso": "RESUMEN_ANALISIS_CASO",
    "Otras solicitudes a tramitar": "OTRAS_SOLICITUDES_TRAMITAR",
    "Fecha entrevista": "FECHA_ENTREVISTA",
    "Decisión del usuario": "DECISION_USUARIO",
    "Decision del usuario": "DECISION_USUARIO",
    "Poder en caso de avanzar con la solicitud": "PODER_AVANZAR_SOLICITUD",
    "Requiere pruebas": "REQUIERE_PRUEBAS",
    "Fecha de recepción de pruebas aportadas por el usuario": "FECHA_RECEPCION_PRUEBAS_USUARIO",
    "Fecha de recepcion de pruebas aportadas por el usuario": "FECHA_RECEPCION_PRUEBAS_USUARIO",
    "Fecha de solicitud de documentos al INPEC": "FECHA_SOLICITUD_DOCS_INPEC",
    "Fecha de recepción de documentos del INPEC": "FECHA_RECEPCION_TODAS_PRUEBAS",
    "Fecha de recepcion de documentos del INPEC": "FECHA_RECEPCION_TODAS_PRUEBAS",
    "Fecha de presentación de solicitud a la autoridad judicial": "FECHA_PRESENTACION_SOLICITUD",
    "Fecha de presentacion de solicitud a la autoridad judicial": "FECHA_PRESENTACION_SOLICITUD",
    "Fecha de decisión de la autoridad judicial": "FECHA_DECISION_AUTORIDAD",
    "Fecha de decision de la autoridad judicial": "FECHA_DECISION_AUTORIDAD",
    "Sentido de la decisión": "SENTIDO_DECISION",
    "Sentido de la decision": "SENTIDO_DECISION",
    "Motivo de la decisión negativa (Libertad condicional si aplica)": "MOTIVO_DECISION_NEGATIVA_LC",
    "Motivo de la decision negativa (Libertad condicional si aplica)": "MOTIVO_DECISION_NEGATIVA_LC",
    "Motivo de la decisión negativa (Prisión domiciliaria si aplica)": "MOTIVO_DECISION_NEGATIVA_PD",
    "Motivo de la decision negativa (Prision domiciliaria si aplica)": "MOTIVO_DECISION_NEGATIVA_PD",
    "Fecha de recurso en caso desfavorable": "FECHA_RECURSO_DESFAVORABLE",
    "Sentido de la decisión que resuelve recurso": "SENTIDO_DECISION_RECURSO",
    "Sentido de la decision que resuelve recurso": "SENTIDO_DECISION_RECURSO",
    "Tipo de solicitud a tramitar": "TIPO_SOLICITUD",
    "Creado": "FECHA_REGISTRO",
}

SISIPEC_COLUMNS = [
    "NUMERO", "NOMBRE", "GENERO", "FECHA_NACIMIENTO", "EDAD", "ENFOQUE",
    "ESTABLECIMIENTO", "DEPARTAMENTO", "MUNICIPIO", "FASE", "AUTORIDAD",
    "PROCESO", "FECHA_CAPTURA", "DELITOS", "SITUACION", "PENA", "PENA_DIAS",
    "REDENCION", "PRIVACION", "TIEMPO_EFECTIVO", "PORCENTAJE", "CALIFICACION",
    "FECHA_CALIFICACION", "REQUERIMIENTOS", "CATEGORIZACION", "FUENTE",
    "FECHA_CORTE",
]

SISIPEC_DATE_COLUMNS = {"FECHA_NACIMIENTO", "FECHA_CALIFICACION", "FECHA_CAPTURA", "FECHA_CORTE"}
SISIPEC_NUMBER_COLUMNS = {
    "EDAD", "PENA", "PENA_DIAS", "REDENCION", "PRIVACION",
    "TIEMPO_EFECTIVO", "PORCENTAJE",
}

PONAL_COLUMNS = [
    "UNIDAD", "ESTACION_CDT", "DEPARTAMENTO", "MUNICIPIO",
    "DIRECCION_CDT", "NOMBRES", "APELLIDOS", "TIPO_IDENTIFICACION",
    "NUMERO_DOCUMENTO", "NACIONALIDAD", "SITUACION_JURIDICA",
    "FECHA_CAPTURA_RAW", "RADICADO", "DELITOS_IMPUTADOS",
    "AUTORIDAD_JUDICIAL", "FECHA_CORTE",
]

PONAL_EXPECTED_HEADERS = [
    "UNIDAD",
    "ESTACIÓN DE POLICÍA Y/O CDT",
    "DEPARTAMENTO",
    "MUNICIPIO ",
    "DIRECCIÓN DEL CDT",
    "NOMBRES",
    "APELLIDOS",
    "TIPO DE IDENTIFICACIÓN",
    "N° DOCUMENTO DE IDENTIFICACIÓN",
    "NACIONALIDAD",
    "SITUACIÓN JURÍDICA",
    "FECHA DE CAPTURA O INGRESO AL CDT",
    "RADICADO DEL PROCESO (CÓDIGO DE 23 DÍGITOS)",
    "DELITOS IMPUTADOS",
    "AUTORIDAD JUDICIAL A CARGO DEL PROCESO",
    "FECHA_CORTE",
]


def aurora_ddl():
    return f"""
CREATE TABLE {qualified_name("AURORA_10")} (
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
    CALIFICACION_CONDUCTA               NVARCHAR2(255),
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


def sisipec_ddl():
    return f"""
CREATE TABLE {qualified_name("SISIPEC")} (
    NUMERO              NVARCHAR2(50),
    NOMBRE              NVARCHAR2(400),
    GENERO              NVARCHAR2(50),
    FECHA_NACIMIENTO    DATE,
    EDAD                NUMBER,
    ENFOQUE             NVARCHAR2(2000),
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
    CALIFICACION        NVARCHAR2(255),
    FECHA_CALIFICACION  DATE,
    REQUERIMIENTOS      NVARCHAR2(255),
    CATEGORIZACION      NVARCHAR2(255),
    FUENTE              NVARCHAR2(255),
    FECHA_CORTE         DATE
)
"""


def ponal_ddl():
    return f"""
CREATE TABLE {qualified_name("PONAL")} (
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


@dataclass(frozen=True)
class SourceConfig:
    key: str
    label: str
    table: str
    procedure: str
    columns: list
    date_columns: set
    number_columns: set
    ddl_factory: object
    sheet_name: object = None
    table_mode: str = "truncate"

    @property
    def qualified_table(self):
        return qualified_name(self.table)


SOURCES = {
    "aurora_10": SourceConfig(
        key="aurora_10",
        label="Aurora 1.0",
        table="AURORA_10",
        procedure=f"{DEFAULT_SCHEMA}.PRC_CARGA_AURORA10",
        columns=AURORA_COLUMNS,
        date_columns=AURORA_DATE_COLUMNS,
        number_columns=AURORA_NUMBER_COLUMNS,
        ddl_factory=aurora_ddl,
        table_mode="truncate",
    ),
    "sisipec": SourceConfig(
        key="sisipec",
        label="SISIPEC",
        table="SISIPEC",
        procedure=env_first("CARGUEBD_SISIPEC_PROCEDURE", default=qualified_name("PRC_CARGA_SISIPEC")),
        columns=SISIPEC_COLUMNS,
        date_columns=SISIPEC_DATE_COLUMNS,
        number_columns=SISIPEC_NUMBER_COLUMNS,
        ddl_factory=sisipec_ddl,
        table_mode="drop_create",
    ),
    "ponal": SourceConfig(
        key="ponal",
        label="PONAL",
        table="PONAL",
        procedure=f"{DEFAULT_SCHEMA}.PRC_CARGA_PONAL",
        columns=PONAL_COLUMNS,
        date_columns={"FECHA_CORTE"},
        number_columns=set(),
        ddl_factory=ponal_ddl,
        sheet_name="CONSOLIDADO",
        table_mode="drop_create",
    ),
}


def is_null(value):
    if value is None:
        return True
    try:
        if isinstance(value, float) and math.isnan(value):
            return True
    except TypeError:
        pass
    return str(value).strip() in ("nan", "NaT", "None", "<NA>", "NaN", "")


def clean_value(value, column, config):
    if is_null(value):
        return None
    if column in config.date_columns:
        try:
            ts = pd.Timestamp(value)
            return None if pd.isna(ts) else ts.to_pydatetime()
        except Exception:
            return None
    if column in config.number_columns:
        try:
            return float(str(value).strip().replace(",", "."))
        except Exception:
            return None
    text = str(value).strip()
    return None if text in ("nan", "NaT", "None", "<NA>", "NaN", "") else text


def prepare_row(row, config):
    return [clean_value(row[column], column, config) for column in config.columns]


def normalize_header(value):
    return str(value or "").strip().upper()


def validate_headers(actual, expected, source_label):
    normalized_actual = [normalize_header(item) for item in actual]
    normalized_expected = [normalize_header(item) for item in expected]
    if normalized_actual[: len(normalized_expected)] != normalized_expected:
        missing = [expected[i] for i, h in enumerate(normalized_expected) if i >= len(normalized_actual) or normalized_actual[i] != h]
        raise ValueError(
            f"El archivo {source_label} no tiene el formato esperado. Revise columnas: {', '.join(missing[:8])}"
        )


def read_aurora(path, config):
    df = pd.read_excel(path, dtype=str)
    if "Creado" in df.columns:
        created_index = df.columns.get_loc("Creado")
        df = df.iloc[:, : created_index + 1].copy()
    df = df.rename(columns=AURORA_MAPPING)
    missing_before_fill = [column for column in config.columns if column not in df.columns]
    for column in missing_before_fill:
        df[column] = None
    if missing_before_fill:
        print(f"  Advertencia: columnas faltantes cargadas como NULL: {', '.join(missing_before_fill)}")

    df = df[df["CEDULA"].notna()].reset_index(drop=True)
    df["FECHA_REGISTRO"] = pd.to_datetime(df["FECHA_REGISTRO"], errors="coerce")
    df = df.sort_values("FECHA_REGISTRO", ascending=False)
    before = len(df)
    df = df.drop_duplicates(subset="CEDULA", keep="first").reset_index(drop=True)
    print(f"  Duplicados por cedula omitidos: {before - len(df):,}")
    df = df.astype(str).replace("NaT", None).replace("nan", None).replace("None", None)
    return df[config.columns]


def read_sisipec(path, config):
    df = pd.read_excel(path, dtype=str)
    df.columns = [str(column).strip().upper() for column in df.columns]
    df = df.dropna(how="all")
    # Incluye encabezados repetidos (ENFOQUE.1), numerados y descriptivos.
    enfoque_indexes = [
        index for index, column in enumerate(df.columns)
        if re.match(r"^ENFOQUES?(?:$|[\W_]|[0-9])", column)
    ]
    if enfoque_indexes:
        enfoques = pd.Series(
            [
                concatenate_enfoques(values)
                for values in df.iloc[:, enfoque_indexes].itertuples(index=False, name=None)
            ],
            index=df.index,
            dtype=object,
        )
        too_long = enfoques.str.len().gt(2000)
        if too_long.any():
            excel_row = int(too_long[too_long].index[0]) + 2
            raise ValueError(f"El enfoque de la fila {excel_row} supera los 2000 caracteres.")
        df = df.drop(columns=[df.columns[index] for index in enfoque_indexes])
        df["ENFOQUE"] = enfoques
        print(f"  Columnas de enfoque combinadas: {len(enfoque_indexes)}")
        print(f"  Filas con enfoque: {int(enfoques.notna().sum()):,}")
    missing = [column for column in config.columns if column not in df.columns]
    for column in missing:
        df[column] = None
    if missing:
        print(f"  Advertencia: columnas faltantes cargadas como NULL: {', '.join(missing)}")
    return df.dropna(how="all").reset_index(drop=True)[config.columns]


def concatenate_enfoques(values):
    parts = []
    seen = set()
    for value in values:
        if is_null(value):
            continue
        text = str(value).strip()
        key = "".join(
            char for char in unicodedata.normalize("NFD", text.casefold())
            if not unicodedata.combining(char)
        )
        key = " ".join(key.split())
        if key not in seen:
            seen.add(key)
            parts.append(text)
    return "; ".join(parts) or None


def read_ponal(path, config):
    df = pd.read_excel(path, sheet_name=config.sheet_name)
    validate_headers(list(df.columns), PONAL_EXPECTED_HEADERS, config.label)
    if len(df.columns) < len(config.columns):
        raise ValueError(f"El archivo {config.label} debe tener {len(config.columns)} columnas.")
    df = df.iloc[:, : len(config.columns)].copy()
    df.columns = config.columns
    return df.dropna(how="all").reset_index(drop=True)[config.columns]


def read_source_dataframe(path, config):
    if config.key == "aurora_10":
        return read_aurora(path, config)
    if config.key == "sisipec":
        return read_sisipec(path, config)
    if config.key == "ponal":
        return read_ponal(path, config)
    raise ValueError(f"Fuente no soportada: {config.key}")


def table_exists(cursor, table, schema=DEFAULT_SCHEMA):
    cursor.execute(
        "SELECT COUNT(*) FROM ALL_TABLES WHERE OWNER=:1 AND TABLE_NAME=:2",
        [str(schema).upper(), str(table).upper()],
    )
    return cursor.fetchone()[0] > 0


def ensure_aurora_conducta_type(cursor, connection, config):
    if config.key != "aurora_10":
        return
    owner, table_name = parse_qualified_object(config.qualified_table)
    cursor.execute(
        """
        SELECT DATA_TYPE, CHAR_LENGTH
          FROM ALL_TAB_COLUMNS
         WHERE OWNER = :1
           AND TABLE_NAME = :2
           AND COLUMN_NAME = 'CALIFICACION_CONDUCTA'
        """,
        [owner, table_name],
    )
    row = cursor.fetchone()
    if row is None:
        raise RuntimeError(
            f"La tabla {config.qualified_table} no contiene la columna CALIFICACION_CONDUCTA."
        )
    data_type, char_length = row
    if str(data_type).upper() == "NVARCHAR2" and int(char_length or 0) >= 255:
        return
    cursor.execute(
        f"ALTER TABLE {config.qualified_table} "
        "MODIFY (CALIFICACION_CONDUCTA NVARCHAR2(255))"
    )
    connection.commit()
    print("  CALIFICACION_CONDUCTA ajustada a NVARCHAR2(255).")


def parse_qualified_object(name):
    parts = [part.strip().upper() for part in str(name or "").split(".") if part.strip()]
    if len(parts) == 1:
        return str(DEFAULT_SCHEMA).strip().upper(), parts[0]
    return parts[-2], parts[-1]


def validate_etl_procedure(cursor, config):
    owner, procedure_name = parse_qualified_object(config.procedure)
    cursor.execute(
        """
        SELECT STATUS
          FROM ALL_OBJECTS
         WHERE OWNER = :1
           AND OBJECT_NAME = :2
           AND OBJECT_TYPE = 'PROCEDURE'
        """,
        [owner, procedure_name],
    )
    row = cursor.fetchone()
    if row is None:
        raise RuntimeError(
            f"El procedimiento Oracle {config.procedure} no existe, no es visible "
            "o falta permiso EXECUTE para el usuario configurado."
        )
    if str(row[0]).upper() != "VALID":
        raise RuntimeError(f"El procedimiento Oracle {config.procedure} existe pero esta en estado {row[0]}.")


def connect_oracle():
    config = oracle_config()
    require_oracle_password(config)
    dsn = oracledb.makedsn(config["host"], config["port"], service_name=config["service"])
    print(f"  Conectando a Oracle: {config['host']}:{config['port']}/{config['service']} como {config['user']}")
    return oracledb.connect(user=config["user"], password=config["password"], dsn=dsn)


def oracle_error_code(exc):
    if not isinstance(exc, oracledb.Error) or not exc.args:
        return None
    error = exc.args[0]
    return getattr(error, "code", None)


def format_oracle_error(exc):
    if not isinstance(exc, oracledb.Error) or not exc.args:
        return str(exc)

    error = exc.args[0]
    code = getattr(error, "code", None)
    full_code = getattr(error, "full_code", None) or (f"ORA-{code:05d}" if code else "")
    message = getattr(error, "message", None) or str(exc)
    message = str(message).strip()

    if re.match(r"^X{20,}(?:\s|$)", message):
        message = (
            "Mensaje Oracle oculto/redactado por la base de datos. "
            "Use el codigo ORA y los diagnosticos siguientes para ubicar la columna."
        )

    context = getattr(error, "context", None)
    if context:
        message = f"{message}\nContexto Oracle: {context}"

    return f"{full_code}: {message}" if full_code and not message.startswith(full_code) else message


def print_ponal_input_diagnostics(cursor, config):
    if config.key != "ponal":
        return

    target = config.qualified_table
    columns = [
        "NUMERO_DOCUMENTO",
        "NOMBRES",
        "APELLIDOS",
        "TIPO_IDENTIFICACION",
        "ESTACION_CDT",
        "DEPARTAMENTO",
        "MUNICIPIO",
        "SITUACION_JURIDICA",
        "FECHA_CAPTURA_RAW",
        "RADICADO",
        "DELITOS_IMPUTADOS",
        "AUTORIDAD_JUDICIAL",
        "FECHA_CORTE",
    ]
    expressions = []
    for column in columns:
        if column == "FECHA_CORTE":
            expressions.append(f"SUM(CASE WHEN {column} IS NULL THEN 1 ELSE 0 END)")
        else:
            expressions.append(f"SUM(CASE WHEN {column} IS NULL OR TRIM({column}) IS NULL THEN 1 ELSE 0 END)")

    cursor.execute(f"SELECT COUNT(*), {', '.join(expressions)} FROM {target}")
    row = cursor.fetchone()
    if not row:
        return

    total = row[0]
    null_counts = dict(zip(columns, row[1:]))
    with_nulls = [(column, count) for column, count in null_counts.items() if count]
    print("  Diagnostico PONAL staging:")
    print(f"    Filas en {target}: {total:,}")
    if with_nulls:
        for column, count in with_nulls:
            print(f"    {column}: {count:,} valores NULL/vacios")
    else:
        print("    Sin NULL/vacios en campos criticos revisados.")


def print_not_null_diagnostics(cursor, schema=DEFAULT_SCHEMA):
    tables = ["PERSONA", "SITUACION_CARCELARIA", "GESTION_JURIDICA", "ASIGNACION"]
    placeholders = ", ".join(f":{index + 2}" for index in range(len(tables)))
    cursor.execute(
        f"""
        SELECT TABLE_NAME, COLUMN_NAME
          FROM ALL_TAB_COLUMNS
         WHERE OWNER = :1
           AND TABLE_NAME IN ({placeholders})
           AND NULLABLE = 'N'
         ORDER BY TABLE_NAME, COLUMN_ID
        """,
        [str(schema).upper(), *tables],
    )
    rows = cursor.fetchall()
    if not rows:
        return

    print("  Columnas NOT NULL candidatas en tablas destino:")
    current_table = None
    current_columns = []
    for table_name, column_name in rows:
        if current_table and table_name != current_table:
            print(f"    {current_table}: {', '.join(current_columns)}")
            current_columns = []
        current_table = table_name
        current_columns.append(column_name)
    if current_table:
        print(f"    {current_table}: {', '.join(current_columns)}")


def prepare_table(cursor, connection, config):
    target = config.qualified_table
    print(f"[3/6] Preparando tabla {target}...")
    exists = table_exists(cursor, config.table)
    if config.table_mode == "truncate" and exists:
        cursor.execute(f"TRUNCATE TABLE {target}")
        connection.commit()
        print("  Tabla truncada.")
        ensure_aurora_conducta_type(cursor, connection, config)
        return

    if exists:
        cursor.execute(f"DROP TABLE {target} PURGE")
        connection.commit()
        print("  Tabla eliminada.")

    cursor.execute(config.ddl_factory())
    connection.commit()
    print("  Tabla creada.")


def insert_rows(connection, cursor, df, config):
    total = len(df)
    target = config.qualified_table
    columns_sql = ", ".join(config.columns)
    placeholders = ", ".join([f":{i + 1}" for i in range(len(config.columns))])

    if config.key == "ponal":
        columns_sql = ", ".join(config.columns[:-1] + ["LUGAR_PRIVACION", "FUENTE", "FECHA_CORTE"])
        placeholders = ", ".join([f":{i + 1}" for i in range(len(config.columns) - 1)] + ["'CDT'", "'PONAL'", f":{len(config.columns)}"])

    sql = f"INSERT INTO {target} ({columns_sql}) VALUES ({placeholders})"
    data = [prepare_row(row, config) for _, row in df.iterrows()]
    inserted = 0
    errors = []
    total_batches = math.ceil(total / BATCH_SIZE) if total else 0

    print(f"[4/6] Insertando {total:,} filas en lotes de {BATCH_SIZE}...")
    for start in range(0, total, BATCH_SIZE):
        batch = data[start: start + BATCH_SIZE]
        batch_number = start // BATCH_SIZE + 1
        try:
            cursor.executemany(sql, batch)
            connection.commit()
            inserted += len(batch)
        except oracledb.Error as batch_error:
            connection.rollback()
            print(f"  Error en lote {batch_number}; reintentando fila a fila: {format_oracle_error(batch_error)}")
            for offset, row in enumerate(batch):
                try:
                    cursor.execute(sql, row)
                    connection.commit()
                    inserted += 1
                except oracledb.Error as row_error:
                    connection.rollback()
                    excel_row = start + offset + 2
                    errors.append({"fila_excel": excel_row, "error": format_oracle_error(row_error)})

        processed = min(start + BATCH_SIZE, total)
        pct = (processed / total * 100) if total else 100
        print(f"  Lote {batch_number:>4}/{total_batches} | {processed:>7,}/{total:,} ({pct:.1f}%) | OK: {inserted:,} | Errores: {len(errors):,}")

    return inserted, errors


def ensure_sisipec_enfoque_capacity(cursor, connection, config):
    if config.key != "sisipec":
        return
    owner, _ = parse_qualified_object(config.qualified_table)
    cursor.execute(
        """
        SELECT DATA_TYPE, CHAR_LENGTH
          FROM ALL_TAB_COLUMNS
         WHERE OWNER = :1
           AND TABLE_NAME = 'SITUACION_CARCELARIA'
           AND COLUMN_NAME = 'ENFOQUE'
        """,
        [owner],
    )
    row = cursor.fetchone()
    if not row or str(row[0]).upper() != "NVARCHAR2":
        raise RuntimeError("SITUACION_CARCELARIA.ENFOQUE debe ser de tipo NVARCHAR2.")
    if int(row[1] or 0) < 2000:
        cursor.execute(
            f"ALTER TABLE {qualified_name('SITUACION_CARCELARIA', owner)} "
            "MODIFY (ENFOQUE NVARCHAR2(2000))"
        )
        connection.commit()
        print("  SITUACION_CARCELARIA.ENFOQUE ampliada a 2000 caracteres.")


def synchronize_sisipec_enfoques(cursor, df, config):
    if config.key != "sisipec":
        return
    # El ETL no copia ENFOQUE. Completar solo las situaciones vigentes de
    # SISIPEC; un archivo sin enfoque no borra correcciones del formulario.
    enfoques = {}
    for numero, enfoque in df[["NUMERO", "ENFOQUE"]].itertuples(index=False, name=None):
        digits = re.sub(r"[^0-9]", "", str(numero)) if not is_null(numero) else ""
        if digits and not is_null(enfoque):
            enfoques[int(digits)] = str(enfoque).strip()
    owner, _ = parse_qualified_object(config.qualified_table)
    sql = f"""
        UPDATE {qualified_name('SITUACION_CARCELARIA', owner)}
           SET ENFOQUE = :1
         WHERE ACTIVO = 1
           AND FUENTE = 'SISIPEC'
           AND ID_PERSONA IN (
               SELECT ID_PERSONA FROM {qualified_name('PERSONA', owner)} WHERE NUMERO = :2
           )
    """
    data = [(enfoque, numero) for numero, enfoque in enfoques.items()]
    updated = 0
    for start in range(0, len(data), BATCH_SIZE):
        cursor.executemany(sql, data[start:start + BATCH_SIZE])
        updated += cursor.rowcount
    print(f"  Situaciones vigentes con enfoque actualizado: {updated:,}")


# Solo estos cambios obligan a revisar otra vez una gestión del equipo bot.
# Pena, privación, redención, tiempo efectivo, porcentaje y conducta (incluida
# su fecha) se actualizan normalmente y no son disparadores de cierre.
SISIPEC_BOT_REVIEW_FIELDS = (
    "FECHA_CAPTURA", "SITUACION", "AUTORIDAD", "PROCESO", "DELITOS",
    "FASE", "REQUERIMIENTOS", "CATEGORIZACION",
)
SISIPEC_BOT_NAME = "EQUIPO PPL DNDP"
SISIPEC_BOT_CLOSURE = "Cierre automático por actualización relevante de SISIPEC."


def normalize_sisipec_review_value(field, value):
    if field == "FASE":
        text = "" if is_null(value) else " ".join(str(value).upper().split())
        return {
            "OBS": "OBSERVACION", "OBSERVACION": "OBSERVACION",
            "ALT": "ALTA", "ALTA": "ALTA", "MED": "MEDIANA", "MEDIANA": "MEDIANA",
            "MIN": "MINIMA", "MINIMA": "MINIMA", "CON": "CONFIANZA", "CONFIANZA": "CONFIANZA",
        }.get(text, "NO REPORTA")
    if is_null(value):
        return None
    if field == "FECHA_CAPTURA":
        date = clean_value(value, field, SOURCES["sisipec"])
        return date.date() if date else None
    text = " ".join(str(value).upper().split())
    if field == "PROCESO":
        return re.sub(r"[^0-9]", "", text) or None
    if field == "REQUERIMIENTOS":
        return {"S": "SI", "N": "NO"}.get(text, text)
    return text


def sisipec_bot_changed_fields(previous, incoming):
    return tuple(
        field for field in SISIPEC_BOT_REVIEW_FIELDS
        if normalize_sisipec_review_value(field, previous.get(field))
        != normalize_sisipec_review_value(field, incoming.get(field))
    )


def capture_sisipec_bot_transitions(cursor, df, config):
    if config.key != "sisipec":
        return []
    incoming = {}
    for row in df.to_dict("records"):
        numero = re.sub(r"[^0-9]", "", str(row.get("NUMERO", "")))
        if numero:
            incoming[int(numero)] = row
    owner, _ = parse_qualified_object(config.qualified_table)
    cursor.execute(f"""
        SELECT p.NUMERO, s.ID_PERSONA, s.ID_SITUACION,
               {', '.join('s.' + field for field in SISIPEC_BOT_REVIEW_FIELDS)},
               a.ID_ASIGNACION,
               (SELECT g.ID_GESTION FROM {qualified_name('GESTION_JURIDICA', owner)} g
                 WHERE g.ID_SITUACION = s.ID_SITUACION
                 ORDER BY g.FECHA_REGISTRO DESC NULLS LAST, g.ID_GESTION DESC
                 FETCH FIRST 1 ROWS ONLY) AS ID_GESTION
          FROM {qualified_name('SITUACION_CARCELARIA', owner)} s
          JOIN {qualified_name('PERSONA', owner)} p ON p.ID_PERSONA = s.ID_PERSONA
          JOIN {qualified_name('ASIGNACION', owner)} a ON a.ID_PERSONA = s.ID_PERSONA
         WHERE s.ACTIVO = 1 AND a.FECHA_FIN IS NULL
           AND UPPER(TRIM(REGEXP_REPLACE(a.NOMBRE_DEFENSOR, '[[:space:]]+', ' '))) = :1
    """, [SISIPEC_BOT_NAME])
    columns = [column[0] for column in cursor.description]
    transitions = []
    for values in cursor.fetchall():
        previous = dict(zip(columns, values))
        row = incoming.get(previous["NUMERO"])
        if row is None:
            continue
        changed = sisipec_bot_changed_fields(previous, row)
        if changed:
            transitions.append({**previous, "CHANGED_FIELDS": changed})
    return transitions


def apply_sisipec_bot_transitions(cursor, transitions, config):
    if config.key != "sisipec" or not transitions:
        return 0
    owner, _ = parse_qualified_object(config.qualified_table)
    persona = qualified_name("PERSONA", owner)
    situacion = qualified_name("SITUACION_CARCELARIA", owner)
    asignacion = qualified_name("ASIGNACION", owner)
    gestion = qualified_name("GESTION_JURIDICA", owner)
    applied = 0
    for transition in transitions:
        # Serializa con PAG. Una asignación nueva durante el ETL no se termina.
        cursor.execute(f"SELECT ID_PERSONA FROM {persona} WHERE ID_PERSONA = :1 FOR UPDATE",
                       [transition["ID_PERSONA"]])
        cursor.fetchone()
        cursor.execute(f"""
            SELECT ID_ASIGNACION FROM {asignacion}
             WHERE ID_PERSONA = :1 AND FECHA_FIN IS NULL
        """, [transition["ID_PERSONA"]])
        assignment = cursor.fetchone()
        if not assignment or assignment[0] != transition["ID_ASIGNACION"]:
            # Incluye los traslados regionales que ya resolvió el procedimiento.
            continue
        cursor.execute(f"SELECT ID_SITUACION FROM {situacion} WHERE ID_PERSONA = :1 AND ACTIVO = 1",
                       [transition["ID_PERSONA"]])
        current = cursor.fetchone()
        if not current:
            raise RuntimeError("El ETL no dejó una situación activa para revisar la gestión del bot.")
        if transition["ID_GESTION"] is not None:
            # El ETL puede trasladar la gestión a otra situación. Su ID y autor
            # identifican el trabajo anterior; no se cierra una gestión nueva.
            cursor.execute(f"""
                UPDATE {gestion} g
                   SET g.CIERRE_CASO = :motivo,
                       g.DEFENSOR_GESTION = NVL(g.DEFENSOR_GESTION, :defensor),
                       g.ID_ASIGNACION_GESTION = NVL(g.ID_ASIGNACION_GESTION, :asignacion)
                 WHERE g.ID_GESTION = :gestion
                   AND g.CIERRE_CASO IS NULL
                   AND (g.DEFENSOR_GESTION IS NULL OR
                        UPPER(TRIM(REGEXP_REPLACE(g.DEFENSOR_GESTION, '[[:space:]]+', ' '))) = :defensor)
                   AND g.ID_SITUACION IN (SELECT ID_SITUACION FROM {situacion} WHERE ID_PERSONA = :persona)
            """, {"motivo": SISIPEC_BOT_CLOSURE, "defensor": SISIPEC_BOT_NAME,
                  "asignacion": assignment[0], "gestion": transition["ID_GESTION"],
                  "persona": transition["ID_PERSONA"]})
        cursor.execute(f"UPDATE {asignacion} SET FECHA_FIN = SYSDATE WHERE ID_ASIGNACION = :1 AND FECHA_FIN IS NULL",
                       [assignment[0]])
        # El ETL conserva la situación vigente. La nueva atención no hereda los
        # hitos del bot y queda disponible para asignarla desde PAG.
        cursor.execute(f"""
            DECLARE
                v_max NUMBER;
                v_id NUMBER;
            BEGIN
                SELECT NVL(MAX(ID_GESTION), 0) INTO v_max FROM {gestion};
                LOOP
                    SELECT {qualified_name('SEQ_GESTION', owner)}.NEXTVAL INTO v_id FROM dual;
                    EXIT WHEN v_id > v_max;
                END LOOP;
                INSERT INTO {gestion} (ID_GESTION, ID_SITUACION, FECHA_REGISTRO)
                VALUES (v_id, :1, SYSTIMESTAMP);
            END;
        """, [current[0]])
        applied += 1
    print(f"  Gestiones del bot disponibles para nueva asignación: {applied:,}")
    return applied


def call_etl(connection, cursor, config, df):
    print(f"[5/6] Ejecutando {config.procedure}...")
    try:
        transitions = capture_sisipec_bot_transitions(cursor, df, config)
        cursor.callproc(config.procedure)
        apply_sisipec_bot_transitions(cursor, transitions, config)
        synchronize_sisipec_enfoques(cursor, df, config)
        connection.commit()
    except oracledb.Error as exc:
        connection.rollback()
        detail = format_oracle_error(exc)
        print(f"  Error Oracle al ejecutar {config.procedure}: {detail}")
        if oracle_error_code(exc) == 1400:
            print("  ORA-01400 indica que el procedimiento intento insertar NULL en una columna obligatoria.")
            print_ponal_input_diagnostics(cursor, config)
            print_not_null_diagnostics(cursor)
        raise RuntimeError(detail) from exc
    except Exception:
        connection.rollback()
        raise
    print("  Procedimiento ejecutado correctamente.")


def run_load(source, file_path, execute_etl=True):
    key = str(source or "").strip().lower()
    if key not in SOURCES:
        raise ValueError(f"Fuente invalida: {source}. Opciones: {', '.join(SOURCES)}")
    config = SOURCES[key]
    path = Path(file_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"No existe el archivo: {path}")

    print("=" * 72)
    print(f"Cargador {config.label} -> Oracle")
    print(f"Archivo : {path}")
    print(f"Destino : {config.qualified_table}")
    print("=" * 72)

    print("[1/6] Leyendo y validando Excel...")
    df = read_source_dataframe(path, config)
    print(f"  Filas leidas: {len(df):,}")
    print(f"  Columnas: {len(df.columns)}")
    if df.empty:
        raise ValueError("El archivo no contiene filas para cargar.")

    print("[2/6] Conectando a Oracle...")
    connection = connect_oracle()
    cursor = connection.cursor()
    inserted = 0
    errors = []
    try:
        if execute_etl:
            validate_etl_procedure(cursor, config)
            ensure_sisipec_enfoque_capacity(cursor, connection, config)
        prepare_table(cursor, connection, config)
        inserted, errors = insert_rows(connection, cursor, df, config)
        if errors:
            print(f"[5/6] Se omite ETL porque la carga tuvo {len(errors):,} errores.")
        elif execute_etl:
            call_etl(connection, cursor, config, df)
        else:
            print("[5/6] ETL omitido por parametro --no-etl.")
    finally:
        cursor.close()
        connection.close()

    print("[6/6] Resumen final")
    print(f"  Fuente: {config.label}")
    print(f"  Tabla destino: {config.qualified_table}")
    print(f"  Filas insertadas: {inserted:,}")
    print(f"  Filas con error: {len(errors):,}")
    print("=" * 72)

    if errors:
        raise RuntimeError(f"Carga completada con {len(errors):,} errores de insercion.")

    return {
        "source": config.key,
        "table": config.qualified_table,
        "rows_read": len(df),
        "rows_inserted": inserted,
        "errors": len(errors),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="Carga archivos Excel de staging AURORA hacia Oracle.")
    parser.add_argument("--fuente", "--source", dest="source", required=True, choices=sorted(SOURCES.keys()))
    parser.add_argument("--archivo", "--file", dest="file_path", required=True, help="Ruta del archivo Excel a cargar.")
    parser.add_argument("--no-etl", action="store_true", help="Carga staging sin ejecutar el procedimiento ETL.")
    args = parser.parse_args(argv)

    try:
        run_load(args.source, args.file_path, execute_etl=not args.no_etl)
        return 0
    except oracledb.Error as exc:
        print(f"ERROR: {format_oracle_error(exc)}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
