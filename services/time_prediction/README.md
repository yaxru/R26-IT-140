# Time Prediction – IT22202154 (Rathnayaka K.A.)

FastAPI service for garment production productivity and completion-time prediction. It exposes prediction, health, and stored prediction-history endpoints for the frontend contribution in `client/app/IT22202154-Rathnayaka-KA`.

## Run locally

From this directory, install `requirements.txt` and run:

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8002
```

Set `DATABASE_URL` using `.env.example` when PostgreSQL persistence is enabled.
