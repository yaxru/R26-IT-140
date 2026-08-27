# Stress Detection Service (Component 4)

Flask backend for the Stress Detection component of R26-IT-140.
Triggered by Component 2 via a secure-link token; no separate login exists
inside this component.

## Setup terminal

1. `python -m venv venv`
2. `source venv/bin/activate`      # Windows: `venv\Scripts\activate`
3. `pip install -r requirements.txt`
4. `python app.py`

## Model

Logistic Regression classifier (scikit-learn), trained on
`unlock_time_ms`/`response_time_ms` and `avg_touch_pressure`/
`avg_game_pressure`. See `TESTING.ipynb` for the reference inference logic
this service reimplements as a live API.

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
