import os
from datetime import datetime
from typing import Optional, Literal
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from supabase import Client, create_client
from predictive import predict

load_dotenv()

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_KEY"] # Bypass RLS for inserts
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# Supabase JWT Authentication
# ---------------------------------------------------------------------------
_bearer = HTTPBearer()

def require_auth(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """Validate token via Supabase Auth API."""
    try:
        token = credentials.credentials
        response = supabase.auth.get_user(token)
        if response.user is None:
            raise ValueError("No user in response")
        return {"user_id": response.user.id, "email": response.user.email}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

app = FastAPI(title="Opsis Risk Analyze", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
LOW_EFFICIENCY_THRESHOLD = float(os.environ.get("LOW_EFFICIENCY_THRESHOLD", "50"))
IMPOSSIBLE_MIN = float(os.environ.get("IMPOSSIBLE_MIN", "0"))
IMPOSSIBLE_MAX = float(os.environ.get("IMPOSSIBLE_MAX", "150"))

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class LaborerDataCreate(BaseModel):
    operator_id: str = Field(..., description="UUID of the operator")
    output: float
    smv: float
    manpower: float = 1.0
    working_minutes: float = 60.0
    date: str
    shift: Literal["day", "night"] = "day"
    operator_skill: Literal["A", "B", "C"] = "B"
    machine_status: Literal["ok", "maintenance", "breakdown"] = "ok"
    downtime_reason: Optional[str] = None

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.post("/laborers", status_code=201)
async def submit_job_card(body: LaborerDataCreate, current_user: dict = Depends(require_auth)):
    """Core Digital Job Card Submission."""
    
    # 1. Compute Efficiency
    try:
        efficiency = (body.output * body.smv) / (body.manpower * body.working_minutes) * 100
    except ZeroDivisionError:
        efficiency = float("inf")

    if not (IMPOSSIBLE_MIN <= efficiency <= IMPOSSIBLE_MAX):
        raise HTTPException(422, f"Impossible efficiency ({efficiency:.1f}%). Check input values.")

    # 2. Status & Root Cause Checks
    entry_status = "HIGH" if efficiency >= 85 else "MEDIUM" if efficiency >= 60 else "LOW"
    
    if entry_status == "LOW" and not body.downtime_reason:
        raise HTTPException(400, "downtime_reason is required when efficiency is LOW.")

    # 3. Call Predictive Model
    prediction = predict(
        target_output=body.output, # Using output as target base for mock
        working_minutes=body.working_minutes,
        operator_skill=body.operator_skill,
        shift=body.shift,
        machine_status=body.machine_status,
        historical_avg_efficiency=None # Can fetch avg dynamically if needed
    )

    predicted_output = prediction["predicted_output"]
    risk_score = round(abs((predicted_output - body.output) / predicted_output * 100), 2) if predicted_output > 0 else 0.0
    
    risk_level = "HIGH" if risk_score >= 25 else "MEDIUM" if risk_score >= 10 else "LOW"
    is_outlier = risk_score >= 50

    # 4. Insert into database
    insert_row = {
        "operator_id": body.operator_id,
        "output": body.output,
        "smv": body.smv,
        "working_minutes": body.working_minutes,
        "efficiency": round(efficiency, 2),
        "status": entry_status,
        "date": body.date,
        "shift": body.shift,
        "operator_skill": body.operator_skill,
        "machine_status": body.machine_status,
        "downtime_reason": body.downtime_reason,
        "predicted_output": prediction["predicted_output"],
        "predicted_efficiency": prediction["predicted_efficiency"],
        "efficiency_class": prediction["efficiency_class"],
        "batch_completion_time": prediction["batch_completion_time"],
        "risk_score": risk_score,
        "risk_level": risk_level,
        "is_outlier": is_outlier,
    }
    
    res = supabase.table("laborers_data").insert(insert_row).execute()
    entry = res.data[0]

    # 5. Check "First 3 Submissions" Rule dynamically using the NEW flags table
    count_res = supabase.table("laborers_data").select("id", count="exact").eq("operator_id", body.operator_id).execute()
    submission_count = count_res.count or 1

    op_res = supabase.table("operators").select("name, worker_id").eq("id", body.operator_id).single().execute()
    operator = op_res.data

    # Fetch current flag state from the operator_flags table
    flag_res = supabase.table("operator_flags").select("is_flagged").eq("operator_id", body.operator_id).execute()
    is_flagged = flag_res.data[0]["is_flagged"] if flag_res.data else False

    flagged_now = False
    if submission_count <= 3 and efficiency < LOW_EFFICIENCY_THRESHOLD and not is_flagged:
        reason = f"Low efficiency ({efficiency:.1f}%) on submission #{submission_count} of their first 3."
        
        # UPSERT into the dedicated flags table
        supabase.table("operator_flags").upsert({
            "operator_id": body.operator_id,
            "is_flagged": True, 
            "flagged_at": datetime.utcnow().isoformat(), 
            "flag_reason": reason,
            "updated_at": datetime.utcnow().isoformat()
        }).execute()
        
        flagged_now = True

        supabase.table("notifications").insert([
            {"operator_id": body.operator_id, "audience": "employee", "type": "FLAG", "message": f"You've been flagged for review. This is for support, not a penalty."},
            {"operator_id": body.operator_id, "audience": "supervisor", "type": "FLAG", "message": f"{operator['name']} ({operator['worker_id']}) flagged: {reason}"}
        ]).execute()

    return {
        "entry": entry,
        "prediction": prediction,
        "risk": {"risk_score": risk_score, "risk_level": risk_level, "is_outlier": is_outlier},
        "flagged_now": flagged_now,
        "submission_count": submission_count
    }

# NEW ENDPOINT: Replaces the old /labers fetch for the frontend
@app.get("/operators")
async def get_operators(current_user: dict = Depends(require_auth)):
    res = supabase.table("operators").select("id, name, worker_id").execute()
    return res.data

@app.get("/laborers")
async def get_all_entries(current_user: dict = Depends(require_auth)):
    res = supabase.table("laborers_data").select("*, operators(name, worker_id)").order("date", desc=True).order("time", desc=True).execute()
    
    # Flatten response for frontend
    rows = []
    for row in res.data:
        op = row.pop("operators", None) or {}
        row["laborer_name"] = op.get("name")
        row["employee_code"] = op.get("worker_id")
        rows.append(row)
    return rows

@app.get("/analysis/{operator_id}")
async def get_analysis(operator_id: str, current_user: dict = Depends(require_auth)):
    history_res = supabase.table("laborers_data").select("*").eq("operator_id", operator_id).order("date").order("time").execute()
    history = history_res.data

    effs = [float(r["efficiency"]) for r in history]
    average_efficiency = sum(effs) / len(effs) if effs else None

    trend_vals = effs[-6:]
    trend = "NOT_ENOUGH_DATA"
    if len(trend_vals) >= 6:
        last3 = sum(trend_vals[3:6]) / 3
        prev3 = sum(trend_vals[0:3]) / 3
        trend = "IMPROVING" if last3 > prev3 else "DECLINING" if last3 < prev3 else "STABLE"

    return {
        "operator_id": operator_id,
        "average_efficiency": average_efficiency,
        "trend": trend,
        "latest": history[-1] if history else None,
        "history": history,
    }

# UPDATED: Fetch flags from the new table and join operator details
@app.get("/flags")
async def get_flags(current_user: dict = Depends(require_auth)):
    res = supabase.table("operator_flags").select("operator_id, is_flagged, flagged_at, flag_reason, operators(name, worker_id)").eq("is_flagged", True).order("flagged_at", desc=True).execute()
    
    # Flatten the data so the frontend receives a clean object
    rows = []
    for row in res.data:
        op = row.pop("operators", None) or {}
        row["id"] = row.pop("operator_id") # Map UUID to 'id' for the frontend
        row["name"] = op.get("name")
        row["employee_code"] = op.get("worker_id")
        rows.append(row)
    return rows

# UPDATED: Clear flags from the new table
@app.put("/flags/{operator_id}/clear")
async def clear_flag(operator_id: str, current_user: dict = Depends(require_auth)):
    res = supabase.table("operator_flags").update({
        "is_flagged": False, 
        "flagged_at": None, 
        "flag_reason": None,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("operator_id", operator_id).execute()
    return res.data[0] if res.data else None