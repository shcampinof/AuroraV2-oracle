"""Gestiona traslados confirmados desde el cargador, sin instalar procedimientos."""
import json
import os
from pathlib import Path
import re
import subprocess

import pandas as pd

from sisipec_category_reviews import category_key, empty_review, fetch_dict, next_id, table


def eron_aliases():
    catalog = Path(__file__).resolve().parents[2] / "backend/catalogs/centros-reclusion.v1.json"
    aliases = {}
    for item in json.loads(catalog.read_text(encoding="utf-8"))["items"]:
        for name in [item["label"], *item.get("aliases", [])]:
            aliases[category_key(name)] = item["id"]
    return aliases


def eron_key(value, aliases):
    key = category_key(value)
    return aliases.get(key, key)


def capture(cursor, df, owner):
    incoming = {}
    for row in df.to_dict("records"):
        numero = re.sub(r"[^0-9]", "", str(row.get("NUMERO", "")))
        if numero and category_key(row.get("ESTABLECIMIENTO")):
            incoming[int(numero)] = row
    if not incoming:
        return []
    aliases = eron_aliases()
    cursor.execute(f"""SELECT ESTABLECIMIENTO, TO_CHAR(REGIONAL) FROM {table(owner, 'CAT_ERON_REGIONAL')}
        WHERE NVL(ACTIVO, 1)=1 AND REGIONAL IS NOT NULL""")
    regions = {}
    for establishment, regional in cursor.fetchall():
        regions.setdefault(eron_key(establishment, aliases), set()).add(category_key(regional))
    script = Path(__file__).resolve().parents[2] / "backend/scripts/sisipec-regional-review-sql.js"
    sql = subprocess.run([os.getenv("CARGUEBD_NODE", "node"), str(script)],
                         capture_output=True, text=True, check=True, timeout=30).stdout
    cursor.execute(sql.replace("DNDP.", table(owner, "")))
    columns = [col[0] for col in cursor.description]
    transitions = []
    for values in cursor.fetchall():
        previous = dict(zip(columns, values))
        row = incoming.get(previous["NUMERO"])
        if row is None:
            continue
        origin = regions.get(eron_key(previous["ESTABLECIMIENTO"], aliases), set())
        destination = regions.get(eron_key(row["ESTABLECIMIENTO"], aliases), set())
        # No inferir traslados con regionales desconocidas o ambiguas.
        if len(origin) != 1 or len(destination) != 1 or origin == destination:
            continue
        cutoff = pd.to_datetime(row.get("FECHA_CORTE"), errors="coerce")
        assigned = pd.to_datetime(previous.get("FECHA_ASIGNACION"), errors="coerce")
        if pd.notna(cutoff) and pd.notna(assigned) and assigned >= cutoff:
            continue  # Respeta una asignación efectuada después del traslado.
        transitions.append({**previous, "ESTABLECIMIENTO_NUEVO": row["ESTABLECIMIENTO"]})
    return transitions


def apply(cursor, transitions, owner):
    persona, situacion, asignacion, gestion = (
        table(owner, name) for name in ("PERSONA", "SITUACION_CARCELARIA", "ASIGNACION", "GESTION_JURIDICA"))
    aliases = eron_aliases()
    applied = 0
    for previous in transitions:
        person_id, source_id = previous["ID_PERSONA"], previous["ID_GESTION"]
        cursor.execute(f"SELECT ID_PERSONA FROM {persona} WHERE ID_PERSONA=:1 FOR UPDATE", [person_id])
        cursor.fetchone()
        cursor.execute(f"SELECT ID_SITUACION, ESTABLECIMIENTO FROM {situacion} WHERE ID_PERSONA=:1 AND ACTIVO=1 FOR UPDATE", [person_id])
        current = cursor.fetchone()
        if not current or eron_key(current[1], aliases) != eron_key(previous["ESTABLECIMIENTO_NUEVO"], aliases):
            continue  # Solo se actúa si el ETL confirmó el establecimiento nuevo.
        cursor.execute(f"SELECT ID_ASIGNACION FROM {asignacion} WHERE ID_PERSONA=:1 AND FECHA_FIN IS NULL FOR UPDATE", [person_id])
        assignments = cursor.fetchall()
        if any(row[0] != previous["ID_ASIGNACION"] for row in assignments):
            continue  # Una asignación posterior de PAG tiene prioridad.
        cursor.execute(f"""SELECT * FROM {gestion} WHERE ID_SITUACION=:1
            ORDER BY FECHA_REGISTRO DESC NULLS LAST, ID_GESTION DESC FETCH FIRST 1 ROWS ONLY""", [current[0]])
        latest = fetch_dict(cursor)
        if latest and latest["ID_GESTION"] != source_id and not empty_review(latest):
            continue  # No reemplazar una revisión previa ni trabajo concurrente.
        if previous["ID_ASIGNACION"] is not None:
            cursor.execute(f"UPDATE {asignacion} SET FECHA_FIN=SYSDATE WHERE ID_ASIGNACION=:1 AND FECHA_FIN IS NULL", [previous["ID_ASIGNACION"]])
        if source_id is not None and previous["ESTADO_CODIGO"] != "CASO_CERRADO":
            cursor.execute(f"""UPDATE {gestion} SET CIERRE_CASO='Cierre automático por cambio de regional.'
                WHERE ID_GESTION=:1 AND CIERRE_CASO IS NULL""", [source_id])
        # Se adopta una gestión ya vacía del ETL; las respuestas históricas no se copian.
        if latest and latest["ID_GESTION"] != source_id:
            cursor.execute(f"UPDATE {gestion} SET ID_GESTION_ORIGEN=:1, ACCION_REALIZAR='Analizar el caso' WHERE ID_GESTION=:2",
                           [source_id, latest["ID_GESTION"]])
        else:
            cursor.execute(f"""INSERT INTO {gestion}
                (ID_GESTION, ID_SITUACION, ID_GESTION_ORIGEN, FECHA_REGISTRO, ACCION_REALIZAR)
                VALUES (:id, :situacion, :origen, SYSTIMESTAMP, 'Analizar el caso')""",
                           dict(id=next_id(cursor, owner, "GESTION"), situacion=current[0], origen=source_id))
        applied += 1
    print(f"  Gestiones nuevas sin asignación por cambio de regional: {applied:,}")
    return applied
