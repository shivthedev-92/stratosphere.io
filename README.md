# Stratosphere — Productivity App

A habit-building and life-coaching app. See [`system-prompt.txt`](./system-prompt.txt) for the full product vision.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind |
| Backend | FastAPI + SQLAlchemy 2 + Alembic |
| Database | PostgreSQL 16 |
| Auth | JWT + bcrypt (own-rolled) |
| AI Coach | Ollama (default) · Anthropic API (optional) |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (for Postgres)
- Python 3.12 + [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Node 20+
- [Ollama](https://ollama.com/download) — for the AI coach

---

## First-time setup

### 1. Pull the AI model
```bash
ollama pull llama3.1:8b
```

### 2. Start Postgres
```bash
docker compose up -d
```

### 3. Backend
```bash
cd backend

# Install dependencies
uv sync

# Copy env and fill in JWT_SECRET (run: python -c "import secrets; print(secrets.token_hex(32))")
cp .env.example .env

# Run migrations
uv run alembic upgrade head

# Start the API server
uv run uvicorn app.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

### 4. Frontend
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
# → http://localhost:3000
```

---

## Using the app

1. Open `http://localhost:3000`
2. Click **Get started** → create an account
3. You land on the dashboard
4. Add action items for the day, then use **Reflect** to log what went well or what got in the way
5. Click **Life Coach** to chat with the AI coach

---

## Switching to the Anthropic API

> **Note:** Anthropic Pro (claude.ai) does **not** include API access. Fund separately at [console.anthropic.com](https://console.anthropic.com).

In `backend/.env`:
```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-7
```

Restart the backend. No code changes needed.

---

## Project layout

```
productivity-app/
├── system-prompt.txt      Product spec (source of truth)
├── BUILD_PLAN.md          Implementation handoff doc
├── docker-compose.yml     Postgres for local dev
├── backend/               FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── api/           Routes: auth, me, goals, chat
│   │   ├── models/        SQLAlchemy models: users, goals, goal logs
│   │   ├── schemas/       Pydantic schemas
│   │   ├── services/      AI coach (Ollama + Anthropic)
│   │   ├── config.py      Settings from env
│   │   ├── db.py          Engine + session
│   │   ├── security.py    JWT + bcrypt
│   │   └── deps.py        FastAPI dependencies
│   └── alembic/           Migrations
└── frontend/              Next.js app
    └── src/app/
        ├── page.tsx        Landing
        ├── (auth)/        Login + Signup
        ├── dashboard/     Protected dashboard
        └── chat/          AI life coach chat
```
