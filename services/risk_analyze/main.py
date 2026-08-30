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
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3001",
        'https://admin.opsis.getmerge.co',
        'https://portal.opsis.getmerge.co',
    ],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
LOW_EFFICIENCY_THRESHOLD = float(os.environ.get("LOW_EFFICIENCY_THRESHOLD", "50"))
IMPOSSIBLE_MIN = float(os.environ.get("IMPOSSIBLE_MIN", "0"))
IMPOSSIBLE_MAX = float(os.environ.get("IMPOSSIBLE_MAX", "150"))

class LaborerDataCreate(BaseModel):
    operator_id: str
    line_id: str
    station_id: str
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
    # 1. Compute Efficiency
    try:
        efficiency = (body.output * body.smv) / (body.manpower * body.working_minutes) * 100
    except ZeroDivisionError:
        efficiency = float("inf")

    if not (IMPOSSIBLE_MIN <= efficiency <= IMPOSSIBLE_MAX):
        raise HTTPException(422, f"Impossible efficiency ({efficiency:.1f}%). Check input values.")

    entry_status = "HIGH" if efficiency >= 85 else "MEDIUM" if efficiency >= 60 else "LOW"
    
    if entry_status == "LOW" and not body.downtime_reason:
        raise HTTPException(400, "downtime_reason is required when efficiency is LOW.")

    # 2. Call Predictive Model
    prediction = predict(
        target_output=body.output, 
        working_minutes=body.working_minutes,
        operator_skill=body.operator_skill,
        shift=body.shift,
        machine_status=body.machine_status,
        historical_avg_efficiency=None 
    )

    predicted_output = prediction["predicted_output"]
    risk_score = round(abs((predicted_output - body.output) / predicted_output * 100), 2) if predicted_output > 0 else 0.0
    risk_level = "HIGH" if risk_score >= 25 else "MEDIUM" if risk_score >= 10 else "LOW"
    is_outlier = risk_score >= 50

    # 3. Insert into laborers_data
    insert_row = {
        "operator_id": body.operator_id,
        "line_id": body.line_id,
        "station_id": body.station_id,
        "output": body.output,
        "smv": body.smv,
        "working_minutes": int(body.working_minutes),
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

    try:
        supabase.table("daily_inputs").insert({
            "operator_id": body.operator_id, "line_id": body.line_id, "station_id": body.station_id, "quantity_completed": int(body.output)
        }).execute()
    except Exception:
        pass

    try:
        todays_records = supabase.table("laborers_data").select("output, efficiency").eq("operator_id", body.operator_id).eq("date", body.date).execute()
        if todays_records.data:
            total_output = sum(r["output"] for r in todays_records.data)
            avg_eff = sum(r["efficiency"] for r in todays_records.data) / len(todays_records.data)
            final_status = "HIGH" if avg_eff >= 85 else "MEDIUM" if avg_eff >= 60 else "LOW"
            
            hist_res = supabase.table("operator_daily_history").select("id").eq("operator_id", body.operator_id).eq("date", body.date).execute()
            if hist_res.data:
                supabase.table("operator_daily_history").update({
                    "total_output": total_output, "average_efficiency": round(avg_eff, 2), "final_status": final_status
                }).eq("id", hist_res.data[0]["id"]).execute()
            else:
                supabase.table("operator_daily_history").insert({
                    "operator_id": body.operator_id, "date": body.date, "total_output": total_output, "average_efficiency": round(avg_eff, 2), "final_status": final_status
                }).execute()
    except Exception:
        pass

    try:
        actual_prod_ratio = round(efficiency / 100, 4)
        supabase.table("production_status").update({"actual_productivity": actual_prod_ratio}).eq("station_id", body.station_id).execute()
    except Exception:
        pass

    # 4. FIX: Flagging Logic (Strictly scoped to TODAY)
    count_res = supabase.table("laborers_data").select("id", count="exact").eq("operator_id", body.operator_id).eq("date", body.date).execute()
    todays_submission_count = count_res.count or 1

    flag_res = supabase.table("operator_flags").select("is_flagged, updated_at").eq("operator_id", body.operator_id).execute()
    
    is_flagged_today = False
    if flag_res.data:
        f_data = flag_res.data[0]
        if f_data["is_flagged"]:
            flag_date = f_data.get("updated_at", "").split("T")[0]
            if flag_date == body.date:
                is_flagged_today = True

    flagged_now = False
    # Only flag if it's within the first 3 submissions OF TODAY, and they aren't already flagged TODAY
    if todays_submission_count <= 3 and efficiency < LOW_EFFICIENCY_THRESHOLD and not is_flagged_today:
        reason = f"Low efficiency ({efficiency:.1f}%) on submission #{todays_submission_count} of today's shift."
        
        supabase.table("operator_flags").upsert({
            "operator_id": body.operator_id,
            "is_flagged": True, 
            "flagged_at": datetime.utcnow().isoformat(), 
            "flag_reason": reason,
            "updated_at": datetime.utcnow().isoformat()
        }).execute()
        flagged_now = True

        op_res = supabase.table("operators").select("name, worker_id").eq("id", body.operator_id).single().execute()
        operator = op_res.data
        supabase.table("notifications").insert([
            {"operator_id": body.operator_id, "audience": "employee", "type": "FLAG", "message": f"You've been flagged for review. This is for support, not a penalty."},
            {"operator_id": body.operator_id, "audience": "supervisor", "type": "FLAG", "message": f"{operator['name']} ({operator['worker_id']}) flagged: {reason}"}
        ]).execute()

    return {
        "entry": entry,
        "prediction": prediction,
        "risk": {"risk_score": risk_score, "risk_level": risk_level, "is_outlier": is_outlier},
        "flagged_now": flagged_now,
        "submission_count": todays_submission_count
    }

@app.get("/operators")
async def get_operators(current_user: dict = Depends(require_auth)):
    res = supabase.table("operators").select("id, name, worker_id").execute()
    return res.data

@app.get("/laborers")
async def get_all_entries(current_user: dict = Depends(require_auth)):
    res = supabase.table("laborers_data").select("*, operators(name, worker_id)").order("date", desc=True).order("time", desc=True).execute()
    rows = []
    for row in res.data:
        op = row.pop("operators", None) or {}
        row["laborer_name"] = op.get("name")
        row["employee_code"] = op.get("worker_id")
        rows.append(row)
    return rows

@app.get("/flags")
async def get_flags(current_user: dict = Depends(require_auth)):
    res = supabase.table("operator_flags").select("operator_id, is_flagged, flagged_at, flag_reason, updated_at, operators(name, worker_id)").eq("is_flagged", True).order("flagged_at", desc=True).execute()
    
    today_str = datetime.utcnow().date().isoformat()
    valid_rows = []
    
    for row in res.data:
        # FIX: Lazy clear old flags so they don't show up on the frontend the next day
        flag_date = row.get("updated_at", "").split("T")[0]
        if flag_date < today_str:
            supabase.table("operator_flags").update({"is_flagged": False, "flag_reason": "Auto-cleared (New Shift)"}).eq("operator_id", row["operator_id"]).execute()
            continue
            
        op = row.pop("operators", None) or {}
        row["id"] = row.pop("operator_id") 
        row["name"] = op.get("name")
        row["employee_code"] = op.get("worker_id")
        valid_rows.append(row)
        
    return valid_rows

@app.put("/flags/{operator_id}/clear")
async def clear_flag(operator_id: str, current_user: dict = Depends(require_auth)):
    res = supabase.table("operator_flags").update({
        "is_flagged": False, 
        "flagged_at": None, 
        "flag_reason": None,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("operator_id", operator_id).execute()
    return res.data[0] if res.data else None