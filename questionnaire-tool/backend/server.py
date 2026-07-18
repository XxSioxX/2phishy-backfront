from __future__ import annotations

import json
import sqlite3
import re
import secrets
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen


ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
DB_DIR = ROOT_DIR / "backend" / "data"
DB_PATH = DB_DIR / "questionnaire_submissions.sqlite3"

QUESTIONNAIRE_FORMS = {
    # Both forms are single-page (one section), so pageHistory must be just "0".
    # Any larger value (e.g. "0,1,2,3,4") makes Google reject the whole submission
    # with HTTP 400, so page_history_count is 1 => range(1) => pageHistory="0".
    "pretest": {
        "view_url": "https://docs.google.com/forms/d/e/1FAIpQLSd0R0egqnpZtpO5jHGFuV0Nv_wDr_IFCNtVwpXDqAkJBaMU5Q/viewform?usp=header",
        "page_history_count": 1,
    },
    "posttest": {
        "view_url": "https://docs.google.com/forms/d/e/1FAIpQLSd3QliZOYKICcbaOIcvXFOp--sv9Rf3fXqeau2boySgaOFj5g/viewform?usp=header",
        "page_history_count": 1,
    },
}


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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS seeker_marks (
                id TEXT PRIMARY KEY,
                seeker_mark TEXT NOT NULL UNIQUE,
                user_agent TEXT,
                referrer TEXT,
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


def fetch_fbzx(view_url: str) -> str:
    try:
        with urlopen(view_url, timeout=10) as response:
            html = response.read().decode("utf-8", errors="ignore")
        patterns = [
            r'name="fbzx" value="([^"]+)"',
            r'fbzx"[^>]*value="([^"]+)"',
            r'fbzx=([^"&]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                return match.group(1)
    except Exception:
        return ""
    return ""


def generate_seeker_mark() -> str:
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    token = "".join(secrets.choice(alphabet) for _ in range(4))
    return f"SKR-{token}"


def issue_seeker_mark(user_agent: str = "", referrer: str = "") -> dict:
    created_at = datetime.now(timezone.utc).isoformat()

    with sqlite3.connect(DB_PATH) as conn:
        for _ in range(100):
            seeker_mark = generate_seeker_mark()
            issue_id = str(uuid.uuid4())
            try:
                conn.execute(
                    """
                    INSERT INTO seeker_marks (
                        id, seeker_mark, user_agent, referrer, created_at
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        issue_id,
                        seeker_mark,
                        user_agent,
                        referrer,
                        created_at,
                    ),
                )
                conn.commit()
                return {
                    "id": issue_id,
                    "seeker_mark": seeker_mark,
                    "created_at": created_at,
                }
            except sqlite3.IntegrityError:
                continue

    raise RuntimeError("Failed to issue a unique Seeker Mark")


def list_seeker_marks(search: str = "", limit: int = 200) -> list[dict]:
    query = """
        SELECT seeker_mark, created_at, user_agent, referrer
        FROM seeker_marks
    """
    params: list[object] = []

    search = search.strip()
    if search:
        query += """
            WHERE seeker_mark LIKE ? OR created_at LIKE ? OR user_agent LIKE ? OR referrer LIKE ?
        """
        like = f"%{search}%"
        params.extend([like, like, like, like])

    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(query, params).fetchall()

    return [
        {
            "seeker_mark": row["seeker_mark"],
            "created_at": row["created_at"],
            "user_agent": row["user_agent"],
            "referrer": row["referrer"],
        }
        for row in rows
    ]


class QuestionnaireHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def end_headers(self):  # noqa: N802
        # Never let the browser cache the frontend assets. Otherwise an edit to
        # app.js / questionnaire-data.js is masked by a stale 304-cached copy and
        # the user keeps running old code (e.g. a since-fixed Google Forms bug).
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def do_GET(self):  # noqa: N802
        # Drop conditional-request headers so SimpleHTTPRequestHandler always
        # returns a fresh 200 for static files instead of a 304 from cache.
        for header in ("If-Modified-Since", "If-None-Match"):
            if header in self.headers:
                del self.headers[header]

        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.send_response(HTTPStatus.SEE_OTHER)
            self.send_header("Location", "/seeker/")
            self.end_headers()
            return

        if parsed.path == "/seeker":
            self.send_response(HTTPStatus.SEE_OTHER)
            self.send_header("Location", "/seeker/")
            self.end_headers()
            return

        if parsed.path == "/seeker-log":
            self.send_response(HTTPStatus.SEE_OTHER)
            self.send_header("Location", "/seeker-log/")
            self.end_headers()
            return

        if parsed.path == "/api/health":
            json_response(self, HTTPStatus.OK, {"status": "ok"})
            return

        if parsed.path == "/api/seeker-marks":
            from urllib.parse import parse_qs

            query = parse_qs(parsed.query or "")
            search = (query.get("q", [""])[0] or "").strip()
            try:
                limit = int((query.get("limit", ["200"])[0] or "200").strip())
            except ValueError:
                limit = 200
            limit = max(1, min(limit, 500))
            items = list_seeker_marks(search=search, limit=limit)

            json_response(
                self,
                HTTPStatus.OK,
                {
                    "items": items,
                    "count": len(items),
                },
            )
            return

        if parsed.path == "/api/google-forms/meta":
            from urllib.parse import parse_qs

            query = parse_qs(parsed.query or "")
            questionnaire_type = (query.get("questionnaire_type", [""])[0] or "").strip().lower()
            form_config = QUESTIONNAIRE_FORMS.get(questionnaire_type)
            if not form_config:
                json_response(
                    self,
                    HTTPStatus.BAD_REQUEST,
                    {"detail": "questionnaire_type must be pretest or posttest"},
                )
                return

            fbzx = fetch_fbzx(form_config["view_url"])
            hidden_fields = {
                "fvv": 1,
                "draftResponse": "[null,null,\"%s\"]" % fbzx,
                "partialResponse": "[null,null,\"%s\"]" % fbzx,
                "pageHistory": ",".join(str(i) for i in range(form_config["page_history_count"])),
                "fbzx": fbzx,
                "submissionTimestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
                "dlut": int(datetime.now(timezone.utc).timestamp() * 1000),
            }
            json_response(
                self,
                HTTPStatus.OK,
                {
                    "questionnaire_type": questionnaire_type,
                    "fbzx": fbzx,
                    "hidden_fields": hidden_fields,
                },
            )
            return

        if parsed.path == "/api/seeker-marks":
            json_response(
                self,
                HTTPStatus.METHOD_NOT_ALLOWED,
                {"detail": "Use POST to issue a Seeker Mark"},
            )
            return

        super().do_GET()

    def do_POST(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/seeker-marks":
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length) if content_length else b""

            referrer = self.headers.get("Referer", "")
            if raw_body:
                try:
                    payload = json.loads(raw_body.decode("utf-8") or "{}")
                except json.JSONDecodeError:
                    payload = {}
                referrer = str(payload.get("referrer") or referrer)

            try:
                result = issue_seeker_mark(
                    user_agent=self.headers.get("User-Agent", ""),
                    referrer=referrer,
                )
            except RuntimeError as error:
                json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"detail": str(error)})
                return

            json_response(
                self,
                HTTPStatus.CREATED,
                {
                    "status": "success",
                    "seeker_mark": result["seeker_mark"],
                    "created_at": result["created_at"],
                },
            )
            return

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
    print("Seeker portal: http://localhost:8011/seeker/")
    print("Seeker log:    http://localhost:8011/seeker-log/")
    print("Pre-test:  http://localhost:8011/pretest/")
    print("Post-test: http://localhost:8011/posttest/")
    server.serve_forever()


if __name__ == "__main__":
    main()
