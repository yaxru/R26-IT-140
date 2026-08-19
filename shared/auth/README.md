# shared/auth

One shared Supabase client + JWT-verification dependency, so backend
services don't each redefine the same "is this a valid logged-in user"
code.

## What's here

`supabase_auth.py` exports:

- `supabase` — a ready-to-use `supabase-py` client built from
  `SUPABASE_URL` / `SUPABASE_KEY` in the environment.
- `require_auth` — a FastAPI dependency that verifies a Supabase-issued
  JWT bearer token and returns `{user_id, email}`, or raises `401`.

## Using it from a service

Each service still keeps its own `.env` (`SUPABASE_URL`, `SUPABASE_KEY`,
etc.) and its own `requirements.txt` — this module is imported at the
Python level, not run as a separate server.

```python
from dotenv import load_dotenv
load_dotenv()                      # 1. load env vars first

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))  # 2. put repo root on sys.path

from shared.auth.supabase_auth import supabase, require_auth  # 3. import

from fastapi import FastAPI, Depends

app = FastAPI()

@app.get("/something")
async def something(user: dict = Depends(require_auth)):
    return {"hello": user["email"]}
```

Order matters: `load_dotenv()` has to run **before** the `shared.auth`
import, since `supabase_auth.py` reads `SUPABASE_URL`/`SUPABASE_KEY` from
the environment at import time.

`backend/main.py` (risk_analyze) is wired up this way already — use it as
a working example.

## Why the `sys.path` line

There's no shared root-level Python package config in this repo (no
`pyproject.toml` workspace, no `PYTHONPATH` setup), so a service run
directly via `uvicorn main:app` from inside its own folder can't see
`shared/` by default. Adding the repo root to `sys.path` at runtime is a
one-line fix that works regardless of where you run the command from,
without needing extra tooling. If the team later adds proper packaging
(e.g. a root `pyproject.toml` with each service + `shared` as
dependencies), this line can go away.
