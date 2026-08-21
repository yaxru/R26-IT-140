"""
risk_analyze — Real-Time Risk Detection & Digital Data Capture

Ported from the original Node.js/Express + PostgreSQL prototype
("Line Pulse — Digital Job Card") to Python/FastAPI + Supabase, to match
the pattern used by sibling services (see ../worker_reallocation/main.py).

Auth note: this service uses its OWN JWT auth (see auth.py) rather than
Supabase Auth's get_user(), because employees log in with only their
Employee ID and have no Supabase Auth account. Supabase is used purely as
the Postgres database via the supabase-py table client. This is a
deliberate, separate login flow from the client app's general
Supabase-authenticated dashboard — see client/app/risk-analyze/.
"""
from __future__ import annotations

import os
from datetime import date as date_type, timedelta
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from supabase import Client, create_client

from auth import (
    create_token,
    hash_password,
    require_admin,
    require_auth,
    verify_password,
)
from predictive import predict
from schemas import (
    AuthResponse,
    AuthUser,
    EmployeeLoginRequest,
    LaborerDataCreate,
    RegisterRequest,
    SupervisorLoginRequest,
    UpdateLaberRequest,
)

load_dotenv()

# ---------------------------------------------------------------------------
# Supabase client (used as the Postgres database only — not Supabase Auth)
# ---------------------------------------------------------------------------
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="StitchFlow Risk Analyze", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# ---------------------------------------------------------------------------
# Constants — override via env vars, same style as worker_reallocation
# ---------------------------------------------------------------------------
LOW_EFFICIENCY_THRESHOLD = float(os.environ.get("LOW_EFFICIENCY_THRESHOLD", "50"))
IMPOSSIBLE_MIN = float(os.environ.get("IMPOSSIBLE_MIN", "0"))
IMPOSSIBLE_MAX = float(os.environ.get("IMPOSSIBLE_MAX", "150"))


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "StitchFlow Risk Analyze"}


# =============================================================================
# AUTH
# =============================================================================

@app.post("/register", response_model=dict, status_code=201)
async def register(body: RegisterRequest):
    """Admin creates admins (floor managers/supervisors) or employees."""
    if body.role == "labor" and not body.employee_code:
        raise HTTPException(400, "employee_code is required for role='labor' (e.g. 'EMP001').")

    existing_name = supabase.table("labers").select("id").eq("name", body.name).execute()
    if existing_name.data:
        raise HTTPException(400, "User already exists")

    if body.employee_code:
        existing_code = (
            supabase.table("labers").select("id").eq("employee_code", body.employee_code).execute()
        )
        if existing_code.data:
            raise HTTPException(400, "employee_code already in use")

    row = {
        "name": body.name,
        "age": body.age,
        "role": body.role,
        "employee_code": body.employee_code,
        "password": hash_password(body.password),
    }
    result = supabase.table("labers").insert(row).execute()
    user = result.data[0]
    user.pop("password", None)
    return {"message": "User registered successfully", "user": user}


@app.post("/login", response_model=AuthResponse)
async def login(body: SupervisorLoginRequest):
    """Floor manager / supervisor login — by name + password."""
    res = supabase.table("labers").select("*").eq("name", body.name).execute()
    if not res.data:
        raise HTTPException(404, "User not found")
    user = res.data[0]

    if not verify_password(body.password, user["password"]):
        raise HTTPException(401, "Invalid password")

    token = create_token(
        {"id": user["id"], "name": user["name"], "role": user["role"]},
        expires_in=timedelta(days=7),
    )
    return AuthResponse(
        message="Login successful",
        token=token,
        user=AuthUser(
            id=user["id"], name=user["name"], role=user["role"], employee_code=user.get("employee_code")
        ),
    )


@app.post("/employee-login", response_model=AuthResponse)
async def employee_login(body: EmployeeLoginRequest):
    """
    Employee login — Employee ID ONLY, no password.

    This is intentionally simpler than the supervisor/floor-manager login:
    employees just punch in their Employee ID to start logging their hour.
    """
    if not body.employee_code or not body.employee_code.strip():
        raise HTTPException(400, "employee_code is required")

    code = body.employee_code.strip().upper()
    res = supabase.table("labers").select("*").eq("employee_code", code).execute()
    if not res.data or res.data[0]["role"] != "labor":
        raise HTTPException(404, "Employee ID not found")
    user = res.data[0]

    token = create_token(
        {"id": user["id"], "name": user["name"], "role": user["role"], "employee_code": user["employee_code"]},
        expires_in=timedelta(hours=12),
    )
    return AuthResponse(
        message="Login successful",
        token=token,
        user=AuthUser(
            id=user["id"],
            name=user["name"],
            role=user["role"],
            employee_code=user["employee_code"],
            submission_count=user.get("submission_count"),
            is_flagged=user.get("is_flagged"),
        ),
    )


# =============================================================================
# USERS (labers)
# =============================================================================

@app.get("/labers", response_model=list[dict])
async def get_all_labers(_: dict = Depends(require_auth)):
    res = (
        supabase.table("labers")
        .select("id, name, age, role, employee_code, submission_count, is_flagged, flagged_at, flag_reason")
        .order("id")
        .execute()
    )
    return res.data


@app.get("/labers/{laber_id}", response_model=dict)
async def get_laber_by_id(laber_id: int, _: dict = Depends(require_auth)):
    res = supabase.table("labers").select("*").eq("id", laber_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Not found")
    user = res.data
    user.pop("password", None)
    return user


@app.put("/labers/{laber_id}", response_model=dict)
async def update_laber(laber_id: int, body: UpdateLaberRequest, _: dict = Depends(require_admin)):
    update_data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "password" in update_data:
        update_data["password"] = hash_password(update_data["password"])
    res = supabase.table("labers").update(update_data).eq("id", laber_id).execute()
    if not res.data:
        raise HTTPException(404, "Not found")
    user = res.data[0]
    user.pop("password", None)
    return user


@app.delete("/labers/{laber_id}", response_model=dict)
async def delete_laber(laber_id: int, _: dict = Depends(require_admin)):
    supabase.table("labers").delete().eq("id", laber_id).execute()
    return {"message": "Deleted successfully"}


# =============================================================================
# HOURLY LOG SUBMISSION — the Digital Job Card (core function)
# =============================================================================
#
# Flow:
#   1. Validate the employee exists and is a "labor"
#   2. Compute ACTUAL efficiency from the Digital Job Card formula
#   3. Data-integrity check — reject physically impossible values
#   4. Force a downtime reason when efficiency is LOW (root-cause capture)
#   5. Call the predictive model (mocked) for predicted_output etc.
#   6. Compute a risk score = variance between actual output and predicted output
#   7. Insert the row
#   8. Apply the "first 3 submissions < 50% efficiency" flag rule
#   9. Return everything the frontend needs (entry + prediction + risk + flag)

@app.post("/laborers", response_model=dict, status_code=201)
async def create_laborer_data(body: LaborerDataCreate, _: dict = Depends(require_auth)):
    emp_res = supabase.table("labers").select("*").eq("id", body.laborers_id).single().execute()
    if not emp_res.data or emp_res.data["role"] != "labor":
        raise HTTPException(404, "Employee not found")
    employee = emp_res.data

    # ---- 1. Actual efficiency (the formula) ----
    try:
        efficiency = (body.output * body.smv) / (body.manpower * body.working_minutes) * 100
    except ZeroDivisionError:
        efficiency = float("inf")

    # ---- 2. Data integrity / outlier rejection ----
    if not (IMPOSSIBLE_MIN <= efficiency <= IMPOSSIBLE_MAX):
        eff_display = f"{efficiency:.1f}" if efficiency == efficiency else "NaN"  # NaN != NaN
        raise HTTPException(
            422,
            f"Data integrity check failed: computed efficiency ({eff_display}%) is outside a "
            f"physically possible range. Please check the entered values.",
        )

    # ---- 3. Status classification ----
    if efficiency >= 85:
        entry_status = "HIGH"
    elif efficiency >= 60:
        entry_status = "MEDIUM"
    else:
        entry_status = "LOW"

    # ---- 4. Force root-cause capture on LOW entries ----
    if entry_status == "LOW" and not body.downtime_reason:
        raise HTTPException(
            400,
            "downtime_reason is required when efficiency is LOW (e.g. 'Mechanical Failure', "
            "'Supply Delay', 'Power Outage', 'Absenteeism', 'Rework/Quality Issue', 'Other').",
        )

    # ---- 5. Predictive model (mocked) ----
    avg_res = (
        supabase.table("laborers_data")
        .select("efficiency")
        .eq("laborers_id", body.laborers_id)
        .execute()
    )
    historical_avg_efficiency = None
    if avg_res.data:
        vals = [float(r["efficiency"]) for r in avg_res.data]
        historical_avg_efficiency = sum(vals) / len(vals) if vals else None

    prediction = predict(
        target_output=body.output,
        working_minutes=body.working_minutes,
        operator_skill=body.operator_skill,
        shift=body.shift,
        machine_status=body.machine_status,
        historical_avg_efficiency=historical_avg_efficiency,
    )

    # ---- 6. Risk score: how far actual output is from predicted output ----
    predicted_output = prediction["predicted_output"]
    risk_score = (
        round(abs((predicted_output - body.output) / predicted_output * 100), 2)
        if predicted_output > 0
        else 0.0
    )
    if risk_score >= 25:
        risk_level = "HIGH"
    elif risk_score >= 10:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"
    is_outlier = risk_score >= 50

    # ---- 7. Insert ----
    insert_row = {
        "laborers_id": body.laborers_id,
        "output": body.output,
        "smv": body.smv,
        "manpower": body.manpower,
        "working_minutes": body.working_minutes,
        "date": body.date,
        "shift": body.shift,
        "operator_skill": body.operator_skill,
        "machine_status": body.machine_status,
        "downtime_reason": body.downtime_reason,
        "efficiency": round(efficiency, 2),
        "status": entry_status,
        "predicted_output": prediction["predicted_output"],
        "predicted_efficiency": prediction["predicted_efficiency"],
        "efficiency_class": prediction["efficiency_class"],
        "batch_completion_time": prediction["batch_completion_time"],
        "risk_score": risk_score,
        "risk_level": risk_level,
        "is_outlier": is_outlier,
    }
    insert_res = supabase.table("laborers_data").insert(insert_row).execute()
    entry = insert_res.data[0]

    # ---- 8. First-3-submissions low-efficiency flag rule ----
    new_count = (employee.get("submission_count") or 0) + 1
    supabase.table("labers").update({"submission_count": new_count}).eq("id", body.laborers_id).execute()

    flagged_now = False
    employee_notification = None

    if new_count <= 3 and efficiency < LOW_EFFICIENCY_THRESHOLD and not employee.get("is_flagged"):
        reason = f"Low efficiency ({efficiency:.1f}%) on submission #{new_count} of their first 3."
        supabase.table("labers").update(
            {"is_flagged": True, "flagged_at": "now()", "flag_reason": reason}
        ).eq("id", body.laborers_id).execute()
        flagged_now = True

        employee_notification = (
            f"You've been flagged for review after logging under {LOW_EFFICIENCY_THRESHOLD:.0f}% "
            f"efficiency in your first {new_count} submissions. This is so your supervisor can check "
            f"in and offer support — not a penalty."
        )

        supabase.table("notifications").insert(
            {
                "laborer_id": body.laborers_id,
                "audience": "employee",
                "type": "FLAG",
                "message": employee_notification,
            }
        ).execute()
        supabase.table("notifications").insert(
            {
                "laborer_id": body.laborers_id,
                "audience": "supervisor",
                "type": "FLAG",
                "message": f"{employee['name']} ({employee['employee_code']}) was flagged: {reason}",
            }
        ).execute()

    return {
        "entry": entry,
        "prediction": prediction,
        "risk": {"risk_score": risk_score, "risk_level": risk_level, "is_outlier": is_outlier},
        "flagged": flagged_now or bool(employee.get("is_flagged")),
        "flagged_now": flagged_now,
        "submission_count": new_count,
        "notification": employee_notification,
    }


@app.get("/laborers", response_model=list[dict])
async def get_all_laborer_data(_: dict = Depends(require_auth)):
    res = (
        supabase.table("laborers_data")
        .select("*, labers(name, employee_code)")
        .order("date", desc=True)
        .order("time", desc=True)
        .execute()
    )
    rows = []
    for row in res.data:
        laber = row.pop("labers", None) or {}
        row["laborer_name"] = laber.get("name")
        row["employee_code"] = laber.get("employee_code")
        rows.append(row)
    return rows


@app.get("/laborers/latest/{laborers_id}", response_model=Optional[dict])
async def get_latest_entry(laborers_id: int, _: dict = Depends(require_auth)):
    res = (
        supabase.table("laborers_data")
        .select("*")
        .eq("laborers_id", laborers_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


# =============================================================================
# ANALYSIS
# =============================================================================

@app.get("/analysis/{laborers_id}", response_model=dict)
async def get_analysis(laborers_id: int, _: dict = Depends(require_auth)):
    history_res = (
        supabase.table("laborers_data")
        .select("*")
        .eq("laborers_id", laborers_id)
        .order("date")
        .order("time")
        .execute()
    )
    history = history_res.data

    effs = [float(r["efficiency"]) for r in history]
    average_efficiency = sum(effs) / len(effs) if effs else None

    total_minutes = sum(float(r["working_minutes"]) for r in history)
    weighted_average = (
        sum(float(r["efficiency"]) * float(r["working_minutes"]) for r in history) / total_minutes
        if total_minutes
        else None
    )

    trend_res = (
        supabase.table("laborers_data")
        .select("efficiency")
        .eq("laborers_id", laborers_id)
        .order("date", desc=True)
        .order("time", desc=True)
        .limit(6)
        .execute()
    )
    trend_vals = [float(r["efficiency"]) for r in trend_res.data]
    if len(trend_vals) < 6:
        trend = "NOT_ENOUGH_DATA"
    else:
        last3 = sum(trend_vals[0:3]) / 3
        prev3 = sum(trend_vals[3:6]) / 3
        trend = "IMPROVING" if last3 > prev3 else "DECLINING" if last3 < prev3 else "STABLE"

    latest = history[-1] if history else None

    return {
        "laborers_id": laborers_id,
        "average_efficiency": average_efficiency,
        "weighted_average": weighted_average,
        "trend": trend,
        "latest": latest,
        "history": history,
    }


# =============================================================================
# FLAGS (floor manager / supervisor dashboard)
# =============================================================================

@app.get("/flags", response_model=list[dict])
async def get_flagged_employees(_: dict = Depends(require_admin)):
    res = (
        supabase.table("labers")
        .select("id, name, age, employee_code, submission_count, is_flagged, flagged_at, flag_reason")
        .eq("role", "labor")
        .eq("is_flagged", True)
        .order("flagged_at", desc=True)
        .execute()
    )
    return res.data


@app.put("/flags/{laber_id}/clear", response_model=dict)
async def clear_flag(laber_id: int, _: dict = Depends(require_admin)):
    res = (
        supabase.table("labers")
        .update({"is_flagged": False, "flagged_at": None, "flag_reason": None})
        .eq("id", laber_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Not found")
    return res.data[0]


# =============================================================================
# NOTIFICATIONS
# =============================================================================

@app.get("/notifications/employee/{laborers_id}", response_model=list[dict])
async def get_employee_notifications(laborers_id: int, _: dict = Depends(require_auth)):
    res = (
        supabase.table("notifications")
        .select("*")
        .eq("laborer_id", laborers_id)
        .eq("audience", "employee")
        .order("created_at", desc=True)
        .execute()
    )
    return res.data


@app.get("/notifications/supervisor", response_model=list[dict])
async def get_supervisor_notifications(_: dict = Depends(require_admin)):
    res = (
        supabase.table("notifications")
        .select("*, labers(name, employee_code)")
        .eq("audience", "supervisor")
        .order("created_at", desc=True)
        .execute()
    )
    rows = []
    for row in res.data:
        laber = row.pop("labers", None) or {}
        row["laborer_name"] = laber.get("name")
        row["employee_code"] = laber.get("employee_code")
        rows.append(row)
    return rows


@app.put("/notifications/{notification_id}/read", response_model=dict)
async def mark_notification_read(notification_id: int, _: dict = Depends(require_auth)):
    res = (
        supabase.table("notifications")
        .update({"is_read": True})
        .eq("id", notification_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Not found")
    return res.data[0]
