from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from datetime import date as dt_date
from fastapi.middleware.cors import CORSMiddleware

from src.predict import predict_batch
from src.autofill import AutoFillSource
from app.history import PredictionHistoryStore

app = FastAPI(
    title="Garment Batch Prediction API (Supervisor Inputs + AutoFill)"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    # The dashboard may be opened through the computer's LAN address during
    # development (for example, http://192.168.1.170:3000). Keep localhost
    # origins explicit above, while allowing private-network dev addresses.
    allow_origin_regex=r"^https?://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

autofill = AutoFillSource()
history_store = PredictionHistoryStore()


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


@app.on_event("startup")
def initialize_history_database():
    history_store.initialize()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "garment-batch-predictor",
        "database": history_store.status,
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

    history_id = history_store.save(req, result, production_date=date_str)
    return {
        **result,
        "history_id": history_id,
        "history_saved": history_id is not None,
    }


@app.get("/history", response_model=list[PredictionHistoryItem])
def prediction_history(limit: int = Query(default=20, ge=1, le=100)):
    try:
        return history_store.list_recent(limit)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
