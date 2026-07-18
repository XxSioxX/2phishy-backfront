# Thesis Questionnaire Side Tool

Standalone questionnaire pages for the 2Phishy thesis.

## Layout

- `frontend/seeker/` — Seeker Mark landing portal
- `frontend/seeker-log/` — internal seeker registry page
- `frontend/pretest/` — pre-test questionnaire
- `frontend/posttest/` — post-test questionnaire
- `frontend/shared/` — reusable UI/data logic
- `backend/server.py` — lightweight local backend plus static file server

## Run

From the `questionnaire-tool` directory:

```bash
python3 backend/server.py
```

Then open:

- `http://localhost:8011/seeker/`
- `http://localhost:8011/seeker-log/`
- `http://localhost:8011/pretest/`
- `http://localhost:8011/posttest/`

The server stores submissions in:

- `backend/data/questionnaire_submissions.sqlite3`

The portal issues Seeker Marks through the backend and passes them into the pre-test and post-test pages using the `sid` query parameter.

The seeker registry page is link-only and is intended for internal use without participant access.

Deployment note: the frontend expects the backend API to be reachable at the same origin by default. If you host the frontend and backend separately in the cloud, set `window.QUESTIONNAIRE_API_BASE_URL` to the backend origin before loading the scripts.

If the seeker portal should redirect to a different pretest host, set `window.QUESTIONNAIRE_PRETEST_URL` before loading `frontend/seeker/app.js`. Otherwise it uses `/pretest/` on the current origin, which keeps the `sid` query parameter intact in same-origin deployments.

The frontend saves drafts to browser local storage by default and sends the final submission to:

1. the local backend, then
2. the published Google Forms endpoint as a backup.
