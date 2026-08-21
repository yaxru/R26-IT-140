"""
shared/auth/supabase_auth.py

The one place backend services get their Supabase client and their
"is this a valid logged-in user" check, instead of each service
redefining the same client + JWT-verification code.

Usage from a service (e.g. backend/main.py):

    from dotenv import load_dotenv
    load_dotenv()                      # 1. load SUPABASE_URL / SUPABASE_KEY first

    import sys
    from pathlib import Path
    sys.path.append(str(Path(__file__).resolve().parent.parent))  # 2. repo root on sys.path

    from shared.auth.supabase_auth import supabase, require_auth  # 3. import

    @app.get("/something")
    async def something(user: dict = Depends(require_auth)):
        ...

Requires SUPABASE_URL and SUPABASE_KEY to already be in the environment
(each service loads its own .env via python-dotenv before importing this
module — see step 1 above).
"""

import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_KEY"]

# The shared Supabase client. Services can import this directly for their
# own table queries instead of creating a second client.
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

_bearer = HTTPBearer()


def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """FastAPI dependency: verifies a Supabase-issued JWT bearer token
    against the Supabase Auth API and returns {user_id, email}.

    Raises 401 if the token is missing, invalid, or expired.
    """
    try:
        token = credentials.credentials
        response = supabase.auth.get_user(token)
        if response.user is None:
            raise ValueError("No user in response")
        return {"user_id": response.user.id, "email": response.user.email}
    except Exception as e:
        print(f"[AUTH ERROR] {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
