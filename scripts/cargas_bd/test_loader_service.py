import unittest
from unittest.mock import Mock, call

import loader_service


class AuroraConductaTests(unittest.TestCase):
    def setUp(self):
        self.config = loader_service.SOURCES["aurora_10"]

    def test_calificacion_conducta_is_loaded_as_text(self):
        self.assertNotIn("CALIFICACION_CONDUCTA", self.config.number_columns)
        self.assertEqual(
            loader_service.clean_value("Excelente", "CALIFICACION_CONDUCTA", self.config),
            "Excelente",
        )

    def test_aurora_ddl_defines_calificacion_conducta_as_nvarchar2(self):
        ddl = " ".join(loader_service.aurora_ddl().split())
        self.assertIn("CALIFICACION_CONDUCTA NVARCHAR2(255)", ddl)
        self.assertNotIn("CALIFICACION_CONDUCTA NUMBER", ddl)

    def test_existing_numeric_column_is_migrated_after_truncate(self):
        cursor = Mock()
        cursor.fetchone.side_effect = [(1,), ("NUMBER", None)]
        connection = Mock()

        loader_service.prepare_table(cursor, connection, self.config)

        self.assertEqual(cursor.execute.call_args_list[1], call("TRUNCATE TABLE DNDP.AURORA_10"))
        self.assertEqual(
            cursor.execute.call_args_list[-1],
            call(
                "ALTER TABLE DNDP.AURORA_10 "
                "MODIFY (CALIFICACION_CONDUCTA NVARCHAR2(255))"
            ),
        )

    def test_existing_text_column_does_not_require_alter(self):
        cursor = Mock()
        cursor.fetchone.side_effect = [(1,), ("NVARCHAR2", 255)]
        connection = Mock()

        loader_service.prepare_table(cursor, connection, self.config)

        statements = [item.args[0] for item in cursor.execute.call_args_list]
        self.assertFalse(any(statement.startswith("ALTER TABLE") for statement in statements))


if __name__ == "__main__":
    unittest.main()
