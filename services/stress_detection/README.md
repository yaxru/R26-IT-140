# Stress Detection Service (Component 4)

Flask backend for the Stress Detection component of R26-IT-140.
Triggered by Component 2 via a secure-link token; no separate login exists
inside this component.

## Setup terminal

1. `python -m venv venv`
2. `source venv/bin/activate`      # Windows: `venv\Scripts\activate`
3. `pip install -r requirements.txt`
4. `python app.py`

Set `STRESS_CORS_ORIGINS` to the comma-separated frontend origins that will call
the service. The local default is `http://localhost:3000`; the API listens on
port `8003` by default. The Next.js server proxies browser API calls to the
service through the frontend origin. Set `STRESS_API_INTERNAL_URL` in the
client's server environment if the service is not available at
`http://localhost:8003`. This same-origin proxy also supports mobile browsers
accessing the frontend over a local network without exposing a browser-side
`localhost` API URL or requiring CORS. Set `FRONTEND_BASE_URL` when the API
itself must return assessment links.

## Model

Logistic Regression classifier (scikit-learn), trained on
`unlock_time_ms`/`response_time_ms` and `avg_touch_pressure`/
`avg_game_pressure`. See `TESTING.ipynb` for the reference inference logic
this service reimplements as a live API.

For prototype demonstrations, the service fills missing pressure fields with
session-specific fallback scores so report rows remain populated on devices
that do not provide usable pressure samples. These values are for demonstration
only.

## API

Worker flow (token-authenticated):
- `POST /api/stress-detection/session/resolve`
- `POST /api/stress-detection/baseline`
- `POST /api/stress-detection/pss10`
- `POST /api/stress-detection/game1`
- `POST /api/stress-detection/game2`
- `POST /api/stress-detection/predict`

HR dashboard (Supabase session-authenticated):
- `GET /api/stress-detection/assessments`
- `GET /api/stress-detection/assessments/<session_id>`
