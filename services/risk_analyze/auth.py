"""
Custom JWT auth for risk_analyze.

This service intentionally does NOT use Supabase Auth (supabase.auth.*).
Employees log in with only their Employee ID (no account in Supabase Auth
exists for them), and supervisors/floor managers log in with a name +
password checked against the `labers` table. Supabase is used here purely
as the Postgres database (via the `supabase-py` table client) — auth is
handled entirely by this module, mirroring the original Node/Express
(jsonwebtoken + bcrypt) implementation this service was ported from.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

JWT_SECRET: str = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"

_bearer = HTTPBearer()


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(payload: dict, expires_in: timedelta) -> str:
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not set — check your .env")
    to_encode = {**payload, "exp": datetime.now(timezone.utc) + expires_in}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def require_auth(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """Verify our own JWT (not a Supabase session token) and return its payload."""
    try:
        return decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def require_admin(user: dict = Depends(require_auth)) -> dict:
    """Floor manager / supervisor / admin only."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: admins only")
    return user
