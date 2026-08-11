############################################################################
#    _____ __             __                   __                     _     
#   / ___// /__________ _/ /_____  _________  / /_  ___  ________    (_)___ 
#   \__ \/ __/ ___/ __ `/ __/ __ \/ ___/ __ \/ __ \/ _ \/ ___/ _ \  / / __ \
#  ___/ / /_/ /  / /_/ / /_/ /_/ (__  ) /_/ / / / /  __/ /  /  __/ / / /_/ /
# /____/\__/_/   \__,_/\__/\____/____/ .___/_/ /_/\___/_/   \___(_)_/\____/ 
#                                   /_/                                     
############################################################################
# Copyright (c) 2024. Sivarajan kakamaniyan. All rights reserved.
# Statosphere is a product of Sivarajan Kakamaniyan. 
# Unauthorized copying of this file, via any medium is strictly prohibited.
# Version 0.1.0 | 2024-06
############################################################################

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api import auth, chat, goals, me, notifications, support
from app.config import settings
from app.db import get_db
from app.rate_limit import RateLimitMiddleware

#====================#
# App Initialization |
#====================#

app = FastAPI(
    title="Productivity App API",
    version="0.1.0",
    docs_url="/docs" if settings.API_DOCS_ENABLED else None,
    redoc_url="/redoc" if settings.API_DOCS_ENABLED else None,
    openapi_url="/openapi.json" if settings.API_DOCS_ENABLED else None,
)

app.add_middleware(RateLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#============#
# App Routes |
#============#

app.include_router(auth.router)
app.include_router(me.router)
app.include_router(goals.router)
app.include_router(notifications.router)
app.include_router(chat.router)
app.include_router(support.router)

#=======================#
# Health Check Endpoint |
#=======================#

@app.get("/health")
def health() -> dict:
    """Liveness: the process is up. Cheap enough to poll frequently."""
    return {"ok": True}


@app.get("/health/ready")
def readiness(db: Session = Depends(get_db)) -> dict:
    """Readiness: dependencies are reachable. Point the Azure probe here."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        )
    return {"ok": True, "database": "up"}
