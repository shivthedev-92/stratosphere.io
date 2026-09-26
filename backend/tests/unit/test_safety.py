"""Crisis detection rules.

The false-positive block matters as much as the true-positive block: a
productivity app is full of violent idiom ("this deadline is killing me"),
and a matcher that fires on those trains users to ignore the one message
that counts.
"""

import pytest

from app.services.safety import (
    CRISIS_MESSAGE,
    EMERGENCY_NUMBER,
    INDIA_RESOURCES,
    detect_crisis,
)

#=========================#
# Must fire (true positive)|
#=========================#

@pytest.mark.parametrize(
    "text",
    [
        "i want to kill myself",
        "I have been thinking about killing myself",
        "sometimes I just want to end my life",
        "I want to end it all",
        "thinking of taking my own life",
        "I feel suicidal",
        "is suicide the only option",
        "I want to die",
        "honestly I wanna die",
        "everyone would be better off without me",
        "I'm better off dead",
        "there is no reason to live anymore",
        "I have nothing to live for",
        "I don't want to be here anymore",
        "I dont want to wake up",
        "I've been self harming",
        "I self-harm when it gets bad",
        "I want to hurt myself",
        "I've been cutting myself",
        "I thought about an overdose",
        "I just want to end my suffering",
    ],
)
def test_detects_crisis(text: str) -> None:
    assert detect_crisis(text) is not None, f"MISSED: {text!r}"


#===============================#
# Must NOT fire (false positive)|
#===============================#

@pytest.mark.parametrize(
    "text",
    [
        # Violent idiom, extremely common in a productivity context
        "this deadline is killing me",
        "the commute is killing me",
        "I'm dying to finish this project",
        "I'm dead tired after today",
        "let's kill this task today",
        "I killed it in the standup",
        "my phone battery died",
        "this backlog is a dead weight",
        "the deadline moved again",
        "I'd die for a proper night of sleep",
        # Ordinary struggle - the coach SHOULD handle these, not the gate
        "I keep procrastinating and I feel terrible about it",
        "I'm exhausted and I can't focus",
        "I feel like a failure for missing my habit again",
        "I'm really overwhelmed by everything on my list",
        "I've been feeling low and unmotivated lately",
        "I'm burnt out",
    ],
)
def test_does_not_overfire(text: str) -> None:
    assert detect_crisis(text) is None, f"FALSE POSITIVE: {text!r}"


def test_empty_input_is_safe() -> None:
    assert detect_crisis("") is None
    assert detect_crisis("   ") is None


def test_match_records_pattern_not_user_text() -> None:
    """Crisis disclosures must never be logged; only the rule that fired."""
    match = detect_crisis("i want to kill myself")
    assert match is not None
    assert "kill myself" not in match.pattern.lower().replace("\\s+", " ")
    assert "my" in match.pattern


#===================#
# Resource sanity   |
#===================#

def test_every_resource_has_a_number() -> None:
    assert INDIA_RESOURCES, "resource list must not be empty"
    for resource in INDIA_RESOURCES:
        assert resource.numbers, f"{resource.name} has no number"
        assert resource.hours
        for number in resource.numbers:
            assert any(ch.isdigit() for ch in number)


def test_telemanas_is_listed_first() -> None:
    """The free 24x7 government line should be the first thing a user sees."""
    assert "Tele-MANAS" in INDIA_RESOURCES[0].name
    assert "14416" in INDIA_RESOURCES[0].numbers


def test_crisis_message_does_not_coach() -> None:
    """The fixed copy must not reframe, advise, or sell the app."""
    lowered = CRISIS_MESSAGE.lower()
    assert EMERGENCY_NUMBER in CRISIS_MESSAGE
    for coaching_tell in ("habit", "goal", "task", "try ", "tomorrow", "small step"):
        if coaching_tell == "habit":
            # "habit and planning tool" is the one allowed use: naming what we are not.
            assert lowered.count("habit") == 1
        else:
            assert coaching_tell not in lowered, f"crisis copy is coaching: {coaching_tell!r}"


#=======================================#
# Shared notice shape (chat + reflect)  |
#=======================================#

def test_build_crisis_notice_matches_resource_list() -> None:
    from app.services.safety import build_crisis_notice

    notice = build_crisis_notice()
    assert notice.kind == "crisis"
    assert notice.emergency_number == EMERGENCY_NUMBER
    assert len(notice.resources) == len(INDIA_RESOURCES)
    assert notice.resources[0].numbers == list(INDIA_RESOURCES[0].numbers)


def test_notice_is_serialisable() -> None:
    """It crosses the wire on two different endpoints."""
    from app.services.safety import build_crisis_notice

    payload = build_crisis_notice().model_dump()
    assert payload["kind"] == "crisis"
    assert all(r["numbers"] for r in payload["resources"])
