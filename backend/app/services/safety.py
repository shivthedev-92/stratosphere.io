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
"""Crisis detection and response.

Design rules, in priority order:

1. The AI coach NEVER writes the crisis response. When a message trips
   detection, the model is not called at all and the user receives fixed,
   human-authored copy. A language model improvising at this moment is the
   specific failure this module exists to prevent.
2. Recall beats precision. A false positive shows someone a helpline they
   did not need - mildly patronising. A false negative misses someone in
   danger. The patterns lean toward firing.
3. Everything here is auditable without running the app: plain regex, a
   literal resource list, no network calls, no model, no configuration.
"""

import re
from dataclasses import dataclass

from app.schemas.safety import CrisisResourceOut, SafetyNoticeOut

#===================#
# Crisis resources  |
#===================#

# VERIFIED 2026-09-07 against:
#   - Ministry of Health & Family Welfare / National Health Mission (Himachal
#     Pradesh) "Mental Health and Suicide Prevention Helpline Numbers" PDF,
#     which lists Tele-MANAS for every state and UT.
#   - https://telemanas.mohfw.gov.in  (Govt of India programme page)
#   - https://www.aasra.info          (AASRA's own site)
#
# RE-VERIFY BEFORE EACH RELEASE. A dead crisis number is worse than none.
#
# NOTE ON AASRA: the government PDF lists +91 9820466726 while AASRA's own
# site lists +91-22-27546669. Both are published as 24x7. We show both rather
# than silently pick one.

@dataclass(frozen=True)
class CrisisResource:
    name: str
    numbers: tuple[str, ...]
    hours: str
    note: str = ""


INDIA_RESOURCES: tuple[CrisisResource, ...] = (
    CrisisResource(
        name="Tele-MANAS (Government of India)",
        numbers=("14416", "1-800-891-4416"),
        hours="24x7",
        note="Free. Available in English and 20 regional languages, in every state and UT.",
    ),
    CrisisResource(
        name="Vandrevala Foundation",
        numbers=("1860-266-2345", "1800-233-3330"),
        hours="24x7",
        note="Free counselling by phone and WhatsApp.",
    ),
    CrisisResource(
        name="AASRA",
        numbers=("+91 98204 66726", "+91 22 2754 6669"),
        hours="24x7",
        note="Two numbers are published for AASRA; try either.",
    ),
    CrisisResource(
        name="iCALL (Tata Institute of Social Sciences)",
        numbers=("022 2552 1111",),
        hours="Mon-Sat, 8am-10pm",
        note="Free telephone and email counselling.",
    ),
)

EMERGENCY_NUMBER = "112"

# Shown verbatim. Deliberately plain: no coaching voice, no reframing, no
# advice about the user's goals, and no suggestion that this app can help.
CRISIS_MESSAGE = (
    "It sounds like you may be going through something serious, and I want to be "
    "straight with you: I am a habit and planning tool, not a counsellor, and I am "
    "not the right kind of help for this.\n\n"
    "Please talk to someone who is. The people on these lines are trained for exactly "
    "this conversation, and they are free and confidential.\n\n"
    f"If you are in immediate danger, call {EMERGENCY_NUMBER}."
)


#===================#
# Detection         |
#===================#

# Written to avoid the idioms a productivity app sees constantly:
# "this deadline is killing me", "I'm dying to ship this", "dead tired".
# Each pattern requires the self-referential object, so those do not match.
_CRISIS_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"\bkill(?:ing|ed)?\s+my\s?self\b",
        r"\bend(?:ing)?\s+(?:my\s+(?:life|existence)|it\s+all)\b",
        r"\btak(?:e|ing)\s+my\s+own\s+life\b",
        r"\bsuicid(?:e|al)\b",
        r"\bwant(?:ed|ing)?\s+to\s+die\b",
        r"\bwanna\s+die\b",
        r"\b(?:i'?m|i\s+am)\s+better\s+off\s+dead\b",
        r"\bbetter\s+off\s+(?:dead|without\s+me)\b",
        r"\bno(?:thing)?\s+(?:reason|point)\s+(?:to|in)\s+liv(?:e|ing)\b",
        r"\bnothing\s+to\s+live\s+for\b",
        r"\bdon'?t\s+want\s+to\s+(?:be\s+here|live|wake\s+up)\b",
        r"\bself[\s-]?harm(?:ing|ed|s)?\b",
        r"\b(?:hurt|harm|cut)(?:ting)?\s+my\s?self\b",
        r"\boverdos(?:e|ing)\b",
        r"\bend\s+my\s+suffering\b",
    )
)


@dataclass(frozen=True)
class CrisisMatch:
    """A positive detection. `pattern` is recorded for auditing the rules,
    never the user's text - crisis disclosures are not logged."""

    pattern: str


def detect_crisis(text: str) -> CrisisMatch | None:
    """Return a match if `text` contains a self-harm or suicide signal.

    Pure and side-effect free so it can be tested exhaustively.
    """
    if not text:
        return None
    for pattern in _CRISIS_PATTERNS:
        if pattern.search(text):
            return CrisisMatch(pattern=pattern.pattern)
    return None


def build_crisis_notice() -> SafetyNoticeOut:
    """The resource payload sent to clients. Identical everywhere it appears."""
    return SafetyNoticeOut(
        kind="crisis",
        emergency_number=EMERGENCY_NUMBER,
        resources=[
            CrisisResourceOut(
                name=resource.name,
                numbers=list(resource.numbers),
                hours=resource.hours,
                note=resource.note,
            )
            for resource in INDIA_RESOURCES
        ],
    )
