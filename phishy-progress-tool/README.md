# Phishy Progress Tool

Standalone temporary web UI for resetting selected game-test users.

It supports:

- login with one tool username/password from `.env`
- preview before delete
- reset all progress for a selected user
- reset one level/topic for a selected user
- Mongo deletion limited to `progress` and `initial_assessments`
- username-to-UUID lookup through Postgres `users`

## Droplet setup

Copy this folder to the droplet, then create `.env` from `.env.example`.

Use your Mongo credentials in `.env`:

```env
MONGO_USER=admin
MONGO_PASSWORD=your-mongo-password
```

Set a tool login that is only for this reset panel:

```env
TOOL_USERNAME=your-tool-login
TOOL_PASSWORD=your-strong-tool-password
SESSION_SECRET=generate-a-long-random-string
```

If your main compose project network is not `deploy_default`, change it in `docker-compose.phishytool.yml`.

Run:

```bash
docker compose -f docker-compose.phishytool.yml up -d --build
```

The app listens only on droplet localhost at `127.0.0.1:8088`. Put Nginx in front of it for `phishytool.tech`.

## Nginx sketch

```nginx
server {
    server_name phishytool.tech;

    location / {
        proxy_pass http://127.0.0.1:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then run Certbot for HTTPS.

## Reset behavior

All progress:

- deletes the user's document from Mongo `progress`
- deletes the user's document from Mongo `initial_assessments`

One level:

- unsets `progress.<topic>` from Mongo `progress`
- unsets `assessments.<topic>` from Mongo `initial_assessments`

The tool does not delete the Postgres user account.
