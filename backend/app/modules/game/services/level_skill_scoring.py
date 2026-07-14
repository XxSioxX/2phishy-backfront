from typing import Any, Dict, List

from app.modules.learning_path.models.learn_path import Topics


LEVEL_SKILL_CONFIGS = [
    {
        "topic": Topics.SFB_T.value,
        "label": "Safe Browsing",
        "progress_target": 4,
        "metrics_used": [
            "question accuracy",
            "zone progress",
            "trap hits",
            "zone failures",
            "level completion",
        ],
        "info": (
            "Safe Browsing weighs quiz accuracy, cleared zones, malicious-link "
            "trap hits, failed zones, and completion."
        ),
    },
    {
        "topic": Topics.PS_T.value,
        "label": "Password Security",
        "progress_target": 5,
        "metrics_used": [
            "question accuracy",
            "boss progress",
            "password challenge success rate",
            "MFA decisions",
            "level completion",
        ],
        "info": (
            "Password Security weighs quiz accuracy, guardian progress, fictional "
            "password challenge attempts, MFA decisions, and completion."
        ),
    },
    {
        "topic": Topics.M_T.value,
        "label": "Malware",
        "progress_target": 1,
        "metrics_used": [
            "question accuracy",
            "malware cleanup results",
            "damage taken",
            "system resets",
            "level completion",
        ],
        "info": (
            "Malware weighs quiz accuracy, cleanup success, damage taken from "
            "threats, system resets, and completion."
        ),
    },
    {
        "topic": Topics.SE_T.value,
        "label": "Social Engineering",
        "progress_target": 1,
        "metrics_used": [
            "trust grade",
            "dialogue success rate",
            "question accuracy",
            "level completion",
        ],
        "info": (
            "Social Engineering weighs the existing trust grade, dialogue outcomes, "
            "any quiz accuracy, and completion."
        ),
    },
    {
        "topic": Topics.IR_T.value,
        "label": "Incident Response",
        "progress_target": 5,
        "metrics_used": [
            "room completion",
            "responder releases",
            "incident report accuracy",
            "witness decisions",
            "final shutdown",
        ],
        "info": (
            "Incident Response weighs completed response rooms, freed responders, "
            "report and witness decisions, damage, final shutdown, and completion."
        ),
    },
]

LEVEL_SKILL_BY_TOPIC = {config["topic"]: config for config in LEVEL_SKILL_CONFIGS}


def clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return max(minimum, min(maximum, value))


def percentage(part: float, total: float, fallback: float = 0) -> float:
    if total <= 0:
        return fallback
    return clamp((part / total) * 100)


def metric(topic_progress: Dict[str, Any], metric_name: str, fallback: float = 0) -> float:
    metrics = topic_progress.get("gameplay", {}).get("metrics", {})
    value = metrics.get(metric_name, fallback) if isinstance(metrics, dict) else fallback
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def topic_metrics(topic_progress: Dict[str, Any]) -> Dict[str, Any]:
    metrics = topic_progress.get("gameplay", {}).get("metrics", {})
    return metrics if isinstance(metrics, dict) else {}


def answer_counts(topic_progress: Dict[str, Any]) -> tuple[int, int]:
    answers = topic_progress.get("answers", [])
    if not isinstance(answers, list):
        return 0, 0

    correct = sum(
        1 for answer in answers
        if isinstance(answer, dict) and answer.get("is_correct") is True
    )
    total = sum(1 for answer in answers if isinstance(answer, dict))
    return correct, total


def progress_score(topic_progress: Dict[str, Any], progress_target: int) -> float:
    if topic_progress.get("level_completed") is True:
        return 100

    if progress_target <= 1:
        return 0

    current_zone = topic_progress.get("current_zone") or 1
    unlocked_zone = topic_progress.get("unlocked_zone") or current_zone

    try:
        reached = max(float(current_zone), float(unlocked_zone))
    except (TypeError, ValueError):
        reached = 1

    return percentage(reached - 1, progress_target - 1)


def topic_started(topic_progress: Dict[str, Any]) -> bool:
    if not isinstance(topic_progress, dict) or not topic_progress:
        return False

    if topic_progress.get("level_completed") is True:
        return True

    if topic_progress.get("answers"):
        return True

    if topic_progress.get("current_zone") or topic_progress.get("unlocked_zone"):
        return True

    if topic_progress.get("trust"):
        return True

    return bool(topic_metrics(topic_progress))


def safe_round(value: float) -> int:
    return int(round(clamp(value)))


def build_skill_detail(
    score: float,
    correct_answers: int,
    total_questions: int,
    gameplay: Dict[str, Any],
    notes: List[str],
) -> Dict[str, Any]:
    return {
        "score": safe_round(score),
        "correct_answers": correct_answers,
        "total_questions": total_questions,
        "gameplay": gameplay,
        "notes": notes,
    }


def score_safe_browsing(topic_progress: Dict[str, Any]) -> tuple[float, Dict[str, Any]]:
    correct, total = answer_counts(topic_progress)
    answer_score = percentage(correct, total)
    zone_score = progress_score(topic_progress, 4)
    trap_hits = metric(topic_progress, "trap_hits")
    zone_failures = metric(topic_progress, "zone_failures")
    wrong_answers = max(total - correct, metric(topic_progress, "wrong_answers"))
    gameplay_score = clamp(100 - (trap_hits * 10) - (zone_failures * 8) - (wrong_answers * 4))
    completion_score = 100 if topic_progress.get("level_completed") is True else 0
    score = (
        answer_score * 0.45
        + zone_score * 0.25
        + gameplay_score * 0.20
        + completion_score * 0.10
    )
    return score, build_skill_detail(
        score,
        correct,
        total,
        {
            "zone_score": safe_round(zone_score),
            "trap_hits": trap_hits,
            "zone_failures": zone_failures,
            "wrong_answers": wrong_answers,
        },
        ["Lower trap hits and fewer failed zones raise this score."],
    )


def score_password_security(topic_progress: Dict[str, Any]) -> tuple[float, Dict[str, Any]]:
    correct, total = answer_counts(topic_progress)
    answer_score = percentage(correct, total)
    boss_progress_score = progress_score(topic_progress, 5)
    attempts = metric(topic_progress, "password_attempts")
    successes = metric(topic_progress, "password_successes")
    failures = metric(topic_progress, "password_failures")
    mfa_correct = metric(topic_progress, "mfa_correct")
    mfa_wrong = metric(topic_progress, "mfa_wrong")
    challenge_score = percentage(successes + mfa_correct, attempts + mfa_correct + mfa_wrong, 70)
    penalty = min(35, failures * 5 + mfa_wrong * 10)
    completion_score = 100 if topic_progress.get("level_completed") is True else 0
    score = (
        answer_score * 0.30
        + boss_progress_score * 0.25
        + clamp(challenge_score - penalty) * 0.30
        + completion_score * 0.15
    )
    return score, build_skill_detail(
        score,
        correct,
        total,
        {
            "boss_progress_score": safe_round(boss_progress_score),
            "password_attempts": attempts,
            "password_successes": successes,
            "password_failures": failures,
            "mfa_correct": mfa_correct,
            "mfa_wrong": mfa_wrong,
        },
        ["Fewer rejected passwords and correct MFA choices raise this score."],
    )


def score_malware(topic_progress: Dict[str, Any]) -> tuple[float, Dict[str, Any]]:
    correct, total = answer_counts(topic_progress)
    answer_score = percentage(correct, total)
    malware_cleaned = metric(topic_progress, "malware_cleaned")
    cleanup_failed = metric(topic_progress, "malware_cleanup_failed")
    damage_taken = metric(topic_progress, "damage_taken")
    system_resets = metric(topic_progress, "system_resets")
    cleanup_score = percentage(malware_cleaned, malware_cleaned + cleanup_failed, answer_score)
    survival_score = clamp(100 - (damage_taken * 6) - (system_resets * 18))
    completion_score = 100 if topic_progress.get("level_completed") is True else 0
    score = (
        answer_score * 0.40
        + cleanup_score * 0.25
        + survival_score * 0.20
        + completion_score * 0.15
    )
    return score, build_skill_detail(
        score,
        correct,
        total,
        {
            "malware_cleaned": malware_cleaned,
            "malware_cleanup_failed": cleanup_failed,
            "damage_taken": damage_taken,
            "system_resets": system_resets,
        },
        ["Correct cleanup and less damage raise this score."],
    )


def score_social_engineering(topic_progress: Dict[str, Any]) -> tuple[float, Dict[str, Any]]:
    correct, total = answer_counts(topic_progress)
    answer_score = percentage(correct, total, 70)
    trust_grade = topic_progress.get("trust", {}).get("grade")

    try:
        trust_score = clamp(float(trust_grade))
    except (TypeError, ValueError):
        trust_score = 50

    dialogue_successes = metric(topic_progress, "dialogue_successes")
    dialogue_failures = metric(topic_progress, "dialogue_failures")
    dialogue_score = percentage(
        dialogue_successes,
        dialogue_successes + dialogue_failures,
        trust_score,
    )
    completion_score = 100 if topic_progress.get("level_completed") is True else 0
    score = (
        trust_score * 0.60
        + dialogue_score * 0.25
        + answer_score * 0.10
        + completion_score * 0.05
    )
    return score, build_skill_detail(
        score,
        correct,
        total,
        {
            "trust_grade": trust_grade,
            "dialogue_successes": dialogue_successes,
            "dialogue_failures": dialogue_failures,
        },
        ["Better dialogue outcomes and higher trust raise this score."],
    )


def score_incident_response(topic_progress: Dict[str, Any]) -> tuple[float, Dict[str, Any]]:
    correct, total = answer_counts(topic_progress)
    answer_score = percentage(correct, total)
    zone_progress_score = progress_score(topic_progress, 5)
    rooms_completed = metric(topic_progress, "rooms_completed")
    responders_released = metric(topic_progress, "responders_released")
    report_correct = metric(topic_progress, "report_answers_correct")
    report_retries = metric(topic_progress, "report_retries")
    witness_correct = metric(topic_progress, "witness_correct")
    witness_wrong = metric(topic_progress, "witness_wrong")
    damage_taken = metric(topic_progress, "incident_damage_taken")
    final_shutdown = metric(topic_progress, "final_shutdown")
    room_score = max(zone_progress_score, percentage(rooms_completed + responders_released, 8))
    decision_score = percentage(
        report_correct + witness_correct + final_shutdown,
        report_correct + report_retries + witness_correct + witness_wrong + max(final_shutdown, 1),
        answer_score,
    )
    survival_score = clamp(100 - (damage_taken * 5))
    completion_score = 100 if topic_progress.get("level_completed") is True else 0
    score = (
        room_score * 0.35
        + decision_score * 0.25
        + answer_score * 0.15
        + survival_score * 0.10
        + completion_score * 0.15
    )
    return score, build_skill_detail(
        score,
        correct,
        total,
        {
            "rooms_completed": rooms_completed,
            "responders_released": responders_released,
            "report_answers_correct": report_correct,
            "report_retries": report_retries,
            "witness_correct": witness_correct,
            "witness_wrong": witness_wrong,
            "incident_damage_taken": damage_taken,
            "final_shutdown": final_shutdown,
        },
        ["Room progress, responder releases, and accepted reports raise this score."],
    )


def calculate_level_skill(topic: str, topic_progress: Dict[str, Any]) -> tuple[float, Dict[str, Any]]:
    if topic == Topics.SFB_T.value:
        return score_safe_browsing(topic_progress)
    if topic == Topics.PS_T.value:
        return score_password_security(topic_progress)
    if topic == Topics.M_T.value:
        return score_malware(topic_progress)
    if topic == Topics.SE_T.value:
        return score_social_engineering(topic_progress)
    if topic == Topics.IR_T.value:
        return score_incident_response(topic_progress)

    correct, total = answer_counts(topic_progress)
    score = percentage(correct, total)
    return score, build_skill_detail(score, correct, total, {}, [])


def skill_category(score: float | None, started: bool) -> str:
    if not started:
        return "not_started"
    if score is not None and score >= 80:
        return "strong"
    if score is not None and score >= 60:
        return "on_track"
    return "needs_practice"


def safe_metric_name(metric_name: str) -> str:
    sanitized = "".join(
        char.lower() if char.isalnum() else "_"
        for char in metric_name.strip()
    )
    sanitized = "_".join(part for part in sanitized.split("_") if part)
    if not sanitized:
        raise ValueError("Metric name is required")
    return sanitized[:60]
