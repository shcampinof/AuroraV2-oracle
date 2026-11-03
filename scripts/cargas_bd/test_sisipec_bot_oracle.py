"""SQL real con datos sintéticos y rollback; nunca ejecuta el ETL mensual."""
import hashlib
import os
import secrets
import unittest

import pandas as pd

import loader_service as loader
from test_sisipec_bot import ALLOWED_CHANGES, IGNORED_CHANGES, previous_case


@unittest.skipUnless(os.getenv("RUN_ORACLE_INTEGRATION", "").lower() == "true",
                     "Requiere RUN_ORACLE_INTEGRATION=true y conexión Oracle")
class BotReviewOracleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.connection = loader.connect_oracle()
        cls.cursor = cls.connection.cursor()
        cls.config = loader.SOURCES["sisipec"]
        cls.owner, cls.procedure = loader.parse_qualified_object(cls.config.procedure)
        cls.procedure_hash = cls.source_hash()

    @classmethod
    def source_hash(cls):
        cls.cursor.execute("""
            SELECT TEXT FROM ALL_SOURCE
             WHERE OWNER = :1 AND NAME = :2 AND TYPE = 'PROCEDURE' ORDER BY LINE
        """, [cls.owner, cls.procedure])
        source = "".join(row[0] or "" for row in cls.cursor.fetchall())
        if not source:
            raise AssertionError("El procedimiento debe ser visible para verificar que no cambió")
        return hashlib.sha256(source.encode()).hexdigest()

    @classmethod
    def tearDownClass(cls):
        try:
            cls.connection.rollback()
            if cls.source_hash() != cls.procedure_hash:
                raise AssertionError("El procedimiento Oracle cambió durante la prueba")
        finally:
            cls.cursor.close()
            cls.connection.close()

    def setUp(self):
        self.people = []

    def tearDown(self):
        self.connection.rollback()
        for person in self.people:
            for table in ("ASIGNACION", "SITUACION_CARCELARIA", "PERSONA"):
                self.cursor.execute(f"SELECT COUNT(*) FROM {loader.qualified_name(table)} WHERE ID_PERSONA = :1",
                                    [person])
                self.assertEqual(self.cursor.fetchone()[0], 0, f"Rollback de {table}")

    def fixture(self):
        row = previous_case()
        fixture_id = -secrets.randbelow(1_000_000_000) - 1
        row.update(NUMERO=9_000_000_000_000 + abs(fixture_id), ID_PERSONA=fixture_id,
                   ID_SITUACION=fixture_id, ID_ASIGNACION=fixture_id, ID_GESTION=fixture_id)
        self.people.append(fixture_id)
        self.cursor.execute(f"""
            INSERT INTO {loader.qualified_name('PERSONA')} (ID_PERSONA, NUMERO, NOMBRE)
            VALUES (:1, :2, 'PRUEBA BOT SCRIPT ROLLBACK')
        """, [fixture_id, row["NUMERO"]])
        fields = ["ID_SITUACION", "ID_PERSONA", *loader.SISIPEC_BOT_REVIEW_FIELDS]
        self.cursor.execute(f"""
            INSERT INTO {loader.qualified_name('SITUACION_CARCELARIA')}
                ({', '.join(fields)}, ACTIVO, FUENTE)
            VALUES ({', '.join(':' + str(i + 1) for i in range(len(fields)))}, 1, 'PRUEBA_BOT_SCRIPT')
        """, [row[field] for field in fields])
        self.cursor.execute(f"""
            INSERT INTO {loader.qualified_name('ASIGNACION')}
                (ID_ASIGNACION, ID_PERSONA, NOMBRE_DEFENSOR, FECHA_ASIGNACION)
            VALUES (:1, :2, :3, SYSDATE)
        """, [fixture_id, fixture_id, loader.SISIPEC_BOT_NAME])
        self.cursor.execute(f"""
            INSERT INTO {loader.qualified_name('GESTION_JURIDICA')}
                (ID_GESTION, ID_SITUACION, DEFENSOR_GESTION, ID_ASIGNACION_GESTION, FECHA_ANALISIS, FECHA_REGISTRO)
            VALUES (:1, :2, :3, :4, TIMESTAMP '2026-10-01 00:00:00', SYSTIMESTAMP)
        """, [fixture_id, fixture_id, loader.SISIPEC_BOT_NAME, fixture_id])
        return row

    def capture(self, row):
        return loader.capture_sisipec_bot_transitions(self.cursor, pd.DataFrame([row]), self.config)

    def test_excluded_fields_keep_assignment_and_gestion(self):
        row = self.fixture()
        for field, value in IGNORED_CHANGES.items():
            with self.subTest(field=field):
                transitions = self.capture({**row, field: value})
                self.assertEqual(transitions, [])
                self.assertEqual(loader.apply_sisipec_bot_transitions(self.cursor, transitions, self.config), 0)
        self.assertEqual(self.capture({**row, **IGNORED_CHANGES}), [])
        self.cursor.execute(f"SELECT FECHA_FIN FROM {loader.qualified_name('ASIGNACION')} WHERE ID_ASIGNACION=:1",
                            [row["ID_ASIGNACION"]])
        self.assertIsNone(self.cursor.fetchone()[0])
        self.cursor.execute(f"SELECT CIERRE_CASO FROM {loader.qualified_name('GESTION_JURIDICA')} WHERE ID_GESTION=:1",
                            [row["ID_GESTION"]])
        self.assertIsNone(self.cursor.fetchone()[0])

    def test_historical_bot_author_does_not_close_a_human_assignment(self):
        row = self.fixture()
        self.cursor.execute(f"""
            UPDATE {loader.qualified_name('ASIGNACION')}
               SET NOMBRE_DEFENSOR='DEFENSOR ACTUAL PRUEBA' WHERE ID_ASIGNACION=:1
        """, [row["ID_ASIGNACION"]])
        self.assertEqual(self.capture({**row, "FASE": "MEDIANA"}), [])
        self.cursor.execute(f"""
            SELECT COUNT(*) FROM {loader.qualified_name('ASIGNACION')}
             WHERE ID_ASIGNACION=:1 AND FECHA_FIN IS NULL
        """, [row["ID_ASIGNACION"]])
        self.assertEqual(self.cursor.fetchone()[0], 1)

    def test_each_remaining_field_closes_bot_and_creates_empty_gestion_once(self):
        for field, value in ALLOWED_CHANGES.items():
            with self.subTest(field=field):
                row = self.fixture()
                transitions = self.capture({**row, field: value, **IGNORED_CHANGES})
                self.assertEqual(len(transitions), 1)
                self.assertEqual(loader.apply_sisipec_bot_transitions(self.cursor, transitions, self.config), 1)
                self.assertEqual(loader.apply_sisipec_bot_transitions(self.cursor, transitions, self.config), 0)
                self.cursor.execute(f"""
                    SELECT CIERRE_CASO, DEFENSOR_GESTION, ID_ASIGNACION_GESTION
                      FROM {loader.qualified_name('GESTION_JURIDICA')} WHERE ID_GESTION=:1
                """, [row["ID_GESTION"]])
                self.assertEqual(self.cursor.fetchone(),
                                 (loader.SISIPEC_BOT_CLOSURE, loader.SISIPEC_BOT_NAME, row["ID_ASIGNACION"]))
                self.cursor.execute(f"""
                    SELECT COUNT(*), COUNT(DEFENSOR_GESTION), COUNT(FECHA_ANALISIS)
                      FROM {loader.qualified_name('GESTION_JURIDICA')} WHERE ID_SITUACION=:1
                """, [row["ID_SITUACION"]])
                self.assertEqual(self.cursor.fetchone(), (2, 1, 1))
                self.cursor.execute(f"""
                    SELECT COUNT(*) FROM {loader.qualified_name('ASIGNACION')}
                     WHERE ID_PERSONA=:1 AND FECHA_FIN IS NULL
                """, [row["ID_PERSONA"]])
                self.assertEqual(self.cursor.fetchone()[0], 0)

    def test_etl_moving_the_gestion_does_not_hide_its_original_author(self):
        row = self.fixture()
        transitions = self.capture({**row, "FASE": "MEDIANA"})
        new_situation = row["ID_SITUACION"] - 1
        self.cursor.execute(f"UPDATE {loader.qualified_name('SITUACION_CARCELARIA')} SET ACTIVO=0 WHERE ID_SITUACION=:1",
                            [row["ID_SITUACION"]])
        self.cursor.execute(f"""
            INSERT INTO {loader.qualified_name('SITUACION_CARCELARIA')} (ID_SITUACION, ID_PERSONA, ACTIVO)
            VALUES (:1, :2, 1)
        """, [new_situation, row["ID_PERSONA"]])
        self.cursor.execute(f"UPDATE {loader.qualified_name('GESTION_JURIDICA')} SET ID_SITUACION=:1 WHERE ID_GESTION=:2",
                            [new_situation, row["ID_GESTION"]])
        self.assertEqual(loader.apply_sisipec_bot_transitions(self.cursor, transitions, self.config), 1)
        self.cursor.execute(f"""
            SELECT DEFENSOR_GESTION, CIERRE_CASO FROM {loader.qualified_name('GESTION_JURIDICA')}
             WHERE ID_SITUACION=:1 ORDER BY FECHA_REGISTRO, ID_GESTION
        """, [new_situation])
        rows = self.cursor.fetchall()
        self.assertIn((loader.SISIPEC_BOT_NAME, loader.SISIPEC_BOT_CLOSURE), rows)
        self.assertIn((None, None), rows)

    def test_assignment_created_during_etl_and_manual_closures_are_preserved(self):
        row = self.fixture()
        transitions = self.capture({**row, "REQUERIMIENTOS": "SI"})
        self.cursor.execute(f"UPDATE {loader.qualified_name('ASIGNACION')} SET FECHA_FIN=SYSDATE WHERE ID_ASIGNACION=:1",
                            [row["ID_ASIGNACION"]])
        self.cursor.execute(f"""
            INSERT INTO {loader.qualified_name('ASIGNACION')} (ID_ASIGNACION, ID_PERSONA, NOMBRE_DEFENSOR, FECHA_ASIGNACION)
            VALUES (:1, :2, 'DEFENSOR NUEVO PRUEBA', SYSDATE)
        """, [row["ID_ASIGNACION"] - 1, row["ID_PERSONA"]])
        self.assertEqual(loader.apply_sisipec_bot_transitions(self.cursor, transitions, self.config), 0)
        self.cursor.execute(f"SELECT CIERRE_CASO FROM {loader.qualified_name('GESTION_JURIDICA')} WHERE ID_GESTION=:1",
                            [row["ID_GESTION"]])
        self.assertIsNone(self.cursor.fetchone()[0])

        row = self.fixture()
        transitions = self.capture({**row, "REQUERIMIENTOS": "SI"})
        self.cursor.execute(f"UPDATE {loader.qualified_name('GESTION_JURIDICA')} SET CIERRE_CASO='Otro motivo.' WHERE ID_GESTION=:1",
                            [row["ID_GESTION"]])
        self.assertEqual(loader.apply_sisipec_bot_transitions(self.cursor, transitions, self.config), 1)
        self.cursor.execute(f"SELECT CIERRE_CASO FROM {loader.qualified_name('GESTION_JURIDICA')} WHERE ID_GESTION=:1",
                            [row["ID_GESTION"]])
        self.assertEqual(self.cursor.fetchone()[0], "Otro motivo.")


if __name__ == "__main__":
    unittest.main()
