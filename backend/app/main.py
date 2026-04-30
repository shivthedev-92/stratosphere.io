from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, chat, goals, me
from app.config import settings

app = FastAPI(title="Productivity App API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(me.router)
app.include_router(goals.router)
app.include_router(chat.router)


@app.get("/health")
def health() -> dict:
    return {"ok": True}
