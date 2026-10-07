"""Progress data for the dashboard's year heatmap."""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.goal import Goal, GoalLog
from app.models.user import User
from app.schemas.progress import DailyProgressOut, ProgressDailyOut

router = APIRouter(prefix="/progress", tags=["progress"])

# A year of weeks plus the partial week at each end.
MAX_DAYS = 400


@router.get("/daily", response_model=ProgressDailyOut)
def daily_progress(
    tz: str = Query("UTC", max_length=64, description="IANA time zone, e.g. Asia/Kolkata"),
    days: int = Query(371, ge=1, le=MAX_DAYS),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProgressDailyOut:
    """Tasks finished and reflections written per local calendar day.

    "done" counts tasks by when they were marked complete, so finishing a
    task lights its day whether or not it was reflected on. "not_done" and
    "meaningful" come from reflections. Days are counted in the caller's
    time zone, so 23:30 in India lands on that date, not the next UTC one.
    """
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Unknown time zone") from exc

    end = datetime.now(zone).date()
    start = end - timedelta(days=days - 1)
    # Start of the first local day, as an absolute instant, for the index scan.
    since = datetime.combine(start, datetime.min.time(), tzinfo=zone).astimezone(timezone.utc)

    # Local days are worked out here, not in SQL: browsers report legacy
    # zone names (Chrome says "Asia/Calcutta") that Postgres may not know,
    # while Python's zoneinfo does. A year is a few thousand rows at most.
    finished = db.execute(
        select(Goal.completed_at).where(
            Goal.user_id == current_user.id,
            Goal.completed.is_(True),
            Goal.completed_at >= since,
        )
    ).all()
    logs = db.execute(
        select(GoalLog.created_at, GoalLog.completed, GoalLog.soulful).where(
            GoalLog.user_id == current_user.id, GoalLog.created_at >= since
        )
    ).all()

    totals: dict[date, list[int]] = defaultdict(lambda: [0, 0, 0])

    def local_day(instant: datetime) -> date | None:
        day = instant.astimezone(zone).date()
        return day if start <= day <= end else None

    for (completed_at,) in finished:
        if day := local_day(completed_at):
            totals[day][0] += 1
    for created_at, completed, soulful in logs:
        if not (day := local_day(created_at)):
            continue
        if not completed:
            totals[day][1] += 1
        if soulful is True:
            totals[day][2] += 1

    return ProgressDailyOut(
        timezone=tz,
        start=start,
        end=end,
        days=[
            DailyProgressOut(date=day, done=done, not_done=not_done, meaningful=meaningful)
            for day, (done, not_done, meaningful) in sorted(totals.items())
        ],
    )
