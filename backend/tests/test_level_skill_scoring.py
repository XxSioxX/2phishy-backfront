import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.modules.game.services.level_skill_scoring import (  # noqa: E402
    safe_metric_name,
    score_incident_response,
    score_password_security,
    score_safe_browsing,
    topic_started,
)


class LevelSkillScoringTests(unittest.TestCase):
    def test_safe_browsing_penalizes_traps_and_failed_zones(self):
        clean_score, _ = score_safe_browsing({
            "answers": [
                {"is_correct": True},
                {"is_correct": True},
                {"is_correct": True},
            ],
            "current_zone": 4,
            "unlocked_zone": 4,
            "level_completed": True,
            "gameplay": {"metrics": {}},
        })
        risky_score, details = score_safe_browsing({
            "answers": [
                {"is_correct": True},
                {"is_correct": False},
                {"is_correct": True},
            ],
            "current_zone": 2,
            "unlocked_zone": 2,
            "gameplay": {
                "metrics": {
                    "trap_hits": 2,
                    "zone_failures": 1,
                }
            },
        })

        self.assertGreater(clean_score, risky_score)
        self.assertEqual(details["gameplay"]["trap_hits"], 2)
        self.assertEqual(details["gameplay"]["zone_failures"], 1)

    def test_password_security_uses_password_attempts_and_mfa(self):
        score, details = score_password_security({
            "answers": [
                {"is_correct": True},
                {"is_correct": True},
            ],
            "current_zone": 5,
            "unlocked_zone": 5,
            "gameplay": {
                "metrics": {
                    "password_attempts": 4,
                    "password_successes": 4,
                    "password_failures": 0,
                    "mfa_correct": 1,
                    "mfa_wrong": 0,
                }
            },
        })

        self.assertGreaterEqual(score, 80)
        self.assertEqual(details["gameplay"]["password_successes"], 4)
        self.assertEqual(details["gameplay"]["mfa_correct"], 1)

    def test_incident_response_rewards_completion_signals(self):
        score, details = score_incident_response({
            "answers": [
                {"is_correct": True},
                {"is_correct": True},
                {"is_correct": False},
            ],
            "current_zone": 5,
            "unlocked_zone": 5,
            "level_completed": True,
            "gameplay": {
                "metrics": {
                    "rooms_completed": 4,
                    "responders_released": 4,
                    "report_answers_correct": 3,
                    "report_retries": 0,
                    "witness_correct": 3,
                    "witness_wrong": 0,
                    "final_shutdown": 1,
                    "incident_damage_taken": 1,
                }
            },
        })

        self.assertGreaterEqual(score, 80)
        self.assertEqual(details["gameplay"]["final_shutdown"], 1)

    def test_topic_started_detects_existing_progress(self):
        self.assertFalse(topic_started({}))
        self.assertTrue(topic_started({"answers": [{"is_correct": True}]}))
        self.assertTrue(topic_started({"gameplay": {"metrics": {"trap_hits": 1}}}))

    def test_metric_name_sanitization(self):
        self.assertEqual(safe_metric_name("Trap Hits!"), "trap_hits")

        with self.assertRaises(ValueError):
            safe_metric_name("!!!")


if __name__ == "__main__":
    unittest.main()
