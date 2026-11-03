import unittest
from datetime import datetime
from unittest.mock import Mock, patch

import pandas as pd

import loader_service as loader


def previous_case(**updates):
    return {
        "NUMERO": 123, "ID_PERSONA": 10, "ID_SITUACION": 20,
        "ID_ASIGNACION": 30, "ID_GESTION": 40,
        "FECHA_CAPTURA": datetime(2025, 1, 1), "SITUACION": "CONDENADO",
        "AUTORIDAD": "JUZGADO 1", "PROCESO": "123456", "DELITOS": "HURTO",
        "FASE": "ALTA", "REQUERIMIENTOS": "NO", "CATEGORIZACION": "UTILIDAD PUBLICA",
        "PENA_DIAS": 3000, "PRIVACION": 900, "REDENCION": 120,
        "TIEMPO_EFECTIVO": 1020, "PORCENTAJE": 34,
        "CALIFICACION": "BUENA", "FECHA_CALIFICACION": datetime(2026, 9, 30),
        **updates,
    }


ALLOWED_CHANGES = {
    "FECHA_CAPTURA": datetime(2025, 2, 1), "SITUACION": "SINDICADO",
    "AUTORIDAD": "JUZGADO 2", "PROCESO": "987654", "DELITOS": "LESIONES",
    "FASE": "MEDIANA", "REQUERIMIENTOS": "SI", "CATEGORIZACION": "LIBERTAD CONDICIONAL",
}
IGNORED_CHANGES = {
    "PENA": "Pena corregida", "PENA_DIAS": 3300, "PRIVACION": 930, "REDENCION": 150,
    "TIEMPO_EFECTIVO": 1080, "PORCENTAJE": 36,
    "CALIFICACION": "EJEMPLAR", "FECHA_CALIFICACION": datetime(2026, 10, 29),
}


class BotReviewTests(unittest.TestCase):
    def test_excluded_changes_individually_and_together_do_not_trigger_review(self):
        previous = previous_case()
        for field, value in IGNORED_CHANGES.items():
            with self.subTest(field=field):
                self.assertEqual(loader.sisipec_bot_changed_fields(previous, {**previous, field: value}), ())
        self.assertEqual(loader.sisipec_bot_changed_fields(previous, {**previous, **IGNORED_CHANGES}), ())

    def test_each_remaining_field_still_triggers_review(self):
        previous = previous_case()
        for field, value in ALLOWED_CHANGES.items():
            with self.subTest(field=field):
                self.assertEqual(loader.sisipec_bot_changed_fields(previous, {**previous, field: value}), (field,))

    def test_excluded_changes_do_not_hide_a_phase_change(self):
        previous = previous_case()
        self.assertEqual(loader.sisipec_bot_changed_fields(
            previous, {**previous, **IGNORED_CHANGES, "FASE": "MEDIANA"}
        ), ("FASE",))

    def test_formatting_dates_and_etl_aliases_are_not_changes(self):
        self.assertEqual(loader.sisipec_bot_changed_fields(previous_case(), previous_case(
            AUTORIDAD=" juzgado   1 ", PROCESO="123-456", DELITOS=" hurto ",
            SITUACION="Condenado", FASE="ALT", REQUERIMIENTOS="N", FECHA_CAPTURA="2025-01-01",
        )), ())
        self.assertEqual(loader.sisipec_bot_changed_fields(previous_case(FASE="NO REPORTA"),
                                                         previous_case(FASE=None)), ())

    def test_capture_only_considers_current_bot_assignments_present_in_the_file(self):
        cursor = Mock()
        previous = previous_case()
        cursor.description = [(field,) for field in previous]
        cursor.fetchall.return_value = [tuple(previous.values())]
        incoming = pd.DataFrame([previous_case(FASE="MEDIANA"), previous_case(NUMERO=456)])
        transitions = loader.capture_sisipec_bot_transitions(cursor, incoming, loader.SOURCES["sisipec"])
        self.assertEqual(len(transitions), 1)
        self.assertEqual(transitions[0]["CHANGED_FIELDS"], ("FASE",))
        sql, binds = cursor.execute.call_args.args
        self.assertIn("s.ACTIVO = 1 AND a.FECHA_FIN IS NULL", sql)
        self.assertEqual(binds, ["EQUIPO PPL DNDP"])
        self.assertEqual(loader.capture_sisipec_bot_transitions(
            cursor, pd.DataFrame([previous_case(NUMERO=456)]), loader.SOURCES["sisipec"]
        ), [])

    def test_new_assignment_during_etl_is_preserved(self):
        cursor = Mock()
        cursor.fetchone.side_effect = [(10,), (99,)]
        self.assertEqual(loader.apply_sisipec_bot_transitions(
            cursor, [previous_case()], loader.SOURCES["sisipec"]
        ), 0)
        self.assertFalse(any(item.args[0].strip().startswith(("UPDATE", "INSERT", "DECLARE"))
                             for item in cursor.execute.call_args_list))

    def test_other_sources_never_apply_bot_rules(self):
        cursor = Mock()
        for source in ("ponal", "aurora_10"):
            config = loader.SOURCES[source]
            self.assertEqual(loader.capture_sisipec_bot_transitions(cursor, pd.DataFrame(), config), [])
            self.assertEqual(loader.apply_sisipec_bot_transitions(cursor, [previous_case()], config), 0)
        cursor.execute.assert_not_called()

    def test_failed_etl_never_applies_closures(self):
        cursor, connection = Mock(), Mock()
        cursor.callproc.side_effect = loader.oracledb.Error("ETL fallido")
        with patch.object(loader, "capture_sisipec_bot_transitions", return_value=[previous_case()]), \
             patch.object(loader, "apply_sisipec_bot_transitions") as apply:
            with self.assertRaisesRegex(RuntimeError, "ETL fallido"):
                loader.call_etl(connection, cursor, loader.SOURCES["sisipec"], pd.DataFrame())
        apply.assert_not_called()
        connection.rollback.assert_called_once()
        connection.commit.assert_not_called()

    def test_application_error_rolls_back_and_does_not_report_success(self):
        cursor, connection = Mock(), Mock()
        with patch.object(loader, "capture_sisipec_bot_transitions", return_value=[previous_case()]), \
             patch.object(loader, "apply_sisipec_bot_transitions", side_effect=RuntimeError("Sin situación")):
            with self.assertRaisesRegex(RuntimeError, "Sin situación"):
                loader.call_etl(connection, cursor, loader.SOURCES["sisipec"], pd.DataFrame())
        connection.rollback.assert_called_once()
        connection.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
