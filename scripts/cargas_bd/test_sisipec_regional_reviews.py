import unittest
from unittest.mock import Mock, patch

import pandas as pd

import loader_service as loader
import sisipec_regional_reviews as reviews


def transition(**updates):
    return {"NUMERO": 123, "ID_PERSONA": 10, "ID_SITUACION": 20, "ID_GESTION": 40,
            "ID_ASIGNACION": 30, "ESTABLECIMIENTO": "ERON ORIGEN",
            "ESTABLECIMIENTO_NUEVO": "ERON DESTINO", "ESTADO_CODIGO": "ANALIZAR_CASO", **updates}


class RegionalReviewTests(unittest.TestCase):
    def capture(self, target="ERON DESTINO", catalog=None, assigned=None):
        previous = transition(FECHA_ASIGNACION=assigned)
        cursor = Mock(description=[(column,) for column in previous])
        cursor.fetchall.side_effect = [catalog or [("ERON ORIGEN", "BOYACÁ"), ("ERON DESTINO", "META")],
                                       [tuple(previous.values())]]
        df = pd.DataFrame([{"NUMERO": "123", "ESTABLECIMIENTO": target, "FECHA_CORTE": "2026-11-25"}])
        return reviews.capture(cursor, df, "DNDP")

    def test_only_confirmed_different_regional_is_captured(self):
        self.assertEqual(len(self.capture()), 1)
        self.assertEqual(self.capture(target="ERON DESCONOCIDO"), [])
        self.assertEqual(self.capture(catalog=[("ERON ORIGEN", "META"), ("ERON DESTINO", "META")]), [])
        self.assertEqual(self.capture(catalog=[("ERON ORIGEN", "BOYACÁ"), ("ERON DESTINO", "META"), ("ERON DESTINO", "HUILA")]), [])
        self.assertEqual(self.capture(assigned="2026-11-25 10:00:00"), [])

    def test_historical_eron_aliases_share_the_same_identity(self):
        aliases = reviews.eron_aliases()
        self.assertEqual(reviews.eron_key("EPMSC LETICIA", aliases), reviews.eron_key("CPMS LETICIA", aliases))

    def apply(self, *, previous=None, current=(20, "ERON DESTINO"), assignments=None, latest=None):
        cursor = Mock(description=[(c,) for c in (latest or {})])
        cursor.fetchone.side_effect = [(10,), current, tuple(latest.values()) if latest else None]
        cursor.fetchall.return_value = assignments or []
        with patch.object(reviews, "next_id", return_value=41):
            count = reviews.apply(cursor, [previous or transition()], "DNDP")
        return count, cursor

    def test_creates_empty_case_and_ends_only_the_captured_assignment(self):
        count, cursor = self.apply(assignments=[(30,)])
        self.assertEqual(count, 1)
        inserts = [c for c in cursor.execute.call_args_list if c.args[0].lstrip().startswith("INSERT")]
        self.assertEqual(len(inserts), 1)
        self.assertNotIn("DEFENSOR_GESTION", inserts[0].args[0])
        self.assertNotIn("FECHA_ANALISIS", inserts[0].args[0])
        self.assertEqual(inserts[0].args[1], {"id": 41, "situacion": 20, "origen": 40})
        self.assertTrue(any("ID_ASIGNACION=:1" in c.args[0] and c.args[1] == [30] for c in cursor.execute.call_args_list))

    def test_preserves_previously_closed_history(self):
        count, cursor = self.apply(previous=transition(ESTADO_CODIGO="CASO_CERRADO"))
        self.assertEqual(count, 1)
        self.assertFalse(any("SET CIERRE_CASO" in c.args[0] for c in cursor.execute.call_args_list))

    def test_no_write_for_unconfirmed_move_new_assignment_or_existing_review(self):
        for options in ({"current": None}, {"current": (20, "ERON ORIGEN")}, {"assignments": [(99,)]},
                        {"latest": {"ID_GESTION": 41, "DEFENSOR_GESTION": "OTRO DEFENSOR"}},
                        {"latest": {"ID_GESTION": 41, "ID_GESTION_ORIGEN": 40}}):
            with self.subTest(options=options):
                count, cursor = self.apply(**options)
                self.assertEqual(count, 0)
                self.assertFalse(any(c.args[0].lstrip().startswith(("INSERT", "UPDATE")) for c in cursor.execute.call_args_list))

    def test_reuses_an_empty_case_left_by_the_etl(self):
        count, cursor = self.apply(latest={"ID_GESTION": 41, "ID_SITUACION": 20, "FECHA_ANALISIS": None})
        self.assertEqual(count, 1)
        self.assertFalse(any(c.args[0].lstrip().startswith("INSERT") for c in cursor.execute.call_args_list))

    def test_regional_transfer_takes_precedence_over_category_and_bot(self):
        cursor, connection = Mock(), Mock()
        item = transition()
        with patch.object(reviews, "capture", return_value=[item]), patch.object(reviews, "apply") as regional, \
             patch.object(loader.sisipec_category_reviews, "capture", return_value=[item]), \
             patch.object(loader.sisipec_category_reviews, "apply") as category, \
             patch.object(loader, "capture_sisipec_bot_transitions", return_value=[item]), \
             patch.object(loader, "apply_sisipec_bot_transitions") as bot, \
             patch.object(loader, "synchronize_sisipec_enfoques"):
            loader.call_etl(connection, cursor, loader.SOURCES["sisipec"], pd.DataFrame())
        regional.assert_called_once_with(cursor, [item], "DNDP")
        category.assert_called_once_with(cursor, [], "DNDP")
        bot.assert_called_once_with(cursor, [], loader.SOURCES["sisipec"])
        connection.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
