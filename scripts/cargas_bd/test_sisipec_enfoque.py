import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, call

import pandas as pd

import loader_service


class SisipecEnfoqueTests(unittest.TestCase):
    def setUp(self):
        self.config = loader_service.SOURCES["sisipec"]

    def read_excel(self, data, columns=None):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sisipec.xlsx"
            pd.DataFrame(data, columns=columns).to_excel(path, index=False)
            return loader_service.read_sisipec(path, self.config)

    def test_text_survives_excel_and_oracle_row_preparation(self):
        df = self.read_excel({"NUMERO": ["123"], "ENFOQUE": ["Persona con discapacidad"]})
        row = loader_service.prepare_row(df.iloc[0], self.config)
        self.assertEqual(row[self.config.columns.index("ENFOQUE")], "Persona con discapacidad")
        self.assertNotIn("ENFOQUE", self.config.number_columns)
        self.assertIn("ENFOQUE NVARCHAR2(2000)", " ".join(loader_service.sisipec_ddl().split()))

    def test_combines_repeated_numbered_and_descriptive_columns_in_file_order(self):
        df = self.read_excel(
            [["123", " Indígena ", "indigena", "Adulto mayor", None, "Migrante"],
             ["456", None, None, None, None, None],
             [None, None, None, None, None, None]],
            ["numero", " enfoque ", "ENFOQUE", "ENFOQUE_2", "ENFOQUE3", "Enfoque diferencial"],
        )
        self.assertEqual(len(df), 2)
        self.assertEqual(df.loc[0, "ENFOQUE"], "Indígena; Adulto mayor; Migrante")
        self.assertIsNone(df.loc[1, "ENFOQUE"])
        self.assertEqual(list(df.columns), self.config.columns)

    def test_file_with_only_numbered_enfoques_does_not_need_base_column(self):
        df = self.read_excel({"NUMERO": ["123"], "ENFOQUE 1": ["Migrante"], "ENFOQUE_2": ["Adulto mayor"]})
        self.assertEqual(df.loc[0, "ENFOQUE"], "Migrante; Adulto mayor")

    def test_missing_enfoque_and_empty_file_are_supported(self):
        df = self.read_excel({"NUMERO": ["123"]})
        self.assertIsNone(df.loc[0, "ENFOQUE"])
        empty = self.read_excel([], ["NUMERO", "ENFOQUE"])
        self.assertTrue(empty.empty)

    def test_rejects_overflow_before_loading_instead_of_truncating(self):
        with self.assertRaisesRegex(ValueError, "fila 2 supera los 2000"):
            self.read_excel({"NUMERO": ["123"], "ENFOQUE": ["a" * 1999], "ENFOQUE2": ["Otro"]})

    def test_expands_destination_only_when_needed(self):
        cursor = Mock()
        connection = Mock()
        cursor.fetchone.return_value = ("NVARCHAR2", 255)
        loader_service.ensure_sisipec_enfoque_capacity(cursor, connection, self.config)
        self.assertEqual(cursor.execute.call_args, call(
            "ALTER TABLE DNDP.SITUACION_CARCELARIA MODIFY (ENFOQUE NVARCHAR2(2000))"
        ))
        connection.commit.assert_called_once()
        cursor.reset_mock()
        connection.reset_mock()
        cursor.fetchone.return_value = ("NVARCHAR2", 2000)
        loader_service.ensure_sisipec_enfoque_capacity(cursor, connection, self.config)
        self.assertEqual(cursor.execute.call_count, 1)
        connection.commit.assert_not_called()

    def test_syncs_imported_text_only_to_current_sisipec_situations(self):
        cursor = Mock(rowcount=2)
        df = pd.DataFrame({
            "NUMERO": ["1.234", "456", "789", None, "sin documento"],
            "ENFOQUE": ["Indígena; Migrante", "Adulto mayor", None, "Migrante", "Migrante"],
        })
        loader_service.synchronize_sisipec_enfoques(cursor, df, self.config)
        sql, data = cursor.executemany.call_args.args
        self.assertIn("ACTIVO = 1", sql)
        self.assertIn("FUENTE = 'SISIPEC'", sql)
        self.assertIn("PERSONA WHERE NUMERO = :2", sql)
        self.assertEqual(data, [("Indígena; Migrante", 1234), ("Adulto mayor", 456)])

    def test_sync_runs_after_successful_etl_before_commit(self):
        operations = Mock()
        operations.cursor.rowcount = 1
        operations.cursor.description = []
        operations.cursor.fetchall.return_value = []
        df = pd.DataFrame({"NUMERO": ["123"], "ENFOQUE": ["Migrante"]})
        loader_service.call_etl(operations.connection, operations.cursor, self.config, df)
        names = [item[0] for item in operations.mock_calls]
        self.assertEqual(names, ["cursor.execute", "cursor.fetchall", "cursor.callproc",
                                 "cursor.executemany", "connection.commit"])

    def test_failed_etl_does_not_synchronize_enfoques(self):
        cursor = Mock()
        cursor.description = []
        cursor.fetchall.return_value = []
        cursor.callproc.side_effect = loader_service.oracledb.Error("ETL fallido")
        connection = Mock()
        with self.assertRaisesRegex(RuntimeError, "ETL fallido"):
            loader_service.call_etl(connection, cursor, self.config, pd.DataFrame())
        cursor.executemany.assert_not_called()
        connection.rollback.assert_called_once()
        connection.commit.assert_not_called()

    def test_other_sources_do_not_sync_enfoques(self):
        cursor = Mock()
        loader_service.synchronize_sisipec_enfoques(cursor, pd.DataFrame(), loader_service.SOURCES["ponal"])
        cursor.executemany.assert_not_called()


if __name__ == "__main__":
    unittest.main()
