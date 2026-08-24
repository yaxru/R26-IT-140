# risk_analyze

Real-Time Risk Detection & Digital Data Capture for the garment production
line ("Digital Job Card"). Ported from an earlier Node.js/Express +
PostgreSQL prototype to Python/FastAPI + Supabase to match the pattern used
by sibling services (`../worker_reallocation`).

## What this service does

- Employees punch in their **Employee ID only** (no password) and log an
  hourly Digital Job Card entry (output, SMV, manpower, working minutes,
  shift, skill grade, machine status).
- The service computes **actual efficiency**, runs a (currently mocked)
  predictive model for expected output, and derives a **risk score**
  (variance between actual and predicted output).
- Employees whose first 3 submissions come in under 50% efficiency are
  automatically **flagged** for supervisor follow-up, with notifications
  sent to both the employee and the floor-manager/supervisor dashboard.
- Floor managers / supervisors log in with **name + password** and see a
  live dashboard: flagged employees, the risk/flag notification feed, and
  every entry logged across the floor.

## Auth — deliberately separate from the client's Supabase login

The main `client/` app uses **Supabase Auth** for its general dashboard
(floor-map, worker-reallocation, etc.). This service does **not** use that.
Employees don't have Supabase Auth accounts — they only have a row in the
`labers` table and log in with just their Employee ID. So this service
issues and verifies its **own JWTs** (see `auth.py`), and uses Supabase
purely as a hosted Postgres database via the `supabase-py` table client.

This means a token from `/login` or `/employee-login` here will **not**
work against `worker_reallocation`'s endpoints, and vice versa — they are
two independent auth systems by design. See `client/app/risk-analyze/`
for the frontend that talks to this specific auth flow.

## Setup

```bash
cd services/risk_analyze
python -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_KEY, JWT_SECRET
```

Run `schema.sql` once in your Supabase project's SQL editor to create the
`labers`, `laborers_data`, and `notifications` tables.

Create your first floor manager / supervisor account:

```bash
curl -X POST http://localhost:8001/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Supervisor Fernando", "age": 34, "role": "admin", "password": "password123"}'
```

Create an employee:

```bash
curl -X POST http://localhost:8001/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Kasun Perera", "age": 25, "role": "labor", "employee_code": "EMP001", "password": "password123"}'
```

(The employee's password is stored but never checked at login — only the
`employee_code` is required at `/employee-login`, per the product
requirement that employee login works with Employee ID alone.)

Run the service (defaults to port 8001 so it doesn't collide with
`worker_reallocation`, which typically runs on 8000):

```bash
uvicorn main:app --reload --port 8001
```

## Endpoints

| Method | Path                                    | Auth          | Description |
|--------|------------------------------------------|---------------|-------------|
| POST   | `/register`                               | public        | Create an admin (floor manager) or labor (employee) account |
| POST   | `/login`                                  | public        | Floor manager / supervisor login (name + password) |
| POST   | `/employee-login`                         | public        | Employee login (**Employee ID only**) |
| GET    | `/labers`                                 | any token     | List all users |
| GET    | `/labers/{id}`                            | any token     | Get one user |
| PUT    | `/labers/{id}`                            | admin only    | Update a user |
| DELETE | `/labers/{id}`                            | admin only    | Delete a user |
| POST   | `/laborers`                               | any token     | Submit an hourly Digital Job Card entry |
| GET    | `/laborers`                               | any token     | All entries (supervisor dashboard table) |
| GET    | `/laborers/latest/{laborers_id}`          | any token     | Most recent entry (restores the submission lock on refresh) |
| GET    | `/analysis/{laborers_id}`                 | any token     | Average/weighted efficiency, trend, full history |
| GET    | `/flags`                                  | admin only    | Currently flagged employees |
| PUT    | `/flags/{id}/clear`                       | admin only    | Clear a flag after follow-up |
| GET    | `/notifications/employee/{laborers_id}`   | any token     | An employee's own notifications |
| GET    | `/notifications/supervisor`               | admin only    | Floor-wide risk/flag feed |
| PUT    | `/notifications/{id}/read`                | any token     | Mark a notification read |

## Notes on the port from Node.js

- `bcrypt` password hashing and the JWT auth flow were ported 1:1 (Python
  `bcrypt` + `PyJWT` in place of Node's `bcrypt` + `jsonwebtoken`).
- The mocked predictive model (`predictive.py`) is a direct port of the
  original `service/predictiveService.js` — same formula, same output
  shape — so it's a drop-in swap once the real Random Forest model is
  ready (see the docstring in `predictive.py`).
- The original prototype also had an unused `/api/supervisor` CRUD route
  (`supervisor_data` table) with no matching schema and no frontend caller
  — it was dead code and was intentionally left out of this port. Ask if
  you actually need it and it can be added.
- The original Express app had a routing bug where the auth-protected
  route file (`route/laberRoute.js`) was never mounted — `server.js`
  mounted an unprotected duplicate (`route/laberModel.js`) instead, so
  every endpoint was effectively public. This port applies the auth that
  was clearly intended (`require_auth` / `require_admin` per the table
  above) rather than reproducing that bug.
