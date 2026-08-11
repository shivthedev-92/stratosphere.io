FROM python:3.12-slim AS runtime

COPY --from=ghcr.io/astral-sh/uv:0.11.16 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
ENV PATH="/app/.venv/bin:$PATH"

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

# Drop root. Matches the frontend image, which already runs as `node`.
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]
