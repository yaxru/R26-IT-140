# Integration notes — linepulse-benjamin (IT22182050) → R26-IT-140-develop

This documents how the `linepulse-benjamin` prototype ("Line Pulse — Digital
Job Card", Real-Time Risk Detection & Digital Data Capture) was merged into
this repo.

## What moved where

| From (linepulse-benjamin)      | To (this repo)                                  |
|---------------------------------|--------------------------------------------------|
| `backend/` (Node/Express + PostgreSQL) | `services/risk_analyze/` — **rewritten** in Python/FastAPI + Supabase, to match the pattern of `services/worker_reallocation` |
| `frontend/src/app/employee/*`   | `client/app/risk-analyze/employee/*`             |
| `frontend/src/app/supervisor/*` | `client/app/risk-analyze/supervisor/*`           |
| `frontend/src/app/page.tsx`     | `client/app/risk-analyze/page.tsx`               |
| `frontend/src/components/*`     | `client/app/risk-analyze/components/*`           |
| `frontend/src/lib/*`            | `client/lib/risk-analyze/*`                      |
| `frontend/src/app/globals.css`  | `client/app/risk-analyze/risk-analyze.css` (scoped under `.risk-analyze-scope` so it doesn't affect the rest of the dashboard) |

## Key decisions (confirmed with the client during integration)

1. **Backend stack**: rewritten from Node.js/Express+PostgreSQL to
   Python/FastAPI+Supabase to match sibling services under `services/`.
   Supabase is used purely as a hosted Postgres database here (via the
   `supabase-py` table client) — see the next point for why.

2. **Auth is a separate system, on purpose**: the main `client/` dashboard
   (floor-map, worker-reallocation, header) authenticates via **Supabase
   Auth**. The risk_analyze module (Employee + Floor Manager/Supervisor)
   uses its **own JWT auth**, because employees log in with only an
   Employee ID and have no Supabase Auth account. `client/middleware.ts`
   was updated to exclude `/risk-analyze/*` from the Supabase-auth
   redirect so both systems coexist without conflict.

3. **Employee login is Employee-ID-only** (no password) — this was a
   specific requirement, distinct from the Floor Manager/Supervisor login
   which still requires name + password. See
   `client/app/risk-analyze/employee/login/page.tsx` and
   `services/risk_analyze/main.py` (`POST /employee-login`).

4. **Naming**: kept "supervisor" terminology as-is per instruction
   (not renamed to "floor manager"), though it's referred to as "Floor
   Manager / Supervisor" in a couple of UI labels for clarity since that's
   the role being described.

## Running everything locally

```bash
# 1. Backend (risk_analyze)
cd services/risk_analyze
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_KEY, JWT_SECRET
# Run schema.sql once in your Supabase project's SQL editor
uvicorn main:app --reload --port 8001

# 2. Frontend (client)
cd client
npm install
cp .env.local.example .env.local   # fill in Supabase + risk_analyze URL
npm run dev
```

Then visit:
- `http://localhost:3000/login` — main StitchFlow (Supabase) dashboard
- `http://localhost:3000/risk-analyze` — Digital Job Card module
  (Employee ID-only login, or Floor Manager/Supervisor name+password login)

## Verified

- `services/risk_analyze`: all modules syntax-checked, dependencies
  installed, app imports cleanly, all 19 routes register correctly.
- `client`: `npx tsc --noEmit` passes with zero errors; `eslint` passes
  clean on all new/changed files.
- `npx next build` was attempted but fails in this sandbox only because
  it has no network access to fetch Google Fonts (`next/font/google` in
  the pre-existing `client/app/layout.tsx`) — unrelated to this
  integration and not reproducible in a normal dev environment.

## Not done / follow-ups

- The real predictive model (Function 2) is still mocked in
  `services/risk_analyze/predictive.py`, exactly as it was in the
  original prototype — swap it in per the docstring there.
- No UI navigation link was added from the main dashboard's sidebar to
  `/risk-analyze`; only a text link on `/login`. Say the word if you'd
  like it added to `Sidebar.tsx` too.
