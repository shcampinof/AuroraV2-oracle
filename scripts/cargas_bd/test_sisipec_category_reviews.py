import unittest
from unittest.mock import Mock, patch

import pandas as pd

import loader_service as loader
import sisipec_category_reviews as reviews


def previous_case(**updates):
    return {"NUMERO": 123, "ID_PERSONA": 10, "ID_SITUACION": 20, "ID_GESTION": 40,
            "ID_ASIGNACION": 30, "CATEGORIZACION": "Prisión Domiciliaria",
            "NOMBRE_DEFENSOR": "DEFENSORA PRUEBA", "CEDULA_DEFENSOR": "1234",
            "NOMBRE_PAG": "PAG PRUEBA", "CEDULA_PAG": "5678", **updates}


class CategoryReviewTests(unittest.TestCase):
    def test_every_category_change_is_a_candidate_including_loss_of_eligibility(self):
        previous = previous_case()
        for category in ("Libertad condicional", "Preliminar libertad condicional",
                         "Utilidad Pública", "No reúne requisitos", "Otro texto", None):
            with self.subTest(category=category):
                cursor = Mock(description=[(key,) for key in previous])
                cursor.fetchall.return_value = [tuple(previous.values())]
                result = reviews.capture(cursor, pd.DataFrame([{"NUMERO": "123", "CATEGORIZACION": category}]), "DNDP")
                self.assertEqual(len(result), 1)
                self.assertEqual(result[0]["NUEVA_CATEGORIZACION"], category)

    def test_formatting_does_not_reopen_and_missing_people_are_ignored(self):
        previous = previous_case()
        cursor = Mock(description=[(key,) for key in previous])
        cursor.fetchall.return_value = [tuple(previous.values())]
        for row in ({"NUMERO": "123", "CATEGORIZACION": " prision   domiciliaria "},
                    {"NUMERO": "456", "CATEGORIZACION": "Libertad condicional"}):
            self.assertEqual(reviews.capture(cursor, pd.DataFrame([row]), "DNDP"), [])
        self.assertEqual(reviews.category_key(float("nan")), reviews.category_key(None))

    def test_only_empty_unassigned_cases_can_be_adopted(self):
        empty = {"ID_GESTION": 99, "ID_SITUACION": 20, "FECHA_REGISTRO": "today",
                 "DEFENSOR_GESTION": None, "ID_ASIGNACION_GESTION": None,
                 "ID_GESTION_ORIGEN": None, "FECHA_ANALISIS": None}
        self.assertTrue(reviews.empty_review(empty))
        for column, value in (("DEFENSOR_GESTION", "OTRO DEFENSOR"), ("FECHA_ANALISIS", "today"),
                              ("ID_GESTION_ORIGEN", 7), ("ACCION_REALIZAR", "Caso cerrado"),
                              ("RESUMEN_ANALISIS_CASO", "Trabajo posterior")):
            with self.subTest(column=column):
                self.assertFalse(reviews.empty_review({**empty, column: value}))

    def test_new_pag_assignment_and_inactive_situation_are_preserved(self):
        for rows in ([(10,), None], [(10,), (20,), (99, None)]):
            cursor = Mock()
            cursor.fetchone.side_effect = rows
            self.assertEqual(reviews.apply(cursor, [previous_case()], "DNDP"), 0)
            self.assertFalse(any(call.args[0].strip().startswith(("INSERT", "UPDATE", "DECLARE"))
                                 for call in cursor.execute.call_args_list))

    def test_failed_capture_prevents_etl_and_failed_application_rolls_back(self):
        for stage in ("capture", "apply"):
            cursor, connection = Mock(), Mock()
            with patch.object(reviews, "capture", return_value=[],
                              side_effect=RuntimeError("Revisión fallida") if stage == "capture" else None), \
                 patch.object(reviews, "apply", side_effect=RuntimeError("Revisión fallida")), \
                 patch.object(loader, "capture_sisipec_bot_transitions", return_value=[]):
                with self.assertRaisesRegex(RuntimeError, "Revisión fallida"):
                    loader.call_etl(connection, cursor, loader.SOURCES["sisipec"], pd.DataFrame())
            connection.rollback.assert_called_once()
            connection.commit.assert_not_called()
            self.assertEqual(cursor.callproc.call_count, 0 if stage == "capture" else 1)

    def test_closed_category_change_takes_precedence_over_bot_unassignment(self):
        cursor, connection = Mock(), Mock()
        transition = previous_case(NOMBRE_DEFENSOR=loader.SISIPEC_BOT_NAME)
        with patch.object(reviews, "capture", return_value=[transition]), \
             patch.object(reviews, "apply") as reopen, \
             patch.object(loader, "capture_sisipec_bot_transitions", return_value=[transition]), \
             patch.object(loader, "apply_sisipec_bot_transitions") as bot, \
             patch.object(loader, "synchronize_sisipec_enfoques"):
            loader.call_etl(connection, cursor, loader.SOURCES["sisipec"], pd.DataFrame())
        bot.assert_called_once_with(cursor, [], loader.SOURCES["sisipec"])
        reopen.assert_called_once_with(cursor, [transition], "DNDP")
        connection.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
