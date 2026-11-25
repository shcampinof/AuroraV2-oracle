"""Reabre cierres por cualquier cambio de categoría, sin modificar el ETL Oracle."""
import os
from pathlib import Path
import re
import subprocess
import unicodedata


def category_key(value):
    text = "" if value is None else str(value)
    # NaN del Excel equivale al NULL que se carga en Oracle.
    if text.strip().lower() in ("nan", "nat", "<na>", "none"):
        text = ""
    return " ".join("".join(c for c in unicodedata.normalize("NFD", text)
                            if not unicodedata.combining(c)).upper().split())


def table(owner, name):
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_$#]*", owner):
        raise ValueError("Esquema Oracle inválido")
    return f"{owner}.{name}"


def capture(cursor, df, owner):
    incoming = {}
    for row in df.to_dict("records"):
        numero = re.sub(r"[^0-9]", "", str(row.get("NUMERO", "")))
        if numero:
            value = row.get("CATEGORIZACION")
            incoming[int(numero)] = value if category_key(value) else None
    if not incoming:
        return []
    script = Path(__file__).resolve().parents[2] / "backend/scripts/sisipec-category-review-sql.js"
    result = subprocess.run([os.getenv("CARGUEBD_NODE", "node"), str(script)],
                            capture_output=True, text=True, check=True, timeout=30)
    # El generador comparte las reglas de cierre actuales del backend.
    cursor.execute(result.stdout.replace("DNDP.", table(owner, "")))
    columns = [col[0] for col in cursor.description]
    transitions = []
    for values in cursor.fetchall():
        previous = dict(zip(columns, values))
        numero = previous["NUMERO"]
        if numero in incoming and category_key(previous["CATEGORIZACION"]) != category_key(incoming[numero]):
            transitions.append({**previous, "NUEVA_CATEGORIZACION": incoming[numero]})
    return transitions


def fetch_dict(cursor):
    row = cursor.fetchone()
    return dict(zip((col[0] for col in cursor.description), row)) if row else None


def next_id(cursor, owner, entity):
    id_column = f"ID_{entity}"
    target = "GESTION_JURIDICA" if entity == "GESTION" else entity
    new_id = cursor.var(int)
    cursor.execute(f"""DECLARE
        v_max NUMBER;
    BEGIN
        SELECT NVL(MAX({id_column}), 0) INTO v_max FROM {table(owner, target)};
        LOOP
            SELECT {table(owner, 'SEQ_' + entity)}.NEXTVAL INTO :new_id FROM dual;
            EXIT WHEN :new_id > v_max;
        END LOOP;
    END;""", new_id=new_id)
    return new_id.getvalue()


def empty_review(row):
    identity = {"ID_GESTION", "ID_SITUACION", "FECHA_REGISTRO", "ACCION_REALIZAR",
                "DEFENSOR_GESTION", "ID_ASIGNACION_GESTION", "ID_GESTION_ORIGEN"}
    # Solo se adopta la gestión vacía dejada por el procedimiento; nunca se
    # reemplazan respuestas, responsables o una revisión con otro origen.
    return (not row.get("ID_GESTION_ORIGEN") and not row.get("DEFENSOR_GESTION")
            and not row.get("ID_ASIGNACION_GESTION")
            and category_key(row.get("ACCION_REALIZAR")) in ("", "ANALIZAR EL CASO")
            and all(value is None for key, value in row.items() if key not in identity))


def apply(cursor, transitions, owner):
    persona, situacion, asignacion, gestion = (
        table(owner, name) for name in ("PERSONA", "SITUACION_CARCELARIA", "ASIGNACION", "GESTION_JURIDICA"))
    applied = 0
    for previous in transitions:
        person_id, source_id = previous["ID_PERSONA"], previous["ID_GESTION"]
        cursor.execute(f"SELECT ID_PERSONA FROM {persona} WHERE ID_PERSONA=:1 FOR UPDATE", [person_id])
        cursor.fetchone()
        cursor.execute(f"SELECT ID_SITUACION FROM {situacion} WHERE ID_PERSONA=:1 AND ACTIVO=1 FOR UPDATE",
                       [person_id])
        current = cursor.fetchone()
        if not current:
            continue  # Una persona que salió de prisión no se reactiva.
        current_id = current[0]
        cursor.execute(f"""SELECT ID_ASIGNACION, FECHA_FIN FROM {asignacion} WHERE ID_PERSONA=:1
            ORDER BY FECHA_ASIGNACION DESC NULLS LAST, ID_ASIGNACION DESC FETCH FIRST 1 ROWS ONLY""",
                       [person_id])
        assignment = cursor.fetchone()
        if not assignment or assignment[0] != previous["ID_ASIGNACION"]:
            continue  # Respeta otra asignación posterior de PAG.
        cursor.execute(f"SELECT ID_GESTION FROM {gestion} WHERE ID_GESTION_ORIGEN=:1", [source_id])
        if cursor.fetchone():
            continue  # La revisión por fecha o un reintento ya creó este caso.
        cursor.execute(f"""SELECT * FROM {gestion} WHERE ID_SITUACION=:1
            ORDER BY FECHA_REGISTRO DESC NULLS LAST, ID_GESTION DESC FETCH FIRST 1 ROWS ONLY""", [current_id])
        latest = fetch_dict(cursor)
        if latest and latest["ID_GESTION"] != source_id and not empty_review(latest):
            continue  # No superponer una gestión iniciada durante la carga.

        assignment_id = assignment[0]
        if assignment[1] is not None:
            # Si el procedimiento terminó la asignación, conservar ese
            # histórico y crear otra con la misma identidad del defensor/PAG.
            assignment_id = next_id(cursor, owner, "ASIGNACION")
            cursor.execute(f"""INSERT INTO {asignacion}
                (ID_ASIGNACION, ID_PERSONA, NOMBRE_DEFENSOR, CEDULA_DEFENSOR,
                 NOMBRE_PAG, CEDULA_PAG, FECHA_ASIGNACION)
                VALUES (:id, :persona, :nombre, :cedula, :pag, :pag_cedula, SYSDATE)""",
                           dict(id=assignment_id, persona=person_id, nombre=previous["NOMBRE_DEFENSOR"],
                                cedula=previous["CEDULA_DEFENSOR"], pag=previous["NOMBRE_PAG"],
                                pag_cedula=previous["CEDULA_PAG"]))
        values = dict(situacion=current_id, defensor=previous["NOMBRE_DEFENSOR"],
                      asignacion=assignment_id, origen=source_id)
        if latest and latest["ID_GESTION"] != source_id:
            cursor.execute(f"""UPDATE {gestion} SET DEFENSOR_GESTION=:defensor,
                ID_ASIGNACION_GESTION=:asignacion, ID_GESTION_ORIGEN=:origen,
                ACCION_REALIZAR='Analizar el caso' WHERE ID_GESTION=:id AND ID_SITUACION=:situacion""",
                           {**values, "id": latest["ID_GESTION"]})
        else:
            cursor.execute(f"""INSERT INTO {gestion}
                (ID_GESTION, ID_SITUACION, DEFENSOR_GESTION, ID_ASIGNACION_GESTION,
                 ID_GESTION_ORIGEN, FECHA_REGISTRO, ACCION_REALIZAR)
                VALUES (:id, :situacion, :defensor, :asignacion, :origen, SYSTIMESTAMP, 'Analizar el caso')""",
                           {**values, "id": next_id(cursor, owner, "GESTION")})
        applied += 1
    print(f"  Casos nuevos por cambio de categorización con el mismo defensor: {applied:,}")
    return applied
