"""
risk_analyze — Function 1: Real-Time Risk Detection & Digital Data Capture
Student: B.Benjamin (IT22182050)

Mirrors the shape of services/worker_reallocation/main.py so the two
are consistent for whoever maintains both, even though this one now
lives at the repo root as backend/ (see shared/auth/README.md for why).

Responsibilities (per the TAF):
  * Digitize the hourly job card and compute ACTUAL efficiency
  * Reject/flag data-integrity violations (impossible values)
  * Force root-cause capture (downtime_reason) on LOW efficiency entries
  * Call the predictive model for predicted output/efficiency (real
    service if TIME_PREDICTION_URL is set, otherwise a clearly-labelled
    local mock — see `predict()`)
  * Compute a Risk Score = variance between actual and predicted output
  * Push the result into `production_status.actual_productivity` so the
    rest of the app (floor-map, worker-reallocation, home) sees it
  * Flag an operator if any of their first N submissions falls below a
    low-efficiency threshold, and notify both the operator and
    supervisor dashboards
"""

import os
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Shared Supabase client + auth dependency (shared/auth/supabase_auth.py)
# ---------------------------------------------------------------------------
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))  # repo root
from shared.auth.supabase_auth import supabase, require_auth  # noqa: E402

app = FastAPI(title="StitchFlow Real-Time Risk Detection", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type", "Authorization"],
)

# ---------------------------------------------------------------------------
# Constants — all overridable via env, matching worker_reallocation's style
# ---------------------------------------------------------------------------
# An operator is flagged if any of their first N submissions comes in
# under this efficiency %. This is a support signal, not a penalty.
FLAG_EFFICIENCY_THRESHOLD: float = float(os.environ.get("FLAG_EFFICIENCY_THRESHOLD", "50"))
FLAG_SUBMISSION_WINDOW: int = int(os.environ.get("FLAG_SUBMISSION_WINDOW", "3"))

# Below this efficiency %, a downtime_reason is required (forced root-cause capture).
DOWNTIME_REASON_THRESHOLD: float = float(os.environ.get("DOWNTIME_REASON_THRESHOLD", "60"))

# Efficiency outside this range is treated as bad data and rejected outright.
IMPOSSIBLE_EFFICIENCY_MIN: float = float(os.environ.get("IMPOSSIBLE_EFFICIENCY_MIN", "0"))
IMPOSSIBLE_EFFICIENCY_MAX: float = float(os.environ.get("IMPOSSIBLE_EFFICIENCY_MAX", "150"))

# Risk score (% variance between actual and predicted output) bands.
RISK_MEDIUM_THRESHOLD_PCT: float = float(os.environ.get("RISK_MEDIUM_THRESHOLD_PCT", "10"))
RISK_HIGH_THRESHOLD_PCT: float = float(os.environ.get("RISK_HIGH_THRESHOLD_PCT", "25"))
RISK_OUTLIER_THRESHOLD_PCT: float = float(os.environ.get("RISK_OUTLIER_THRESHOLD_PCT", "50"))

# Once Adithya's time_prediction service is live, set this env var and
# risk_analyze will call it instead of the local mock (same response shape).
TIME_PREDICTION_URL: Optional[str] = os.environ.get("TIME_PREDICTION_URL")


class Shift(str, Enum):
    day = "day"
    night = "night"


class ProficiencyGrade(str, Enum):
    A = "A"
    B = "B"
    C = "C"


class MachineStatus(str, Enum):
    ok = "ok"
    maintenance = "maintenance"
    breakdown = "breakdown"


class DowntimeReason(str, Enum):
    mechanical_failure = "Mechanical Failure"
    supply_delay = "Supply Delay"
    power_outage = "Power Outage"
    absenteeism = "Absenteeism"
    rework_quality = "Rework / Quality Issue"
    other = "Other"


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------
class JobCardIn(BaseModel):
    operator_id: str = Field(..., example="OP-025")
    station_id: Optional[str] = Field(None, example="Station-05")
    output: float = Field(..., gt=0, example=420)
    smv: float = Field(..., gt=0, example=8.5)
    manpower: float = Field(..., gt=0, example=1)
    working_minutes: float = Field(..., gt=0, example=60)
    shift: Shift = Shift.day
    operator_skill: ProficiencyGrade = ProficiencyGrade.B
    machine_status: MachineStatus = MachineStatus.ok
    downtime_reason: Optional[DowntimeReason] = None


class Prediction(BaseModel):
    predicted_output: float
    predicted_efficiency: float
    efficiency_class: str  # "High Efficiency" | "Low Efficiency"
    batch_completion_time: Optional[float]


class RiskInfo(BaseModel):
    risk_score: float
    risk_level: str  # LOW | MEDIUM | HIGH
    is_outlier: bool


class SubmitResponse(BaseModel):
    entry: dict
    prediction: Prediction
    risk: RiskInfo
    flagged: bool
    flagged_now: bool
    submission_count: int
    notification: Optional[str]


class FlaggedOperator(BaseModel):
    operator_id: str
    current_station: Optional[str]
    submission_count: int
    is_flagged: bool
    flagged_at: Optional[str]
    flag_reason: Optional[str]


class NotificationOut(BaseModel):
    id: int
    operator_id: Optional[str]
    audience: str
    type: str
    message: str
    is_read: bool
    created_at: str


# ---------------------------------------------------------------------------
# Predictive model bridge — Function 2 (Adithya's time_prediction service)
#
# STUB: time_prediction isn't built yet. This mock returns the exact same
# shape the real service should return, so nothing else here has to
# change once it exists — just set TIME_PREDICTION_URL.
# ---------------------------------------------------------------------------
def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _mock_predict(
    target_output: float,
    working_minutes: float,
    operator_skill: str,
    shift: str,
    machine_status: str,
    historical_avg_efficiency: Optional[float],
) -> Prediction:
    import random

    perf = (historical_avg_efficiency / 100) if historical_avg_efficiency is not None else (0.85 + random.random() * 0.1)
    perf = _clamp(perf, 0.4, 1.0)

    skill_factor = {"A": 1.05, "B": 1.0, "C": 0.9}.get(operator_skill, 1.0)
    shift_factor = 0.95 if shift == "night" else 1.0
    machine_factor = {"maintenance": 0.65, "breakdown": 0.4}.get(machine_status, 1.0)
    noise = 1 + (random.random() * 0.06 - 0.03)

    combined = _clamp(perf * skill_factor * shift_factor * machine_factor * noise, 0.1, 1.15)

    predicted_output = round(target_output * combined, 2)
    predicted_efficiency = round(combined * 100, 2)
    efficiency_class = "High Efficiency" if predicted_efficiency >= 75 else "Low Efficiency"
    batch_completion_time = (
        round((target_output / predicted_output) * working_minutes, 2)
        if predicted_output > 0 else None
    )

    return Prediction(
        predicted_output=predicted_output,
        predicted_efficiency=predicted_efficiency,
        efficiency_class=efficiency_class,
        batch_completion_time=batch_completion_time,
    )


async def get_prediction(
    target_output: float,
    working_minutes: float,
    operator_skill: str,
    shift: str,
    machine_status: str,
    historical_avg_efficiency: Optional[float],
) -> Prediction:
    if TIME_PREDICTION_URL:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.post(
                    f"{TIME_PREDICTION_URL}/predict",
                    json={
                        "target_output": target_output,
                        "working_minutes": working_minutes,
                        "operator_skill": operator_skill,
                        "shift": shift,
                        "machine_status": machine_status,
                        "historical_avg_efficiency": historical_avg_efficiency,
                    },
                )
                resp.raise_for_status()
                return Prediction(**resp.json())
        except Exception as exc:
            print(f"[time_prediction unreachable, falling back to mock] {exc}")

    return _mock_predict(
        target_output, working_minutes, operator_skill, shift, machine_status,
        historical_avg_efficiency,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "StitchFlow Real-Time Risk Detection"}


@app.post("/job-card", response_model=SubmitResponse)
async def submit_job_card(entry: JobCardIn, _: dict = Depends(require_auth)):
    """
    Ingest one hourly Digital Job Card submission:
      1. Compute actual efficiency
      2. Data-integrity check (reject impossible values)
      3. Force downtime_reason capture on LOW efficiency
      4. Get predicted output/efficiency (real service or mock)
      5. Compute risk score/level vs. the prediction
      6. Persist the entry, push actual_productivity to production_status
      7. Apply the first-N-submissions low-efficiency flag rule
    """
    # 1. Ensure the operator exists (create a bare record if this is their
    #    very first submission — keeps this service usable standalone).
    try:
        op_resp = (
            supabase.table("operators")
            .select("operator_id, current_station, submission_count, is_flagged, flag_reason")
            .eq("operator_id", entry.operator_id)
            .maybe_single()
            .execute()
        )
        operator = op_resp.data if op_resp else None
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database query failed: {exc}")

    if operator is None:
        try:
            insert_resp = (
                supabase.table("operators")
                .insert({"operator_id": entry.operator_id, "current_station": entry.station_id})
                .execute()
            )
            operator = insert_resp.data[0]
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Could not register operator: {exc}")

    # 2. Actual efficiency (the Digital Job Card formula)
    efficiency = (entry.output * entry.smv) / (entry.manpower * entry.working_minutes) * 100

    # 3. Data-integrity / outlier rejection
    if not (IMPOSSIBLE_EFFICIENCY_MIN <= efficiency <= IMPOSSIBLE_EFFICIENCY_MAX):
        raise HTTPException(
            status_code=422,
            detail=(
                f"Data integrity check failed: computed efficiency "
                f"({efficiency:.1f}%) is outside a physically possible range. "
                f"Please check the entered values."
            ),
        )

    status_label = "LOW"
    if efficiency >= 85:
        status_label = "HIGH"
    elif efficiency >= 60:
        status_label = "MEDIUM"

    # 4. Force root-cause capture on LOW entries
    if efficiency < DOWNTIME_REASON_THRESHOLD and entry.downtime_reason is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "downtime_reason is required when efficiency is low "
                f"(< {DOWNTIME_REASON_THRESHOLD:.0f}%)."
            ),
        )

    # 5. Predicted output/efficiency
    try:
        hist_resp = (
            supabase.table("job_card_entries")
            .select("efficiency")
            .eq("operator_id", entry.operator_id)
            .execute()
        )
        past = [row["efficiency"] for row in (hist_resp.data or []) if row.get("efficiency") is not None]
        historical_avg_efficiency = (sum(past) / len(past)) if past else None
    except Exception:
        historical_avg_efficiency = None

    prediction = await get_prediction(
        target_output=entry.output,
        working_minutes=entry.working_minutes,
        operator_skill=entry.operator_skill.value,
        shift=entry.shift.value,
        machine_status=entry.machine_status.value,
        historical_avg_efficiency=historical_avg_efficiency,
    )

    # 6. Risk score — variance between actual and predicted output
    if prediction.predicted_output > 0:
        risk_score = round(abs(prediction.predicted_output - entry.output) / prediction.predicted_output * 100, 2)
    else:
        risk_score = 0.0

    if risk_score >= RISK_HIGH_THRESHOLD_PCT:
        risk_level = "HIGH"
    elif risk_score >= RISK_MEDIUM_THRESHOLD_PCT:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    is_outlier = risk_score >= RISK_OUTLIER_THRESHOLD_PCT

    # 7. Persist the entry
    try:
        insert_resp = (
            supabase.table("job_card_entries")
            .insert({
                "operator_id": entry.operator_id,
                "station_id": entry.station_id,
                "output": entry.output,
                "smv": entry.smv,
                "manpower": entry.manpower,
                "working_minutes": entry.working_minutes,
                "shift": entry.shift.value,
                "operator_skill": entry.operator_skill.value,
                "machine_status": entry.machine_status.value,
                "downtime_reason": entry.downtime_reason.value if entry.downtime_reason else None,
                "efficiency": round(efficiency, 2),
                "status": status_label,
                "predicted_output": prediction.predicted_output,
                "predicted_efficiency": prediction.predicted_efficiency,
                "efficiency_class": prediction.efficiency_class,
                "batch_completion_time": prediction.batch_completion_time,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "is_outlier": is_outlier,
            })
            .execute()
        )
        saved_entry = insert_resp.data[0]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Could not save entry: {exc}")

    # 8. Push to production_status.actual_productivity (best-effort — a
    #    failure here shouldn't lose the operator's submission).
    if entry.station_id:
        try:
            supabase.table("production_status").update(
                {"actual_productivity": round(_clamp(efficiency / 100, 0, 1.5), 4)}
            ).eq("station_id", entry.station_id).execute()
        except Exception as exc:
            print(f"[production_status update failed] {exc}")

    # 9. First-N-submissions low-efficiency flag rule
    new_count = int(operator.get("submission_count", 0)) + 1
    try:
        supabase.table("operators").update({"submission_count": new_count}).eq(
            "operator_id", entry.operator_id
        ).execute()
    except Exception as exc:
        print(f"[submission_count update failed] {exc}")

    flagged_now = False
    notification_message: Optional[str] = None
    already_flagged = bool(operator.get("is_flagged", False))

    if new_count <= FLAG_SUBMISSION_WINDOW and efficiency < FLAG_EFFICIENCY_THRESHOLD and not already_flagged:
        reason = (
            f"Low efficiency ({efficiency:.1f}%) on submission #{new_count} "
            f"of their first {FLAG_SUBMISSION_WINDOW}."
        )
        try:
            supabase.table("operators").update({
                "is_flagged": True,
                "flagged_at": datetime.now(timezone.utc).isoformat(),
                "flag_reason": reason,
            }).eq("operator_id", entry.operator_id).execute()
            flagged_now = True

            notification_message = (
                f"You've been flagged for review after logging under "
                f"{FLAG_EFFICIENCY_THRESHOLD:.0f}% efficiency in your first "
                f"{new_count} submissions. This is so your supervisor can check "
                f"in and offer support — not a penalty."
            )
            supabase.table("notifications").insert({
                "operator_id": entry.operator_id,
                "audience": "operator",
                "type": "FLAG",
                "message": notification_message,
            }).execute()
            supabase.table("notifications").insert({
                "operator_id": entry.operator_id,
                "audience": "supervisor",
                "type": "FLAG",
                "message": f"{entry.operator_id} was flagged: {reason}",
            }).execute()
        except Exception as exc:
            print(f"[flagging failed] {exc}")

    return SubmitResponse(
        entry=saved_entry,
        prediction=prediction,
        risk=RiskInfo(risk_score=risk_score, risk_level=risk_level, is_outlier=is_outlier),
        flagged=flagged_now or already_flagged,
        flagged_now=flagged_now,
        submission_count=new_count,
        notification=notification_message,
    )


@app.get("/job-card/{operator_id}/latest", response_model=Optional[dict])
async def get_latest_entry(operator_id: str, _: dict = Depends(require_auth)):
    """Most recent entry for an operator — lets a frontend restore a
    submission-lock countdown correctly after a page refresh."""
    try:
        resp = (
            supabase.table("job_card_entries")
            .select("*")
            .eq("operator_id", operator_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database query failed: {exc}")
    return resp.data[0] if resp.data else None


@app.get("/job-card/{operator_id}/history", response_model=dict)
async def get_history(operator_id: str, _: dict = Depends(require_auth)):
    """Average efficiency, simple trend (last 6 vs. previous 6-ish), and
    raw history for one operator."""
    try:
        resp = (
            supabase.table("job_card_entries")
            .select("*")
            .eq("operator_id", operator_id)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database query failed: {exc}")

    history = resp.data or []
    effs = [row["efficiency"] for row in history if row.get("efficiency") is not None]
    avg_efficiency = round(sum(effs) / len(effs), 2) if effs else None

    trend = "NOT_ENOUGH_DATA"
    if len(effs) >= 6:
        last3 = sum(effs[0:3]) / 3
        prev3 = sum(effs[3:6]) / 3
        if last3 > prev3:
            trend = "IMPROVING"
        elif last3 < prev3:
            trend = "DECLINING"
        else:
            trend = "STABLE"

    return {
        "operator_id": operator_id,
        "average_efficiency": avg_efficiency,
        "trend": trend,
        "history": history,
    }


@app.get("/flags", response_model=list[FlaggedOperator])
async def get_flagged_operators(_: dict = Depends(require_auth)):
    try:
        resp = (
            supabase.table("operators")
            .select("operator_id, current_station, submission_count, is_flagged, flagged_at, flag_reason")
            .eq("is_flagged", True)
            .order("flagged_at", desc=True)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database query failed: {exc}")
    return resp.data or []


@app.put("/flags/{operator_id}/clear", response_model=dict)
async def clear_flag(operator_id: str, _: dict = Depends(require_auth)):
    try:
        resp = (
            supabase.table("operators")
            .update({"is_flagged": False, "flagged_at": None, "flag_reason": None})
            .eq("operator_id", operator_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database update failed: {exc}")
    if not resp.data:
        raise HTTPException(status_code=404, detail="Operator not found")
    return {"status": "ok", "operator": resp.data[0]}


@app.get("/notifications", response_model=list[NotificationOut])
async def get_notifications(
    audience: str = "supervisor",
    operator_id: Optional[str] = None,
    _: dict = Depends(require_auth),
):
    """audience='supervisor' for the floor-wide alert feed, or
    audience='operator'&operator_id=... for one operator's own alerts."""
    try:
        query = supabase.table("notifications").select("*").eq("audience", audience)
        if operator_id:
            query = query.eq("operator_id", operator_id)
        resp = query.order("created_at", desc=True).execute()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database query failed: {exc}")
    return resp.data or []


@app.put("/notifications/{notification_id}/read", response_model=dict)
async def mark_notification_read(notification_id: int, _: dict = Depends(require_auth)):
    try:
        resp = (
            supabase.table("notifications")
            .update({"is_read": True})
            .eq("id", notification_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database update failed: {exc}")
    if not resp.data:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok", "notification": resp.data[0]}
