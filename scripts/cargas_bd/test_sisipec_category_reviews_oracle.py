"""Casos sintéticos con rollback. No ejecuta ni modifica procedimientos Oracle."""
import hashlib
import os
import secrets
import unittest

import pandas as pd

import loader_service as loader
import sisipec_category_reviews as reviews


class ScopedCursor:
    def __init__(self, cursor, person_id):
        self.cursor, self.person_id = cursor, person_id

    def __getattr__(self, name):
        return getattr(self.cursor, name)

    def execute(self, sql, *args, **kwargs):
        if sql.startswith("SELECT p.NUMERO"):
            return self.cursor.execute(sql + " AND p.ID_PERSONA=:fixture_person", fixture_person=self.person_id)
        return self.cursor.execute(sql, *args, **kwargs)


@unittest.skipUnless(os.getenv("RUN_ORACLE_INTEGRATION", "").lower() == "true",
                     "Requiere RUN_ORACLE_INTEGRATION=true y conexión Oracle")
class CategoryReviewOracleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.connection = loader.connect_oracle()
        cls.cursor = cls.connection.cursor()
        cls.owner, _ = loader.parse_qualified_object(loader.SOURCES["sisipec"].qualified_table)
        cls.procedure_hash = cls.source_hash()

    @classmethod
    def source_hash(cls):
        cls.cursor.execute("""SELECT TEXT FROM ALL_SOURCE WHERE OWNER=:1
            AND NAME='PRC_CARGA_SISIPEC' AND TYPE='PROCEDURE' ORDER BY LINE""", [cls.owner])
        return hashlib.sha256("".join(row[0] or "" for row in cls.cursor.fetchall()).encode()).hexdigest()

    @classmethod
    def tearDownClass(cls):
        try:
            cls.connection.rollback()
            if cls.source_hash() != cls.procedure_hash:
                raise AssertionError("La prueba no debe cambiar el procedimiento Oracle")
        finally:
            cls.cursor.close()
            cls.connection.close()

    def setUp(self):
        self.people = []

    def tearDown(self):
        self.connection.rollback()
        for person in self.people:
            self.cursor.execute(f"SELECT COUNT(*) FROM {reviews.table(self.owner, 'PERSONA')} WHERE ID_PERSONA=:1", [person])
            self.assertEqual(self.cursor.fetchone()[0], 0, "Debe revertirse toda persona sintética")

    def fixture(self, category="Prisión Domiciliaria", closed=True, bot=False, derived=False):
        identifier = -secrets.randbelow(1_000_000_000) - 1
        numero = 9_000_000_000_000 + abs(identifier)
        self.people.append(identifier)
        self.cursor.execute(f"INSERT INTO {reviews.table(self.owner, 'PERSONA')} (ID_PERSONA, NUMERO, NOMBRE) VALUES (:1, :2, 'PRUEBA CATEGORIA ROLLBACK')",
                            [identifier, numero])
        self.cursor.execute(f"""INSERT INTO {reviews.table(self.owner, 'SITUACION_CARCELARIA')}
            (ID_SITUACION, ID_PERSONA, SITUACION, ACTIVO, CATEGORIZACION, FUENTE)
            VALUES (:id, :id, 'CONDENADO', 1, :categoria, 'PRUEBA_CATEGORIA')""", dict(id=identifier, categoria=category))
        defender = loader.SISIPEC_BOT_NAME if bot else "DEFENSORA CATEGORIA PRUEBA"
        cedula = str(numero)
        self.cursor.execute(f"""INSERT INTO {reviews.table(self.owner, 'PAG')}
            (CEDULA_PAG, NOMBRE_PAG) VALUES (:1, 'PAG CATEGORIA PRUEBA')""", [cedula])
        self.cursor.execute(f"""INSERT INTO {reviews.table(self.owner, 'DEFENSORES')}
            (CEDULA, NOMBRE, CEDULA_PAG) VALUES (:1, :2, :3)""", [cedula, defender, cedula])
        self.cursor.execute(f"""INSERT INTO {reviews.table(self.owner, 'ASIGNACION')}
            (ID_ASIGNACION, ID_PERSONA, NOMBRE_DEFENSOR, CEDULA_DEFENSOR, NOMBRE_PAG, CEDULA_PAG, FECHA_ASIGNACION)
            VALUES (:id, :id, :defensor, :cedula, 'PAG CATEGORIA PRUEBA', :cedula, DATE '2026-01-01')""",
                            dict(id=identifier, defensor=defender, cedula=cedula))
        self.cursor.execute(f"""INSERT INTO {reviews.table(self.owner, 'GESTION_JURIDICA')}
            (ID_GESTION, ID_SITUACION, DEFENSOR_GESTION, ID_ASIGNACION_GESTION, FECHA_ANALISIS,
             RESUMEN_ANALISIS_CASO, CIERRE_CASO, FECHA_REGISTRO,
             LIBERTAD_CONDICIONAL, PRISION_DOMICILIARIA_MITAD_PENA, PROCEDENCIA_PENA_CUMPLIDA,
             PROCEDENCIA_ACUMULACION_PENAS, OTRAS_SOLICITUDES_TRAMITAR)
            VALUES (:id, :id, :defensor, :id, DATE '2026-01-01', 'ANALISIS HISTORICO', :cierre,
              TIMESTAMP '2026-01-01 00:00:00', :negativa, :negativa, :negativa, :negativa, :ninguna)""",
                            dict(id=identifier, defensor=defender, cierre="Otro motivo." if closed and not derived else None,
                                 negativa="No" if derived else None, ninguna="Ninguna" if derived else None))
        return dict(ID_PERSONA=identifier, NUMERO=numero, ID_GESTION=identifier,
                    ID_SITUACION=identifier, ID_ASIGNACION=identifier, NOMBRE_DEFENSOR=defender)

    def capture(self, fixture, category):
        return reviews.capture(ScopedCursor(self.cursor, fixture["ID_PERSONA"]),
                               pd.DataFrame([{"NUMERO": str(fixture["NUMERO"]), "CATEGORIZACION": category}]), self.owner)

    def gestion(self, identifier):
        self.cursor.execute(f"SELECT * FROM {reviews.table(self.owner, 'GESTION_JURIDICA')} WHERE ID_GESTION=:1", [identifier])
        return reviews.fetch_dict(self.cursor)

    def assert_review(self, fixture, expected_assignment=None):
        self.cursor.execute(f"SELECT * FROM {reviews.table(self.owner, 'GESTION_JURIDICA')} WHERE ID_GESTION_ORIGEN=:1", [fixture["ID_GESTION"]])
        fresh = reviews.fetch_dict(self.cursor)
        self.assertIsNotNone(fresh)
        self.assertEqual(fresh["DEFENSOR_GESTION"], fixture["NOMBRE_DEFENSOR"])
        if expected_assignment is not None:
            self.assertEqual(fresh["ID_ASIGNACION_GESTION"], expected_assignment)
        self.assertEqual(fresh["ACCION_REALIZAR"], "Analizar el caso")
        identities = {"ID_GESTION", "ID_SITUACION", "FECHA_REGISTRO", "ACCION_REALIZAR",
                      "DEFENSOR_GESTION", "ID_ASIGNACION_GESTION", "ID_GESTION_ORIGEN"}
        for column, value in fresh.items():
            if column not in identities:
                self.assertIsNone(value, f"La gestión nueva no hereda {column}")
        return fresh

    def test_any_change_reopens_once_preserving_assignment_and_closed_history(self):
        for category in ("Libertad condicional", "Preliminar libertad condicional", "Utilidad Pública",
                         "No reúne requisitos", "Otro texto", None):
            with self.subTest(category=category):
                fixture = self.fixture()
                before = self.gestion(fixture["ID_GESTION"])
                transitions = self.capture(fixture, category)
                self.assertEqual(len(transitions), 1)
                self.cursor.execute(f"UPDATE {reviews.table(self.owner, 'SITUACION_CARCELARIA')} SET CATEGORIZACION=:1 WHERE ID_SITUACION=:2",
                                    [category, fixture["ID_SITUACION"]])
                self.assertEqual(reviews.apply(self.cursor, transitions, self.owner), 1)
                self.assertEqual(reviews.apply(self.cursor, transitions, self.owner), 0)
                self.assert_review(fixture, fixture["ID_ASIGNACION"])
                self.assertEqual(self.gestion(fixture["ID_GESTION"]), before)
                self.assertEqual(self.capture(fixture, category), [], "Repetir el corte no reabre otra vez")

    def test_derived_closure_and_bot_also_reopen_to_current_defender(self):
        for options in ({"derived": True}, {"bot": True}, {"category": None}):
            with self.subTest(options=options):
                fixture = self.fixture(**options)
                transitions = self.capture(fixture, "Libertad condicional")
                self.assertEqual(len(transitions), 1)
                self.assertEqual(reviews.apply(self.cursor, transitions, self.owner), 1)
                self.assert_review(fixture, fixture["ID_ASIGNACION"])

    def test_open_unchanged_and_only_historical_closures_do_not_reopen(self):
        fixture = self.fixture(closed=False)
        self.assertEqual(self.capture(fixture, "Libertad condicional"), [])
        fixture = self.fixture()
        self.assertEqual(self.capture(fixture, " prision   domiciliaria "), [])
        self.cursor.execute(f"""INSERT INTO {reviews.table(self.owner, 'GESTION_JURIDICA')}
            (ID_GESTION, ID_SITUACION, DEFENSOR_GESTION, FECHA_REGISTRO)
            VALUES (:1, :2, :3, SYSTIMESTAMP)""", [fixture["ID_GESTION"] - 1, fixture["ID_SITUACION"], fixture["NOMBRE_DEFENSOR"]])
        self.assertEqual(self.capture(fixture, "Libertad condicional"), [])

    def test_etl_closed_assignment_and_empty_case_are_reconciled(self):
        fixture = self.fixture()
        before = self.gestion(fixture["ID_GESTION"])
        transitions = self.capture(fixture, "Libertad condicional")
        self.cursor.execute(f"UPDATE {reviews.table(self.owner, 'ASIGNACION')} SET FECHA_FIN=SYSDATE WHERE ID_ASIGNACION=:1", [fixture["ID_ASIGNACION"]])
        self.cursor.execute(f"UPDATE {reviews.table(self.owner, 'SITUACION_CARCELARIA')} SET ACTIVO=0 WHERE ID_SITUACION=:1", [fixture["ID_SITUACION"]])
        current_id = fixture["ID_SITUACION"] - 1
        self.cursor.execute(f"""INSERT INTO {reviews.table(self.owner, 'SITUACION_CARCELARIA')}
            (ID_SITUACION, ID_PERSONA, SITUACION, ACTIVO, CATEGORIZACION)
            VALUES (:1, :2, 'CONDENADO', 1, 'Libertad condicional')""", [current_id, fixture["ID_PERSONA"]])
        self.cursor.execute(f"""INSERT INTO {reviews.table(self.owner, 'GESTION_JURIDICA')}
            (ID_GESTION, ID_SITUACION, FECHA_REGISTRO) VALUES (:1, :2, SYSTIMESTAMP)""", [current_id, current_id])
        self.assertEqual(reviews.apply(self.cursor, transitions, self.owner), 1)
        fresh = self.assert_review(fixture)
        self.assertEqual(fresh["ID_GESTION"], current_id, "Adopta el caso vacío creado por el ETL")
        self.assertEqual(fresh["ID_SITUACION"], current_id)
        self.assertEqual(self.gestion(fixture["ID_GESTION"]), before)
        self.cursor.execute(f"""SELECT NOMBRE_DEFENSOR, CEDULA_DEFENSOR, NOMBRE_PAG, CEDULA_PAG FROM {reviews.table(self.owner, 'ASIGNACION')}
            WHERE ID_PERSONA=:1 AND FECHA_FIN IS NULL""", [fixture["ID_PERSONA"]])
        self.assertEqual(self.cursor.fetchone(), (fixture["NOMBRE_DEFENSOR"], fixture["NUMERO"], "PAG CATEGORIA PRUEBA", fixture["NUMERO"]))
        self.assertEqual(reviews.apply(self.cursor, transitions, self.owner), 0)

    def test_an_intervening_assignment_or_work_is_preserved(self):
        for intervention in ("assignment", "work", "inactive", "date_review"):
            with self.subTest(intervention=intervention):
                fixture = self.fixture()
                transitions = self.capture(fixture, "Libertad condicional")
                if intervention == "assignment":
                    self.cursor.execute(f"UPDATE {reviews.table(self.owner, 'ASIGNACION')} SET FECHA_FIN=SYSDATE WHERE ID_ASIGNACION=:1", [fixture["ID_ASIGNACION"]])
                    self.cursor.execute(f"""INSERT INTO {reviews.table(self.owner, 'ASIGNACION')}
                        (ID_ASIGNACION, ID_PERSONA, NOMBRE_DEFENSOR, FECHA_ASIGNACION)
                        VALUES (:1, :2, 'OTRO DEFENSOR', SYSDATE)""", [fixture["ID_ASIGNACION"] - 1, fixture["ID_PERSONA"]])
                elif intervention == "inactive":
                    self.cursor.execute(f"UPDATE {reviews.table(self.owner, 'SITUACION_CARCELARIA')} SET ACTIVO=0 WHERE ID_SITUACION=:1", [fixture["ID_SITUACION"]])
                else:
                    self.cursor.execute(f"""INSERT INTO {reviews.table(self.owner, 'GESTION_JURIDICA')}
                        (ID_GESTION, ID_SITUACION, DEFENSOR_GESTION, ID_GESTION_ORIGEN, FECHA_REGISTRO)
                        VALUES (:1, :2, :3, :4, SYSTIMESTAMP)""",
                                        [fixture["ID_GESTION"] - 1, fixture["ID_SITUACION"], fixture["NOMBRE_DEFENSOR"],
                                         fixture["ID_GESTION"] if intervention == "date_review" else None])
                self.assertEqual(reviews.apply(self.cursor, transitions, self.owner), 0)


if __name__ == "__main__":
    unittest.main()
