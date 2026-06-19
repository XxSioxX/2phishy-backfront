import html
import os
import secrets
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote_plus

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pymongo import MongoClient
from starlette.middleware.sessions import SessionMiddleware


APP_TITLE = "Phishy Progress Tool"

TOPICS = {
    "Safe Browsing Practices": "Safe Browsing Practices",
    "Password Security": "Password Security",
    "Malware": "Malware",
    "Social Engineering": "Social Engineering",
    "Incident Response": "Incident Response",
}

app = FastAPI(title=APP_TITLE)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SESSION_SECRET", "dev-change-me"),
    same_site="lax",
    https_only=os.environ.get("SESSION_HTTPS_ONLY", "false").lower() == "true",
)


@dataclass
class GameUser:
    userid: str
    username: str
    email: str | None = None


def require_config(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def allowed_game_users() -> list[str]:
    raw = os.environ.get("ALLOWED_GAME_USERS", "xxsioxx,mafu")
    return [item.strip() for item in raw.split(",") if item.strip()]


def mongo_client() -> MongoClient:
    user = quote_plus(require_config("MONGO_USER"))
    password = quote_plus(require_config("MONGO_PASSWORD"))
    host = os.environ.get("MONGO_HOST", "mongo")
    port = os.environ.get("MONGO_PORT", "27017")
    auth_source = os.environ.get("MONGO_AUTH_SOURCE", "admin")
    uri = f"mongodb://{user}:{password}@{host}:{port}/?authSource={auth_source}"
    return MongoClient(uri, serverSelectionTimeoutMS=5000)


def mongo_db():
    return mongo_client()[os.environ.get("MONGO_DB_NAME", "phishy_game")]


@contextmanager
def pg_conn():
    conn = psycopg2.connect(require_config("DATABASE_POSTGRES_URL"))
    try:
        yield conn
    finally:
        conn.close()


def fetch_user(username: str) -> GameUser | None:
    if username not in allowed_game_users():
        return None

    with pg_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "select userid::text, username, email from users where username = %s",
                (username,),
            )
            row = cur.fetchone()

    if not row:
        return None

    return GameUser(
        userid=str(row["userid"]),
        username=str(row["username"]),
        email=row.get("email"),
    )


def normalize_for_preview(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): normalize_for_preview(v) for k, v in value.items()}
    if isinstance(value, list):
        return [normalize_for_preview(v) for v in value]
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return str(value) if not isinstance(value, (str, int, float, bool, type(None))) else value


def summarize_user_state(user_id: str, topic: str | None) -> dict[str, Any]:
    db = mongo_db()
    progress_doc = db["progress"].find_one({"user_id": user_id})
    assessment_doc = db["initial_assessments"].find_one({"user_id": user_id})

    if topic:
        progress_scope = (progress_doc or {}).get("progress", {}).get(topic)
        assessment_scope = (assessment_doc or {}).get("assessments", {}).get(topic)
    else:
        progress_scope = (progress_doc or {}).get("progress")
        assessment_scope = (assessment_doc or {}).get("assessments")

    progress_answers = []
    if isinstance(progress_scope, dict):
        progress_answers = progress_scope.get("answers", [])

    assessment_qmap = []
    if isinstance(assessment_scope, dict):
        assessment_qmap = assessment_scope.get("question_map", [])

    return {
        "progress_doc_exists": progress_doc is not None,
        "assessment_doc_exists": assessment_doc is not None,
        "progress_scope_exists": progress_scope is not None,
        "assessment_scope_exists": assessment_scope is not None,
        "answer_count": len(progress_answers) if isinstance(progress_answers, list) else 0,
        "question_map_count": len(assessment_qmap) if isinstance(assessment_qmap, list) else 0,
        "current_zone": progress_scope.get("current_zone") if isinstance(progress_scope, dict) else None,
        "unlocked_zone": progress_scope.get("unlocked_zone") if isinstance(progress_scope, dict) else None,
        "level_completed": progress_scope.get("level_completed") if isinstance(progress_scope, dict) else None,
        "progress_preview": normalize_for_preview(progress_scope),
        "assessment_preview": normalize_for_preview(assessment_scope),
    }


def apply_reset(user_id: str, topic: str | None) -> dict[str, int]:
    db = mongo_db()

    if topic:
        progress_result = db["progress"].update_one(
            {"user_id": user_id},
            {"$unset": {f"progress.{topic}": ""}},
        )
        assessment_result = db["initial_assessments"].update_one(
            {"user_id": user_id},
            {"$unset": {f"assessments.{topic}": ""}},
        )
        return {
            "progress_matched": progress_result.matched_count,
            "progress_modified": progress_result.modified_count,
            "assessment_matched": assessment_result.matched_count,
            "assessment_modified": assessment_result.modified_count,
        }

    progress_result = db["progress"].delete_one({"user_id": user_id})
    assessment_result = db["initial_assessments"].delete_one({"user_id": user_id})
    return {
        "progress_deleted": progress_result.deleted_count,
        "assessment_deleted": assessment_result.deleted_count,
    }


def is_logged_in(request: Request) -> bool:
    return bool(request.session.get("logged_in"))


def csrf_token(request: Request) -> str:
    token = request.session.get("csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        request.session["csrf_token"] = token
    return token


def check_csrf(request: Request, token: str) -> bool:
    return secrets.compare_digest(str(request.session.get("csrf_token", "")), token)


def page(content: str, request: Request, message: str = "") -> HTMLResponse:
    escaped_message = html.escape(message)
    logout = '<a class="link" href="/logout">Logout</a>' if is_logged_in(request) else ""
    return HTMLResponse(
        f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{APP_TITLE}</title>
  <style>
    :root {{
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f4f6f8;
      color: #18202a;
    }}
    body {{ margin: 0; }}
    header {{
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      background: #ffffff;
      border-bottom: 1px solid #d8dee6;
    }}
    main {{
      width: min(1040px, calc(100vw - 32px));
      margin: 24px auto;
    }}
    h1 {{ font-size: 20px; margin: 0; }}
    h2 {{ font-size: 18px; margin: 0 0 16px; }}
    .panel {{
      background: #ffffff;
      border: 1px solid #d8dee6;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
    }}
    label {{ display: block; font-weight: 650; margin: 14px 0 6px; }}
    input, select {{
      width: 100%;
      box-sizing: border-box;
      min-height: 40px;
      border: 1px solid #b9c3cf;
      border-radius: 6px;
      padding: 8px 10px;
      font: inherit;
      background: #ffffff;
    }}
    button {{
      margin-top: 16px;
      min-height: 40px;
      border: 0;
      border-radius: 6px;
      padding: 8px 14px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      background: #1f6feb;
      color: #ffffff;
    }}
    button.danger {{ background: #b42318; }}
    .grid {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }}
    .message {{
      background: #eef6ff;
      border: 1px solid #9fc9ff;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
    }}
    .warning {{
      background: #fff4e5;
      border: 1px solid #f3bd63;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
    }}
    dl {{ display: grid; grid-template-columns: 180px 1fr; gap: 8px 12px; margin: 0; }}
    dt {{ font-weight: 700; }}
    dd {{ margin: 0; word-break: break-word; }}
    pre {{
      overflow: auto;
      max-height: 360px;
      padding: 12px;
      border-radius: 6px;
      background: #111827;
      color: #e5e7eb;
      font-size: 13px;
    }}
    .link {{ color: #1f6feb; text-decoration: none; font-weight: 700; }}
    @media (max-width: 760px) {{
      header {{ padding: 0 16px; }}
      .grid {{ grid-template-columns: 1fr; }}
      dl {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <header><h1>{APP_TITLE}</h1>{logout}</header>
  <main>
    {f'<div class="message">{escaped_message}</div>' if message else ''}
    {content}
  </main>
</body>
</html>"""
    )


def login_form(request: Request, message: str = "") -> HTMLResponse:
    token = csrf_token(request)
    return page(
        f"""
<section class="panel">
  <h2>Login</h2>
  <form method="post" action="/login">
    <input type="hidden" name="csrf" value="{html.escape(token)}">
    <label for="username">Username</label>
    <input id="username" name="username" autocomplete="username" required>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">Login</button>
  </form>
</section>
""",
        request,
        message,
    )


def dashboard(request: Request, message: str = "") -> HTMLResponse:
    token = csrf_token(request)
    users = "".join(
        f'<option value="{html.escape(username)}">{html.escape(username)}</option>'
        for username in allowed_game_users()
    )
    topics = "".join(
        f'<option value="{html.escape(value)}">{html.escape(label)}</option>'
        for label, value in TOPICS.items()
    )
    return page(
        f"""
<section class="panel">
  <h2>Prepare Reset</h2>
  <form method="post" action="/preview">
    <input type="hidden" name="csrf" value="{html.escape(token)}">
    <label for="username">Game User</label>
    <select id="username" name="username" required>{users}</select>
    <label for="action">Reset Action</label>
    <select id="action" name="action" required>
      <option value="all">All progress</option>
      <option value="level">One level only</option>
    </select>
    <label for="topic">Level</label>
    <select id="topic" name="topic">{topics}</select>
    <button type="submit">Preview Matching Records</button>
  </form>
</section>
<section class="warning">
  This tool never deletes the Postgres user account. It only touches Mongo collections
  <strong>progress</strong> and <strong>initial_assessments</strong>.
</section>
""",
        request,
        message,
    )


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    if not is_logged_in(request):
        return login_form(request)
    return dashboard(request)


@app.post("/login")
def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    csrf: str = Form(...),
):
    if not check_csrf(request, csrf):
        return login_form(request, "Invalid session token.")

    expected_username = require_config("TOOL_USERNAME")
    expected_password = require_config("TOOL_PASSWORD")
    if secrets.compare_digest(username, expected_username) and secrets.compare_digest(password, expected_password):
        request.session["logged_in"] = True
        request.session["csrf_token"] = secrets.token_urlsafe(32)
        return RedirectResponse("/", status_code=303)

    return login_form(request, "Invalid login.")


@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/", status_code=303)


@app.post("/preview", response_class=HTMLResponse)
def preview(
    request: Request,
    username: str = Form(...),
    action: str = Form(...),
    topic: str = Form(""),
    csrf: str = Form(...),
):
    if not is_logged_in(request):
        return RedirectResponse("/", status_code=303)
    if not check_csrf(request, csrf):
        return dashboard(request, "Invalid session token.")

    selected_topic = topic if action == "level" else None
    if action not in {"all", "level"}:
        return dashboard(request, "Invalid reset action.")
    if action == "level" and selected_topic not in TOPICS.values():
        return dashboard(request, "Invalid level.")

    user = fetch_user(username)
    if not user:
        return dashboard(request, f"User '{username}' is not allowed or was not found in Postgres.")

    summary = summarize_user_state(user.userid, selected_topic)
    token = csrf_token(request)
    scope = selected_topic or "ALL"
    return page(
        f"""
<section class="panel">
  <h2>Confirm Reset Preview</h2>
  <dl>
    <dt>Username</dt><dd>{html.escape(user.username)}</dd>
    <dt>User ID</dt><dd>{html.escape(user.userid)}</dd>
    <dt>Email</dt><dd>{html.escape(user.email or "")}</dd>
    <dt>Action</dt><dd>{html.escape(action)}</dd>
    <dt>Scope</dt><dd>{html.escape(scope)}</dd>
    <dt>Progress doc exists</dt><dd>{summary["progress_doc_exists"]}</dd>
    <dt>Assessment doc exists</dt><dd>{summary["assessment_doc_exists"]}</dd>
    <dt>Progress scope exists</dt><dd>{summary["progress_scope_exists"]}</dd>
    <dt>Assessment scope exists</dt><dd>{summary["assessment_scope_exists"]}</dd>
    <dt>Answer count</dt><dd>{summary["answer_count"]}</dd>
    <dt>Question map count</dt><dd>{summary["question_map_count"]}</dd>
    <dt>Current zone</dt><dd>{html.escape(str(summary["current_zone"]))}</dd>
    <dt>Unlocked zone</dt><dd>{html.escape(str(summary["unlocked_zone"]))}</dd>
    <dt>Level completed</dt><dd>{html.escape(str(summary["level_completed"]))}</dd>
  </dl>
</section>
<section class="grid">
  <div class="panel">
    <h2>Progress Preview</h2>
    <pre>{html.escape(repr(summary["progress_preview"]))}</pre>
  </div>
  <div class="panel">
    <h2>Assessment Preview</h2>
    <pre>{html.escape(repr(summary["assessment_preview"]))}</pre>
  </div>
</section>
<section class="warning">
  Review the preview before continuing. The next button performs the delete/unset operation.
</section>
<form method="post" action="/reset">
  <input type="hidden" name="csrf" value="{html.escape(token)}">
  <input type="hidden" name="username" value="{html.escape(user.username)}">
  <input type="hidden" name="action" value="{html.escape(action)}">
  <input type="hidden" name="topic" value="{html.escape(selected_topic or "")}">
  <button class="danger" type="submit">Confirm Reset</button>
  <a class="link" href="/">Cancel</a>
</form>
""",
        request,
    )


@app.post("/reset", response_class=HTMLResponse)
def reset(
    request: Request,
    username: str = Form(...),
    action: str = Form(...),
    topic: str = Form(""),
    csrf: str = Form(...),
):
    if not is_logged_in(request):
        return RedirectResponse("/", status_code=303)
    if not check_csrf(request, csrf):
        return dashboard(request, "Invalid session token.")

    selected_topic = topic if action == "level" else None
    if action not in {"all", "level"}:
        return dashboard(request, "Invalid reset action.")
    if action == "level" and selected_topic not in TOPICS.values():
        return dashboard(request, "Invalid level.")

    user = fetch_user(username)
    if not user:
        return dashboard(request, f"User '{username}' is not allowed or was not found in Postgres.")

    result = apply_reset(user.userid, selected_topic)
    scope = selected_topic or "ALL"
    print(
        f"[progress-tool] reset username={user.username} user_id={user.userid} "
        f"action={action} scope={scope} result={result}",
        flush=True,
    )

    return dashboard(request, f"Reset complete for {user.username}. Result: {result}")
