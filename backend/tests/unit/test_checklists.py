"""Checklists in the task journal: tick timing, input cleaning, ownership."""

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.checklists import get_owned_checklist, get_owned_item, set_item_completed
from app.schemas.checklist import (
    MAX_CHECKLIST_ITEMS,
    ChecklistCreate,
    ChecklistItemCreate,
    ChecklistItemUpdate,
)

NOW = datetime(2026, 10, 7, 9, 0, tzinfo=timezone.utc)


def item(completed_at=None):
    return SimpleNamespace(completed_at=completed_at)


def test_ticking_records_when():
    open_item = item()
    set_item_completed(open_item, True, NOW)
    assert open_item.completed_at == NOW


def test_ticking_again_keeps_the_original_time():
    # A double tap or a retried request must not move the "done at" time.
    ticked = item(NOW)
    set_item_completed(ticked, True, NOW + timedelta(hours=2))
    assert ticked.completed_at == NOW


def test_unticking_clears_the_time():
    ticked = item(NOW)
    set_item_completed(ticked, False, NOW + timedelta(hours=2))
    assert ticked.completed_at is None


def test_create_drops_blank_rows_and_blank_title():
    data = ChecklistCreate(title="   ", items=[" Find a quiet space ", "", "  ", "Get a mat"])
    assert data.title is None
    assert data.items == ["Find a quiet space", "Get a mat"]


@pytest.mark.parametrize(
    "items",
    [[], ["", "   "], ["x" * 501], ["item"] * (MAX_CHECKLIST_ITEMS + 1)],
)
def test_create_rejects_empty_overlong_or_too_many(items):
    with pytest.raises(ValidationError):
        ChecklistCreate(items=items)


def test_item_text_is_trimmed_and_cannot_be_blank():
    assert ChecklistItemCreate(text="  Light incense ").text == "Light incense"
    with pytest.raises(ValidationError):
        ChecklistItemCreate(text="   ")
    with pytest.raises(ValidationError):
        ChecklistItemUpdate(text="   ")


def test_update_accepts_tick_alone():
    data = ChecklistItemUpdate(completed=True)
    assert data.text is None and data.completed is True


class EmptyQuery:
    """What a query filtered by another user's id finds: nothing."""

    def filter(self, *_args):
        return self

    def first(self):
        return None


class EmptySession:
    def query(self, _model):
        return EmptyQuery()


@pytest.mark.parametrize("lookup", [get_owned_checklist, get_owned_item])
def test_someone_elses_checklist_is_not_found(lookup):
    with pytest.raises(HTTPException) as exc:
        lookup(uuid.uuid4(), SimpleNamespace(id=uuid.uuid4()), EmptySession())
    assert exc.value.status_code == 404
