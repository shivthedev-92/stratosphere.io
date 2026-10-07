"""Plain-language times at the end of a message: "Call mom tomorrow 6pm".

Deliberately small and predictable rather than clever. The time must come
last, so "Read 15 minutes" stays a title and "Call mom at 6" gets a time.
Supported:

  days    today, tonight, tomorrow (tmrw), monday..sunday (mon..sun), next <day>
  times   6pm, 6:30pm, 6.30 pm, 18:00, at 6, noon, midnight,
          morning, afternoon, evening, night
  spans   in 20 minutes, in 2 hours (min, mins, h, hr, hrs, hour, hours)

A day with no time means 9:00. A bare time that has already passed today
means tomorrow. Everything is computed in the caller's time zone.
"""

import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.config import settings

DEFAULT_TIME = time(9, 0)
MAX_SUFFIX_TOKENS = 6

WEEKDAYS = {
    name: index
    for index, names in enumerate(
        [
            ("monday", "mon"),
            ("tuesday", "tue", "tues"),
            ("wednesday", "wed"),
            ("thursday", "thu", "thur", "thurs"),
            ("friday", "fri"),
            ("saturday", "sat"),
            ("sunday", "sun"),
        ]
    )
    for name in names
}
PARTS_OF_DAY = {
    "morning": time(9, 0),
    "noon": time(12, 0),
    "afternoon": time(14, 0),
    "evening": time(18, 0),
    "night": time(20, 0),
    "midnight": time(0, 0),
}
MINUTE_UNITS = {"m", "min", "mins", "minute", "minutes"}
HOUR_UNITS = {"h", "hr", "hrs", "hour", "hours"}
CONNECTORS = {"at", "on", "by"}

CLOCK = re.compile(r"^(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$")


@dataclass(frozen=True)
class Parsed:
    title: str
    when: datetime | None  # aware, in the zone of `now`


def _clock(token: str, after_at: bool) -> tuple[time, bool] | None:
    """A clock token, and whether it said am/pm or was 24-hour explicitly."""
    match = CLOCK.match(token)
    if not match:
        return None
    hour, minute, meridiem = int(match[1]), int(match[2] or 0), match[3]
    if minute > 59:
        return None
    if meridiem:
        if not 1 <= hour <= 12:
            return None
        hour = hour % 12 + (12 if meridiem == "pm" else 0)
        return time(hour, minute), True
    if match[2] is not None and hour <= 23:  # "18:00", "6:30"
        return time(hour, minute), hour > 12
    if after_at and 0 <= hour <= 23:  # "at 6": only with "at", else it's a number
        return time(hour, minute), hour > 12
    return None


def _normalise(tokens: list[str]) -> list[str]:
    """Lowercase, trim punctuation, and join "6 pm" / "6 p.m." into "6pm"."""
    out: list[str] = []
    for raw in tokens:
        token = raw.lower().strip(",!?;").replace("a.m.", "am").replace("p.m.", "pm")
        token = token.rstrip(".")
        if token in ("am", "pm") and out and re.fullmatch(r"\d{1,2}(?:[:.]\d{2})?", out[-1]):
            out[-1] += token
        else:
            out.append(token)
    return out


def _next_weekday(today: date, weekday: int, allow_today: bool) -> date:
    days = (weekday - today.weekday()) % 7
    if days == 0 and not allow_today:
        days = 7
    return today + timedelta(days=days)


def _parse_suffix(tokens: list[str], now: datetime) -> datetime | None:
    if len(tokens) == 3 and tokens[0] == "in" and tokens[1].isdigit():
        amount = int(tokens[1])
        if tokens[2] in MINUTE_UNITS and 0 < amount <= 24 * 60:
            return now + timedelta(minutes=amount)
        if tokens[2] in HOUR_UNITS and 0 < amount <= 72:
            return now + timedelta(hours=amount)
        return None

    today = now.date()
    day: date | None = None
    weekday: int | None = None
    at: time | None = None
    explicit_meridiem = False
    i = 0
    while i < len(tokens):
        token = tokens[i]
        after_at = i > 0 and tokens[i - 1] == "at"
        if token in CONNECTORS:
            pass
        elif token == "today" and day is None and weekday is None:
            day = today
        elif token == "tonight" and day is None and weekday is None and at is None:
            day, at = today, PARTS_OF_DAY["night"]
        elif token in ("tomorrow", "tmrw", "tmr") and day is None and weekday is None:
            day = today + timedelta(days=1)
        elif token == "next" and i + 1 < len(tokens) and tokens[i + 1] in WEEKDAYS:
            if day is not None or weekday is not None:
                return None
            day = _next_weekday(today, WEEKDAYS[tokens[i + 1]], allow_today=False)
            i += 1
        elif token in WEEKDAYS and day is None and weekday is None:
            weekday = WEEKDAYS[token]
        elif token in PARTS_OF_DAY and at is None:
            at = PARTS_OF_DAY[token]
            explicit_meridiem = True
        elif (clock := _clock(token, after_at)) and at is None:
            at, explicit_meridiem = clock
        else:
            return None
        i += 1

    if day is None and weekday is None and at is None:
        return None
    zone = now.tzinfo

    if weekday is not None:
        target = _next_weekday(today, weekday, allow_today=True)
        moment = datetime.combine(target, at or DEFAULT_TIME, zone)
        return moment if moment > now else moment + timedelta(days=7)
    if day is not None:
        return datetime.combine(day, at or DEFAULT_TIME, zone)

    # A bare time: the next time the clock says it.
    assert at is not None
    candidates = [at]
    if not explicit_meridiem and at.hour < 12:  # "at 6" could be 6:00 or 18:00
        candidates.append(time(at.hour + 12, at.minute))
    moments = [datetime.combine(today, t, zone) for t in candidates]
    moments += [m + timedelta(days=1) for m in moments]
    return min(m for m in moments if m > now)


def split_title_and_time(text: str, now: datetime) -> Parsed:
    """Split "Call mom tomorrow 6pm" into a title and an aware datetime.

    Tries the longest trailing phrase first, and only accepts one that
    leaves a non-empty title. `now` must be timezone-aware.
    """
    raw = text.split()
    for size in range(min(MAX_SUFFIX_TOKENS, len(raw) - 1), 0, -1):
        title_tokens = raw[:-size]
        when = _parse_suffix(_normalise(raw[-size:]), now)
        if when is None:
            continue
        while title_tokens and title_tokens[-1].lower().strip(",") in CONNECTORS:
            title_tokens = title_tokens[:-1]
        title = " ".join(title_tokens).rstrip(" ,-–—")
        if title:
            return Parsed(title, when)
    return Parsed(text.strip(), None)


def zone_for(name: str | None) -> ZoneInfo:
    """The user's zone, or the app default for unknown or missing names."""
    try:
        return ZoneInfo(name or settings.DEFAULT_TIMEZONE)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(settings.DEFAULT_TIMEZONE)
