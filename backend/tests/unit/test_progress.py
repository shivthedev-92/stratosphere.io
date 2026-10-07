"""GET /progress/daily: local-day grouping, parameter checks, auth."""

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

from app.db import get_db
from app.deps import get_current_user
from app.main import app

IST = ZoneInfo("Asia/Kolkata")


class FakeDB:
    """Answers the two queries in order: finished tasks, then reflections."""

    def __init__(self):
        self.finished = []
        self.rows = []
        self.statements = []

    def execute(self, statement):
        self.statements.append(statement)
        rows = self.finished if len(self.statements) == 1 else self.rows
        return SimpleNamespace(all=lambda: rows)


@pytest.fixture
def client():
    db = FakeDB()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=uuid.uuid4())
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app), db
    app.dependency_overrides.clear()


def at_ist(day_offset: int, hour: int, minute: int = 0) -> datetime:
    """A UTC timestamp for a local IST wall-clock time, day_offset days ago."""
    local = datetime.now(IST).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return (local - timedelta(days=day_offset)).astimezone(timezone.utc)


def test_done_counts_finished_tasks_and_reflections_fill_the_rest(client):
    http, db = client
    db.finished = [(at_ist(1, 10),), (at_ist(1, 20),), (at_ist(0, 9),)]
    db.rows = [
        (at_ist(1, 9), True, True),
        (at_ist(1, 13), True, None),
        (at_ist(1, 18), False, True),
        (at_ist(0, 8), True, False),
    ]
    body = http.get("/progress/daily", params={"tz": "Asia/Kolkata", "days": 7}).json()
    yesterday = (datetime.now(IST).date() - timedelta(days=1)).isoformat()
    today = datetime.now(IST).date().isoformat()
    assert body["days"] == [
        {"date": yesterday, "done": 2, "not_done": 1, "meaningful": 2},
        {"date": today, "done": 1, "not_done": 0, "meaningful": 0},
    ]


def test_finishing_a_task_without_reflecting_still_lights_the_day(client):
    http, db = client
    db.finished = [(at_ist(0, 11),)]
    days = http.get("/progress/daily", params={"tz": "Asia/Kolkata"}).json()["days"]
    assert days == [
        {"date": datetime.now(IST).date().isoformat(), "done": 1, "not_done": 0, "meaningful": 0}
    ]


def test_late_evening_counts_on_the_local_date_not_utc(client):
    # 23:30 in India is 18:00 UTC the same day, but 00:30 IST the next day is
    # still the previous UTC date: each must land on its own local date.
    http, db = client
    db.finished = [(at_ist(2, 23, 30),), (at_ist(1, 0, 30),)]
    days = http.get("/progress/daily", params={"tz": "Asia/Kolkata"}).json()["days"]
    local = datetime.now(IST).date()
    assert [d["date"] for d in days] == [
        (local - timedelta(days=2)).isoformat(),
        (local - timedelta(days=1)).isoformat(),
    ]


def test_accepts_legacy_zone_names_browsers_send(client):
    # Chrome reports India as "Asia/Calcutta"; Postgres builds may not know it.
    http, db = client
    db.finished = [(at_ist(0, 10),)]
    body = http.get("/progress/daily", params={"tz": "Asia/Calcutta"}).json()
    assert body["timezone"] == "Asia/Calcutta"
    assert body["days"][0]["done"] == 1


def test_query_is_bounded_by_user_and_time(client):
    http, db = client
    http.get("/progress/daily", params={"tz": "Asia/Kolkata"})
    finished, logs = (str(s.compile(dialect=postgresql.dialect())) for s in db.statements)
    assert "goals.user_id =" in finished and "goals.completed_at >=" in finished
    # Served by the (user_id, created_at) index; no time-zone work in SQL.
    assert "goal_logs.user_id =" in logs and "goal_logs.created_at >=" in logs
    assert "timezone(" not in finished + logs


@pytest.mark.parametrize(
    "params",
    [
        {"tz": "Mars/Olympus_Mons"},
        {"tz": "../../etc/passwd"},
        {"days": 0},
        {"days": 401},
    ],
)
def test_rejects_bad_parameters(client, params):
    http, _db = client
    assert http.get("/progress/daily", params=params).status_code == 422


def test_requires_sign_in():
    assert TestClient(app).get("/progress/daily").status_code == 401
