"""Plain-language times at the end of a Telegram message."""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from app.services.when import split_title_and_time

IST = ZoneInfo("Asia/Kolkata")
# Wednesday 7 October 2026, 10:30 in India.
NOW = datetime(2026, 10, 7, 10, 30, tzinfo=IST)


def at(day: int, hour: int, minute: int = 0, month: int = 10) -> datetime:
    return datetime(2026, month, day, hour, minute, tzinfo=IST)


@pytest.mark.parametrize(
    ("text", "title", "when"),
    [
        ("Call mom tomorrow 6pm", "Call mom", at(8, 18)),
        ("Call mom tomorrow at 6:30 pm", "Call mom", at(8, 18, 30)),
        ("Call mom tomorrow", "Call mom", at(8, 9)),  # a day alone means 9:00
        ("Pay rent today 5pm", "Pay rent", at(7, 17)),
        ("Stretch tonight", "Stretch", at(7, 20)),
        ("Review notes in 20 minutes", "Review notes", at(7, 10, 50)),
        ("Review notes in 2 hours", "Review notes", at(7, 12, 30)),
        ("Gym 18:00", "Gym", at(7, 18)),
        ("Gym 6.30pm", "Gym", at(7, 18, 30)),
        ("Gym at 6 p.m.", "Gym", at(7, 18)),
        ("Lunch with Sam noon", "Lunch with Sam", at(7, 12)),
        ("Plan the week friday", "Plan the week", at(9, 9)),
        ("Plan the week fri 4pm", "Plan the week", at(9, 16)),
        ("Plan the week next friday", "Plan the week", at(9, 9)),
        ("Journal evening", "Journal", at(7, 18)),
        ("Water plants, tomorrow morning", "Water plants", at(8, 9)),
        ("Call mom at 6", "Call mom", at(7, 18)),  # next 6 o'clock after 10:30 is 18:00
    ],
)
def test_understands_a_trailing_time(text, title, when):
    parsed = split_title_and_time(text, NOW)
    assert (parsed.title, parsed.when) == (title, when)


@pytest.mark.parametrize(
    "text",
    [
        "Read 15 minutes",  # a duration, not a time: needs "in"
        "Read chapter 6",  # a bare number needs "at"
        "Morning pages",  # time words only count at the end
        "Write 2000 words",
        "tomorrow",  # nothing left for a title
        "Fix the 25:00 bug",
    ],
)
def test_leaves_titles_without_a_time_alone(text):
    parsed = split_title_and_time(text, NOW)
    assert parsed.when is None and parsed.title == text


def test_a_past_time_today_rolls_to_tomorrow():
    assert split_title_and_time("Meditate 9am", NOW).when == at(8, 9)


def test_todays_weekday_means_today_if_still_ahead_else_next_week():
    assert split_title_and_time("Standup wednesday 11am", NOW).when == at(7, 11)
    assert split_title_and_time("Standup wednesday 9am", NOW).when == at(14, 9)
    assert split_title_and_time("Standup next wednesday", NOW).when == at(14, 9)


def test_results_are_in_the_callers_zone():
    utc_now = NOW.astimezone(ZoneInfo("UTC"))
    when = split_title_and_time("Call mom tomorrow 6pm", utc_now).when
    assert when.utcoffset().total_seconds() == 0 and when.hour == 18


@pytest.mark.parametrize("text", ["Nap in 0 minutes", "Nap in 999 hours", "Nap 13pm"])
def test_out_of_range_values_are_not_times(text):
    assert split_title_and_time(text, NOW).when is None
