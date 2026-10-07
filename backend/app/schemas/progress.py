from datetime import date

from pydantic import BaseModel


class DailyProgressOut(BaseModel):
    date: date
    done: int
    not_done: int
    meaningful: int


class ProgressDailyOut(BaseModel):
    timezone: str
    start: date
    end: date
    # Only days with a finished task or a reflection; missing days are empty.
    days: list[DailyProgressOut]
