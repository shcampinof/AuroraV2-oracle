"""Pruebas con filas sintéticas y rollback; nunca ejecuta ni instala el ETL."""
import hashlib
import os
import unittest

import pandas as pd

import loader_service as loader
import sisipec_category_reviews as categories
import sisipec_regional_reviews as reviews
import test_sisipec_category_reviews_oracle as fixtures


@unittest.skipUnless(os.getenv("RUN_ORACLE_INTEGRATION", "").lower() == "true", "Requiere Oracle")
class RegionalReviewOracleTests(unittest.TestCase):
    fixture = fixtures.CategoryReviewOracleTests.fixture
    gestion = fixtures.CategoryReviewOracleTests.gestion

    @classmethod
    def setUpClass(cls):
        cls.connection = loader.connect_oracle()
        cls.cursor = cls.connection.cursor()
        cls.owner, _ = loader.parse_qualified_object(loader.SOURCES["sisipec"].qualified_table)
        cls.procedure_hash = cls.source_hash()
        cls.cursor.execute(f"SELECT ESTABLECIMIENTO, TO_CHAR(REGIONAL) FROM {reviews.table(cls.owner, 'CAT_ERON_REGIONAL')} WHERE NVL(ACTIVO,1)=1 AND REGIONAL IS NOT NULL")
        catalog = cls.cursor.fetchall()
        cls.origin = catalog[0]
        cls.destination = next(row for row in catalog if row[1] != cls.origin[1])

    @classmethod
    def source_hash(cls):
        cls.cursor.execute("SELECT TEXT FROM ALL_SOURCE WHERE OWNER=:1 AND NAME='PRC_CARGA_SISIPEC' AND TYPE='PROCEDURE' ORDER BY LINE", [cls.owner])
        return hashlib.sha256("".join(row[0] or "" for row in cls.cursor.fetchall()).encode()).hexdigest()

    @classmethod
    def tearDownClass(cls):
        try:
            cls.connection.rollback()
            if cls.source_hash() != cls.procedure_hash:
                raise AssertionError("No debe modificarse el procedimiento")
        finally:
            cls.cursor.close()
            cls.connection.close()

    def setUp(self):
        self.people = []

    def tearDown(self):
        self.connection.rollback()
        for identifier in self.people:
            self.cursor.execute(f"SELECT COUNT(*) FROM {reviews.table(self.owner, 'PERSONA')} WHERE ID_PERSONA=:1", [identifier])
            self.assertEqual(self.cursor.fetchone()[0], 0)

    def move(self, *, closed=False, category_change=False, intervening=False):
        fixture = self.fixture(closed=closed)
        identifier = fixture["ID_PERSONA"]
        self.cursor.execute(f"UPDATE {reviews.table(self.owner, 'SITUACION_CARCELARIA')} SET ESTABLECIMIENTO=:1 WHERE ID_PERSONA=:2", [self.origin[0], identifier])
        before = self.gestion(fixture["ID_GESTION"])
        data = pd.DataFrame([{"NUMERO": str(fixture["NUMERO"]), "ESTABLECIMIENTO": self.destination[0],
                              "CATEGORIZACION": "Libertad condicional", "FECHA_CORTE": "2026-11-25"}])
        scoped = fixtures.ScopedCursor(self.cursor, identifier)
        regional = reviews.capture(scoped, data, self.owner)
        self.assertEqual(len(regional), 1)
        if category_change:
            self.assertEqual(len(categories.capture(scoped, data, self.owner)), 1)
        self.cursor.execute(f"UPDATE {reviews.table(self.owner, 'SITUACION_CARCELARIA')} SET ESTABLECIMIENTO=:1, CATEGORIZACION='Libertad condicional' WHERE ID_PERSONA=:2", [self.destination[0], identifier])
        # Emula únicamente los efectos de la rama regional del procedimiento instalado.
        self.cursor.execute(f"UPDATE {reviews.table(self.owner, 'ASIGNACION')} SET FECHA_FIN=SYSDATE WHERE ID_PERSONA=:1", [identifier])
        if intervening:
            self.cursor.execute(f"INSERT INTO {reviews.table(self.owner, 'ASIGNACION')} (ID_ASIGNACION, ID_PERSONA, NOMBRE_DEFENSOR, FECHA_ASIGNACION) VALUES (:1,:2,'DEFENSOR DESTINO',SYSDATE)", [identifier-1, identifier])
        self.assertEqual(reviews.apply(self.cursor, regional, self.owner), 0 if intervening else 1)
        if intervening:
            self.assertEqual(self.gestion(fixture["ID_GESTION"]), before)
            return
        self.assertEqual(reviews.apply(self.cursor, regional, self.owner), 0, "Reintentar no duplica")
        self.cursor.execute(f"SELECT * FROM {reviews.table(self.owner, 'GESTION_JURIDICA')} WHERE ID_GESTION_ORIGEN=:1", [fixture["ID_GESTION"]])
        fresh = reviews.fetch_dict(self.cursor)
        self.assertIsNotNone(fresh)
        for field, value in fresh.items():
            if field not in {"ID_GESTION", "ID_SITUACION", "ID_GESTION_ORIGEN", "FECHA_REGISTRO", "ACCION_REALIZAR"}:
                self.assertIsNone(value, f"La gestión nueva debe estar vacía: {field}")
        self.cursor.execute(f"SELECT COUNT(*) FROM {reviews.table(self.owner, 'ASIGNACION')} WHERE ID_PERSONA=:1 AND FECHA_FIN IS NULL", [identifier])
        self.assertEqual(self.cursor.fetchone()[0], 0)
        historical = self.gestion(fixture["ID_GESTION"])
        if closed:
            self.assertEqual(historical, before)
        else:
            expected = {**before, "CIERRE_CASO": "Cierre automático por cambio de regional."}
            self.assertEqual(historical, expected)
        self.assertEqual(reviews.capture(scoped, data, self.owner), [], "Repetir el corte no crea otra gestión")

    def test_open_case_moves_to_empty_unassigned_review(self):
        self.move()

    def test_closed_case_with_category_change_prioritizes_regional(self):
        self.move(closed=True, category_change=True)

    def test_concurrent_pag_assignment_is_preserved(self):
        self.move(intervening=True)


if __name__ == "__main__":
    unittest.main()
