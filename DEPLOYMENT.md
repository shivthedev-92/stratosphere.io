# Stratosphere Deployment Guide

This setup is for a recruiter/demo deployment without buying a domain.

## Target Architecture

| Layer | Host | Notes |
| --- | --- | --- |
| Backend API | Render Web Service | FastAPI served by Uvicorn |
| Database | Render PostgreSQL | Alembic migrations run on service start |
| Web app | Netlify | Next.js promotional site and authenticated web app |
| Mobile app | Local Expo for now | Can point to Render API later |

## 1. Render Backend + Database

Use the root `render.yaml` blueprint, or create manually.

### Render Blueprint

1. Push this repo to GitHub.
2. In Render, choose **New > Blueprint**.
3. Select the repo.
4. Render should detect `render.yaml`.
5. Create the `stratosphere-api` web service and `stratosphere-db` database.

### Render Service Settings

If creating manually:

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Build command | `pip install -r requirements.txt` |
| Start command | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/health` |

### Required Render Environment Variables

| Key | Value |
| --- | --- |
| `DATABASE_URL` | Render PostgreSQL internal connection string |
| `JWT_SECRET` | Generate a long random secret |
| `JWT_ALGORITHM` | `HS256` |
| `JWT_EXPIRE_MINUTES` | `10080` |
| `CORS_ORIGINS` | Your Netlify URL, for example `https://your-site.netlify.app` |
| `AI_PROVIDER` | `ollama` for demo placeholder, or `anthropic` if using hosted API |
| `OLLAMA_HOST` | `http://localhost:11434` unless self-hosting Ollama |
| `OLLAMA_MODEL` | `hermes3:3b` |

Render's PostgreSQL URL can be `postgresql://...`; the backend normalizes it to `postgresql+psycopg://...`.

## 2. Netlify Frontend

1. In Netlify, choose **Add new site > Import an existing project**.
2. Select this repo.
3. Netlify should read `netlify.toml`.
4. Add environment variable:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Your Render API URL, for example `https://stratosphere-api.onrender.com` |

5. Deploy the site.

## 3. Connect CORS

After Netlify gives you a URL:

1. Copy the Netlify URL.
2. Go to Render `stratosphere-api > Environment`.
3. Set:

```text
CORS_ORIGINS=https://your-site.netlify.app
```

For multiple origins:

```text
CORS_ORIGINS=https://your-site.netlify.app,http://localhost:3000
```

4. Redeploy/restart the Render backend.

## 4. Demo Test Checklist

Test these on the Netlify URL:

1. Promotional page loads.
2. Contact sales/support form submits.
3. Signup creates a user.
4. Login works.
5. Dashboard loads.
6. Create action item.
7. Edit/delete action item.
8. Add journal reflection.
9. Notifications modal opens.
10. Profile settings opens.
11. Settings contact form submits.

## 5. AI Coach Demo Note

The AI coach currently defaults to local Ollama. Render free services do not include a local Ollama server.

For recruiter demo, keep the AI page visible but explain:

- The app has FastAPI-to-Ollama integration in local/dev mode.
- Production AI can be enabled later with a hosted model provider or a separate Ollama server.

If using Anthropic later, set:

```text
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=<your-api-key>
ANTHROPIC_MODEL=<chosen-model>
```

## 6. Useful Local Commands

Backend:

```bash
cd backend
uv run alembic upgrade head
uv run uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Frontend:

```bash
cd frontend
npm run build
npm run dev
```
