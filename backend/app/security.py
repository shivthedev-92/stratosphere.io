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

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings

#==================#
# Hashing Password |
#==================#

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

#==================#
# Verify Password  |
#==================#

def verify_password(plain: str, hashed: str) -> bool:
    # bcrypt 5 raises on inputs over 72 bytes; such a password can never match.
    if len(plain.encode()) > 72:
        return False
    return bcrypt.checkpw(plain.encode(), hashed.encode())

#=========================#
# Constant-Time Login Miss|
#=========================#

# Hashing a throwaway password once at import gives us a real bcrypt digest to
# verify against when an email does not exist. Without it, a miss returns in
# microseconds while a hit spends ~100ms in bcrypt, which leaks whether an
# account exists.
_DUMMY_PASSWORD_HASH = hash_password("stratosphere-login-timing-equaliser")


def burn_password_verify() -> None:
    """Spend the same time bcrypt would on a real check. Result is discarded."""
    bcrypt.checkpw(b"invalid", _DUMMY_PASSWORD_HASH.encode())

#====================#
# Create Access Token|
#====================#

def create_access_token(subject: str, token_version: int = 0) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": subject, "exp": expire, "ver": token_version},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )

#====================#
# Decode Access Token|
#====================#

def decode_access_token(token: str) -> dict:
    """Return the verified claim set. Raises jwt.PyJWTError if the token is bad."""
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )
