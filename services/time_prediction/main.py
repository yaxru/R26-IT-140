import os
import logging
from datetime import date as dt_date

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client
from dotenv import load_dotenv

# ── local modules (same directory layout as before) ─────────────────────────
from src.predict import predict_batch
from src.autofill import AutoFillSource

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supabase client
# ---------------------------------------------------------------------------
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Opsis Time Prediction Service",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

autofill = AutoFillSource()

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PredictRequest(BaseModel):
    department: str = Field(min_length=1)
    team: float = Field(gt=0)
    batch_qty: int = Field(gt=0)
    date: str | None = None

    no_of_workers: float = Field(gt=0)
    over_time: float = Field(ge=0)
    smv: float = Field(gt=0)

    machine_breakdown_minutes: float = Field(default=0, ge=0)


class PredictResponse(BaseModel):
    history_id: int | None = None
    history_saved: bool = False
    predicted_productivity: float
    efficiency_level: str
    delay_prediction: str
    base_time_minutes: float
    base_time_hours: float
    machine_breakdown_minutes: float
    estimated_time_minutes: float
    estimated_time_hours: float


class PredictionHistoryItem(BaseModel):
    id: int
    created_at: str
    department: str
    team: float
    batch_qty: int
    date: str
    no_of_workers: float
    over_time: float
    smv: float
    machine_breakdown_minutes: float
    predicted_productivity: float
    efficiency_level: str
    delay_prediction: str
    base_time_minutes: float
    base_time_hours: float
    estimated_time_minutes: float
    estimated_time_hours: float


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def _save_to_supabase(req: PredictRequest, result: dict, production_date: str) -> int | None:
    """Insert one prediction run into the Supabase table and return its id."""
    try:
        row = {
            "department": req.department,
            "team": req.team,
            "batch_qty": req.batch_qty,
            "production_date": production_date,
            "no_of_workers": req.no_of_workers,
            "over_time": req.over_time,
            "smv": req.smv,
            "machine_breakdown_minutes": result["machine_breakdown_minutes"],
            "predicted_productivity": result["predicted_productivity"],
            "efficiency_level": result["efficiency_level"],
            "delay_prediction": result["delay_prediction"],
            "base_time_minutes": result["base_time_minutes"],
            "base_time_hours": result["base_time_hours"],
            "estimated_time_minutes": result["estimated_time_minutes"],
            "estimated_time_hours": result["estimated_time_hours"],
        }
        response = supabase.table("prediction_runs").insert(row).execute()
        if response.data:
            return response.data[0].get("id")
        return None
    except Exception as exc:
        logger.warning("Could not save prediction history to Supabase: %s", exc)
        return None


def _list_from_supabase(limit: int) -> list[dict]:
    """Fetch recent prediction runs from Supabase."""
    try:
        response = (
            supabase.table("prediction_runs")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = response.data or []
        # Rename production_date → date to match the frontend API contract
        for row in rows:
            if "production_date" in row and "date" not in row:
                row["date"] = row.pop("production_date")
        return rows
    except Exception as exc:
        raise RuntimeError(f"Prediction history is unavailable: {exc}") from exc


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "opsis-time-prediction",
        "version": "1.0.0",
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    date_str = req.date or dt_date.today().isoformat()

    overrides = {
        "no_of_workers": float(req.no_of_workers),
        "over_time": float(req.over_time),
        "smv": float(req.smv),
    }

    try:
        features = autofill.build_features(
            department=req.department,
            team=req.team,
            date_str=date_str,
            overrides=overrides,
        )
        result = predict_batch(
            features,
            batch_qty=req.batch_qty,
            machine_breakdown_minutes=req.machine_breakdown_minutes,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    history_id = _save_to_supabase(req, result, production_date=date_str)

    return {
        **result,
        "history_id": history_id,
        "history_saved": history_id is not None,
    }


@app.get("/history", response_model=list[PredictionHistoryItem])
def prediction_history(limit: int = Query(default=20, ge=1, le=100)):
    try:
        return _list_from_supabase(limit)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

