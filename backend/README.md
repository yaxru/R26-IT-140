# backend — Real-Time Risk Detection & Digital Data Capture

**Owner:** B.Benjamin (IT22182050) · Function 1 in the TAF

> This used to live at `services/risk_analyze/`. It's now a top-level
> `backend/` folder, and its Supabase client + auth check moved out into
> `shared/auth/` so other backend services can reuse them too — see
> `shared/auth/README.md`.

FastAPI microservice, structured the same way as `services/worker_reallocation`
(Yasiru's service) so the two are consistent: Supabase for data, Supabase
Auth JWTs for authentication, CORS open to the Next.js client on
`localhost:3000`.

## What it does

1. Takes an hourly **Digital Job Card** submission (`POST /job-card`):
   output, SMV, manpower, working minutes, shift, operator skill grade,
   machine status, optional downtime reason.
2. Computes **actual efficiency**: `(output × SMV) / (manpower × working_minutes) × 100`.
3. **Data-integrity check** — rejects (422) anything outside a physically
   possible efficiency range instead of silently storing bad data.
4. **Forces root-cause capture** — a `downtime_reason` is required once
   efficiency drops below 60% (configurable).
5. Gets a **predicted output/efficiency** from Adithya's `time_prediction`
   service — or, until that's live, a clearly-labelled local mock with the
   identical response shape (`main.py::_mock_predict` / `get_prediction`).
   Set `TIME_PREDICTION_URL` in `.env` to switch over — nothing else changes.
6. Computes a **risk score** — % variance between actual and predicted
   output — and buckets it into LOW/MEDIUM/HIGH, flagging statistical
   outliers.
7. **Pushes the result into `production_status.actual_productivity`**
   (as a 0–1 ratio, matching the existing convention) so the rest of the
   app — floor-map, worker-reallocation, the home dashboard — sees real
   numbers instead of the seeded placeholder data.
8. **Flags an operator** if any of their first 3 submissions (configurable)
   comes in under 50% efficiency, and writes a notification for both the
   operator and the supervisor dashboard. This is additive to the existing
   `operators` table (new columns only — nothing existing is touched).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness check |
| POST | `/job-card` | submit one hourly entry (the core endpoint) |
| GET | `/job-card/{operator_id}/latest` | most recent entry — for restoring a submission-lock timer after refresh |
| GET | `/job-card/{operator_id}/history` | average efficiency, trend, full history |
| GET | `/flags` | list currently flagged operators |
| PUT | `/flags/{operator_id}/clear` | clear a flag once addressed |
| GET | `/notifications?audience=supervisor\|operator&operator_id=...` | alert feed |
| PUT | `/notifications/{id}/read` | mark an alert read |

All routes except `/health` require `Authorization: Bearer <supabase access_token>`,
same as `worker_reallocation`.

## Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # or your usual venv flow
pip install -r requirements.txt
cp .env.example .env      # fill in SUPABASE_URL / SUPABASE_KEY
```

Run `schema.sql` once in the Supabase SQL editor — it's additive only
(new columns on `operators`, two new tables: `job_card_entries` and
`notifications`). It won't touch existing data or drop anything.

```bash
uvicorn main:app --reload --port 8001
```

(`8001` because `services/worker_reallocation` already uses `8000` — pick
whatever's free on your machine, just update `NEXT_PUBLIC_*` in the
client to match whenever you wire this in.)

Note: `main.py` adds the repo root to `sys.path` at startup so it can
import `shared/auth/supabase_auth.py` — you don't need to do anything
extra, just run `uvicorn` from inside `backend/` as shown above.

## Testing it without the client

Get a bearer token the same way the client does — sign in via Supabase
Auth and grab `session.access_token` — then:

```bash
curl -X POST http://localhost:8001/job-card \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": "OP-025",
    "station_id": "Station-05",
    "output": 5.25,
    "smv": 8,
    "manpower": 1,
    "working_minutes": 60,
    "shift": "day",
    "operator_skill": "B",
    "machine_status": "ok"
  }'
```

To see the flag rule fire, submit an entry with efficiency under 50%
(e.g. `output: 2` with the values above ≈ 26.7%) — you'll need to add a
`downtime_reason` since it's also a LOW entry. Do it again as their 2nd or
3rd submission and check `GET /flags`.

## What I verified before handing this off

Supabase isn't reachable from where this was built, so I verified logic
with a mocked Supabase client (mirrors the real `supabase-py` query
builder) exercised through FastAPI's `TestClient`:

- Healthy submission → correct efficiency/status, persists, updates `production_status`
- Low efficiency without a `downtime_reason` → 400, rejected
- Low efficiency with a `downtime_reason` → saved, flags on submission #2 of 3, writes both notifications
- Impossible input data → 422, rejected before touching the DB
- `/health`, `/flags`, `/notifications` all round-trip correctly

Worth double-checking once it's pointed at the real project: RLS
policies on `job_card_entries` / `notifications` / the new `operators`
columns, and that `SUPABASE_KEY` has write access (service_role
recommended for a backend service, same as `worker_reallocation`'s
`.env.example` suggests).

## Config knobs (all in `.env`, all optional)

| Var | Default | Meaning |
|---|---|---|
| `FLAG_EFFICIENCY_THRESHOLD` | 50 | efficiency % below which a submission counts toward flagging |
| `FLAG_SUBMISSION_WINDOW` | 3 | only the operator's first N submissions are checked |
| `DOWNTIME_REASON_THRESHOLD` | 60 | efficiency % below which a downtime reason is required |
| `IMPOSSIBLE_EFFICIENCY_MIN` / `_MAX` | 0 / 150 | data-integrity bounds |
| `RISK_MEDIUM_THRESHOLD_PCT` / `RISK_HIGH_THRESHOLD_PCT` | 10 / 25 | risk-score bands |
| `RISK_OUTLIER_THRESHOLD_PCT` | 50 | statistical-outlier cutoff |
| `TIME_PREDICTION_URL` | unset | when set, calls the real predictive service instead of the mock |

I picked these defaults myself (the TAF didn't specify exact thresholds)
— flag if you and your supervisor want different numbers, they're one-line
changes.
