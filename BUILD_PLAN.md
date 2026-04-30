# Build Plan — POC First Slice

This is a self-contained handoff for a Claude Sonnet (or any agent) session to scaffold the first end-to-end slice of this productivity app. Follow the steps in order. Do not skip ahead.

## 0. Read these first
1. **`system-prompt.txt`** at repo root — the product spec (vision, features, guardrails, design notes). This is the source of truth for any product decision.
2. This file (`BUILD_PLAN.md`) — execution plan.

If `system-prompt.txt` and this file disagree, **stop and ask the user**. Do not infer.

## 1. Decisions already locked in (do not relitigate)

| Area | Decision |
|------|----------|
| Frontend | Next.js (App Router) + TypeScript + Tailwind |
| Backend | FastAPI + SQLAlchemy + Alembic |
| DB | Postgres (via docker-compose for local dev) |
| Auth | FastAPI + JWT + bcrypt (own-rolled, no Auth0/Clerk/Supabase) |
| AI provider | Provider-agnostic interface. **Ollama is the active default**; **Anthropic is templated but inactive**. Switch via `AI_PROVIDER=ollama\|anthropic` env var. |
| Ollama default model | `llama3.1:8b` (configurable via `OLLAMA_MODEL`) |
| Anthropic default model | `claude-opus-4-7` (configurable via `ANTHROPIC_MODEL`) |
| Python | 3.12 |
| Package manager (backend) | `uv` (preferred) or `pip` with `pyproject.toml` |

**Why Ollama default**: user does not have an Anthropic API key yet (their Anthropic Pro subscription is for claude.ai, not the API). They will fund the API later and flip the env var. Keep both providers shipped.

## 2. Out of scope for this slice (do NOT build yet)
- Goals, milestones, journal, location tracking, struggle pie chart, trendlines.
- Branching onboarding questionnaire (working pro / student / business owner).
- Streaming responses from the coach (return a single response for now).
- Production deploy, CI, tests beyond a smoke test.

The slice's only purpose is to prove the stack works end-to-end: signup → login → JWT-protected `/me` and `/chat` against the AI coach.

## 3. Repo layout to create

```
productivity-app/
├── system-prompt.txt          (already exists)
├── BUILD_PLAN.md              (this file)
├── README.md                  (write last)
├── docker-compose.yml
├── backend/
│   ├── pyproject.toml
│   ├── .env.example
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── config.py
│       ├── db.py
│       ├── security.py
│       ├── deps.py
│       ├── models/
│       │   ├── __init__.py
│       │   └── user.py
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   └── chat.py
│       ├── api/
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   ├── me.py
│       │   └── chat.py
│       └── services/
│           ├── __init__.py
│           └── ai_coach.py
└── frontend/                  (created via create-next-app — see step 7)
```

## 4. Steps

### Step 1 — Scaffold backend project structure
- Create `backend/pyproject.toml` with dependencies: `fastapi`, `uvicorn[standard]`, `sqlalchemy>=2`, `alembic`, `psycopg[binary]`, `passlib[bcrypt]`, `python-jose[cryptography]`, `pydantic>=2`, `pydantic-settings`, `python-dotenv`, `httpx`, `anthropic`. Dev: `ruff`, `pytest`.
- `app/config.py`: `pydantic-settings` `Settings` class reading: `DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM` (default `HS256`), `JWT_EXPIRE_MINUTES` (default `60*24*7`), `AI_PROVIDER` (default `ollama`), `OLLAMA_HOST` (default `http://localhost:11434`), `OLLAMA_MODEL` (default `llama3.1:8b`), `ANTHROPIC_API_KEY` (optional), `ANTHROPIC_MODEL` (default `claude-opus-4-7`), `CORS_ORIGINS` (default `http://localhost:3000`).
- `app/db.py`: SQLAlchemy 2.x engine + `SessionLocal` + `Base = declarative_base()` + `get_db()` generator.
- `app/main.py`: create FastAPI app, add CORS middleware from `settings.CORS_ORIGINS`, include routers from `api/auth.py`, `api/me.py`, `api/chat.py`. Add `GET /health` returning `{"ok": True}`.
- `backend/.env.example`: list every env var above with safe placeholders. **Never commit a real `.env`.**

**Acceptance**: `uvicorn app.main:app --reload` starts and `GET /health` returns 200.

### Step 2 — User model + Alembic
- `app/models/user.py`: `User` with `id` (UUID pk), `email` (unique, indexed), `name`, `age_group` (nullable for now — onboarding fills later), `career_track` (nullable), `hashed_password`, `created_at`.
- Initialize Alembic against `app.db.Base.metadata`. Configure `alembic/env.py` to read `DATABASE_URL` from `app.config.settings`.
- Generate migration `0001_create_users.py` with `alembic revision --autogenerate -m "create users"`.

**Acceptance**: `alembic upgrade head` creates the `users` table in Postgres.

### Step 3 — JWT auth endpoints
- `app/security.py`: `hash_password`, `verify_password` (passlib bcrypt); `create_access_token`, `decode_access_token` (python-jose).
- `app/deps.py`: `get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db))` that decodes the JWT and loads the User. 401 on invalid.
- `app/schemas/auth.py`: `SignupIn(email, password, name)`, `LoginIn(email, password)`, `TokenOut(access_token, token_type="bearer")`, `UserOut(id, email, name, created_at)`.
- `app/api/auth.py`: `POST /auth/signup` (creates user, returns token), `POST /auth/login` (verifies, returns token). 409 on duplicate email, 401 on bad creds.
- `app/api/me.py`: `GET /me` returns `UserOut` for the authenticated user.

**Acceptance**: `curl` flow — signup → receive token → `GET /me` with `Authorization: Bearer <token>` returns the user.

### Step 4 — AI coach service with provider abstraction
- `app/services/ai_coach.py`:
  - `class CoachProvider(Protocol)` with `async def reply(self, history: list[ChatMessage], user_message: str) -> str`.
  - `class OllamaCoach` — uses `httpx.AsyncClient` to POST to `{OLLAMA_HOST}/api/chat` with the configured model. Implement the system prompt (see below).
  - `class AnthropicCoach` — uses the `anthropic` SDK (`AsyncAnthropic`). Use `claude-opus-4-7`. **Add prompt caching** on the system prompt (`cache_control: {"type": "ephemeral"}`) — the life-coach persona is reused per user, so cache hits will dominate cost.
  - `def get_coach() -> CoachProvider` factory that returns the provider per `settings.AI_PROVIDER`. Raise a clear error if `anthropic` is selected but `ANTHROPIC_API_KEY` is unset.
- **Life-coach system prompt** must encode the spec's philosophy: guilt-free habit drop, behavior-based advice (not prescriptive), encourage finding moments where goals fit naturally rather than fixed times, acknowledge boredom/distraction/obstacles as normal, never manipulate. Pull the exact phrasing from `system-prompt.txt`.

**Acceptance**: `python -c "from app.services.ai_coach import get_coach; ..."` instantiates without error for both providers (with appropriate env).

### Step 5 — `/chat` endpoint
- `app/schemas/chat.py`: `ChatMessage(role: Literal["user","assistant"], content: str)`, `ChatIn(history: list[ChatMessage], message: str)`, `ChatOut(reply: str)`.
- `app/api/chat.py`: `POST /chat` protected by `get_current_user`. Calls `get_coach().reply(history, message)`. Return single response (no streaming this slice).

**Acceptance**: With Ollama running locally and `llama3.1:8b` pulled, `POST /chat` with a JWT returns a coherent coach-style reply.

### Step 6 — docker-compose with Postgres
- `docker-compose.yml` at repo root with one service: `postgres:16` exposing 5432, persistent named volume `pgdata`, env `POSTGRES_USER=app`, `POSTGRES_PASSWORD=app`, `POSTGRES_DB=productivity`.
- Update `backend/.env.example` `DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/productivity`.
- Do **not** dockerize backend or frontend in this slice — local `uvicorn` and `next dev` are simpler for now.

**Acceptance**: `docker compose up -d` starts Postgres; backend connects.

### Step 7 — Next.js frontend
- From repo root: `npx create-next-app@latest frontend --ts --tailwind --app --src-dir --import-alias "@/*" --no-eslint` (eslint optional, skip for speed).
- Pages:
  - `src/app/page.tsx` — landing with the spec's hero (motivational quote placeholder) and CTA to signup.
  - `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx` — minimal forms calling the backend.
  - `src/app/dashboard/page.tsx` — protected page that fetches `/me`. Show the spec's exact disclaimer line: *"A Success or a Failure in Goal is Defined only by you. Please use this data as a helper rather than a definition of what you are"*. Placeholders for goal table / map / pie chart (just labeled `<div>`s).
  - `src/app/chat/page.tsx` — simple chat UI that POSTs to `/chat` with the JWT.
- `src/lib/api.ts` — typed fetch wrapper that pulls JWT from `localStorage` (POC-grade; revisit storage strategy when we leave POC). Reads `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`).
- `frontend/.env.local.example` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.

**Acceptance**: `npm run dev` boots, signup → dashboard → `/me` data renders, `/chat` round-trips through Ollama.

### Step 8 — README
- Single `README.md` at repo root covering:
  1. What this app is (one paragraph; link to `system-prompt.txt`).
  2. Prereqs: Docker, Python 3.12 + `uv`, Node 20+, Ollama installed (`https://ollama.com/download`).
  3. First-time setup — pull model: `ollama pull llama3.1:8b`.
  4. Local run, in order: `docker compose up -d` → backend env + `alembic upgrade head` + `uvicorn` → frontend env + `npm run dev`.
  5. Switching to Anthropic: set `ANTHROPIC_API_KEY` and `AI_PROVIDER=anthropic`.
  6. Note: Anthropic Pro (claude.ai) does **not** include API access — use console.anthropic.com to fund.

## 5. Verification at the end of the slice

Run this manual smoke test before declaring done:
1. `docker compose up -d`
2. Backend up, `alembic upgrade head` ran clean.
3. Ollama running, `llama3.1:8b` pulled.
4. Frontend up at `localhost:3000`.
5. Signup new user → land on dashboard → see `/me` data → open chat → send "I want to build a reading habit but keep dropping it" → receive a reply consistent with the guilt-free / non-manipulative tone in `system-prompt.txt`.

## 6. Rules of engagement
- **Co-developer mode**: the user wrote the spec and wants to be consulted on architecture/scope changes. If a step requires a decision not covered here or in `system-prompt.txt`, stop and ask.
- **No scope creep**: do not build features listed in section 2. Resist the urge to add tests beyond a smoke test, CI, prod hardening, or to refactor.
- **Verify before claiming done**: actually run the smoke test in section 5. Type-checks and linters do not prove feature correctness.
- **Secrets**: never commit `.env`. Use `.env.example` files only.
- **Keep `system-prompt.txt` as the product source of truth.** If the user asks for a feature change, ask whether they want it reflected in `system-prompt.txt` first.
