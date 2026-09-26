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
"""Shared shape for surfacing crisis resources.

Used by both the coach (`/chat`) and reflections (`/goals/{id}/logs`).
The two differ in one important way:

- In chat, a hit REPLACES the model reply - the coach is never called.
- In a reflection, a hit is ADDITIVE - the reflection still saves. Refusing
  to store what someone wrote at a low moment would be its own harm.
"""

from typing import Literal

from pydantic import BaseModel


class CrisisResourceOut(BaseModel):
    name: str
    numbers: list[str]
    hours: str
    note: str


class SafetyNoticeOut(BaseModel):
    kind: Literal["crisis"]
    emergency_number: str
    resources: list[CrisisResourceOut]
