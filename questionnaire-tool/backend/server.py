from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
DB_DIR = ROOT_DIR / "backend" / "data"
DB_PATH = DB_DIR / "questionnaire_submissions.sqlite3"


def ensure_database() -> None:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS questionnaire_submissions (
                id TEXT PRIMARY KEY,
                questionnaire_type TEXT NOT NULL,
                participant_id TEXT NOT NULL,
                answers_json TEXT NOT NULL,
                current_step INTEGER,
                user_agent TEXT,
                referrer TEXT,
                theme TEXT,
                autosave_json TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def json_response(handler: SimpleHTTPRequestHandler, status: int, payload: dict) -> None:
    encoded = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.end_headers()
    handler.wfile.write(encoded)


class QuestionnaireHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.send_response(HTTPStatus.SEE_OTHER)
            self.send_header("Location", "/pretest/")
            self.end_headers()
            return

        if parsed.path == "/api/health":
            json_response(self, HTTPStatus.OK, {"status": "ok"})
            return

        super().do_GET()

    def do_POST(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path != "/api/questionnaires/submissions":
            json_response(
                self,
                HTTPStatus.NOT_FOUND,
                {"detail": "Endpoint not found"},
            )
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)

        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            json_response(self, HTTPStatus.BAD_REQUEST, {"detail": "Invalid JSON payload"})
            return

        required_fields = ("questionnaire_type", "participant_id", "answers")
        missing = [field for field in required_fields if field not in payload]
        if missing:
            json_response(
                self,
                HTTPStatus.BAD_REQUEST,
                {"detail": f"Missing required fields: {', '.join(missing)}"},
            )
            return

        questionnaire_type = str(payload["questionnaire_type"]).strip().lower()
        if questionnaire_type not in {"pretest", "posttest"}:
            json_response(
                self,
                HTTPStatus.BAD_REQUEST,
                {"detail": "questionnaire_type must be pretest or posttest"},
            )
            return

        participant_id = str(payload["participant_id"]).strip()
        if not participant_id:
            json_response(
                self,
                HTTPStatus.BAD_REQUEST,
                {"detail": "participant_id is required"},
            )
            return

        answers = payload["answers"]
        if not isinstance(answers, dict):
            json_response(
                self,
                HTTPStatus.BAD_REQUEST,
                {"detail": "answers must be an object"},
            )
            return

        created_at = datetime.now(timezone.utc).isoformat()
        submission_id = str(uuid.uuid4())

        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                INSERT INTO questionnaire_submissions (
                    id, questionnaire_type, participant_id, answers_json,
                    current_step, user_agent, referrer, theme, autosave_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    submission_id,
                    questionnaire_type,
                    participant_id,
                    json.dumps(answers),
                    payload.get("current_step"),
                    payload.get("user_agent"),
                    payload.get("referrer"),
                    payload.get("theme"),
                    json.dumps(payload.get("autosave_snapshot"))
                    if payload.get("autosave_snapshot") is not None
                    else None,
                    created_at,
                ),
            )
            conn.commit()

        json_response(
            self,
            HTTPStatus.CREATED,
            {
                "status": "success",
                "submission_id": submission_id,
                "questionnaire_type": questionnaire_type,
                "participant_id": participant_id,
                "created_at": created_at,
            },
        )


def main() -> None:
    ensure_database()
    server = ThreadingHTTPServer(("0.0.0.0", 8011), QuestionnaireHandler)
    print("Questionnaire tool running at http://localhost:8011")
    print("Pre-test:  http://localhost:8011/pretest/")
    print("Post-test: http://localhost:8011/posttest/")
    server.serve_forever()


if __name__ == "__main__":
    main()

