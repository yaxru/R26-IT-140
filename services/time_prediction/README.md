# Time Prediction – Opsis

FastAPI service for garment production productivity and completion-time prediction.
Exposes `/health`, `/predict`, and `/history` endpoints consumed by `client/app/production-time`.

## Run locally

From the `services/time_prediction/` directory:

```bash
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8002 --reload
```

Verify: `http://127.0.0.1:8002/health`
Interactive docs: `http://127.0.0.1:8002/docs`

## Supabase table

The service writes history to a `prediction_runs` table in the shared Supabase project.
Create it once with the following SQL in the Supabase SQL editor:

```sql
CREATE TABLE IF NOT EXISTS prediction_runs (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    department VARCHAR(100) NOT NULL,
    team DOUBLE PRECISION NOT NULL,
    batch_qty INTEGER NOT NULL,
    production_date DATE NOT NULL,
    no_of_workers DOUBLE PRECISION NOT NULL,
    over_time DOUBLE PRECISION NOT NULL,
    smv DOUBLE PRECISION NOT NULL,
    machine_breakdown_minutes DOUBLE PRECISION NOT NULL DEFAULT 0,
    predicted_productivity DOUBLE PRECISION NOT NULL,
    efficiency_level VARCHAR(40) NOT NULL,
    delay_prediction VARCHAR(80) NOT NULL,
    base_time_minutes DOUBLE PRECISION NOT NULL,
    base_time_hours DOUBLE PRECISION NOT NULL,
    estimated_time_minutes DOUBLE PRECISION NOT NULL,
    estimated_time_hours DOUBLE PRECISION NOT NULL
);
```

## Port map

| Service             | Port     |
| ------------------- | -------- |
| worker_reallocation | 8000     |
| risk_analyze        | 8001     |
| **time_prediction** | **8002** |
