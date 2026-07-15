# Thesis Questionnaire Side Tool

Standalone questionnaire pages for the 2Phishy thesis.

## Layout

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

- `http://localhost:8010/pretest/`
- `http://localhost:8010/posttest/`

The server stores submissions in:

- `backend/data/questionnaire_submissions.sqlite3`

The frontend saves drafts to browser local storage by default and sends the final submission to:

1. the local backend, then
2. the published Google Forms endpoint as a backup.

