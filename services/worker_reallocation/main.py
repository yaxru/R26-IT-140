import os
import datetime
from enum import Enum
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from supabase import create_client, Client
from dotenv import load_dotenv

from algorithm import evaluate_donor_risks, projected_donor_gap_pct, select_workers

load_dotenv()

# ---------------------------------------------------------------------------
# Supabase client
# ---------------------------------------------------------------------------
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# JWT authentication
# ---------------------------------------------------------------------------
_bearer = HTTPBearer()

def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    try:
        token = credentials.credentials
        response = supabase.auth.get_user(token)
        if response.user is None:
            raise ValueError("No user in response")
        return {"user_id": response.user.id, "email": response.user.email}
    except Exception as e:
        print(f"[AUTH ERROR] {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

app = FastAPI(title="StitchFlow Profitability Engine", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^http://192\.168\.1\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d):3000$",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# ---------------------------------------------------------------------------
# Constants 
# ---------------------------------------------------------------------------
SHIFT_REMAINING_MIN: float = float(os.environ.get("SHIFT_REMAINING_MIN", "240"))
BOTTLENECK_THRESHOLD_PCT: float = float(os.environ.get("BOTTLENECK_THRESHOLD_PCT", "5"))
COOLDOWN_MINUTES: int = 15 # Configurable time for a worker to relocate and warm up

class ProficiencyGrade(str, Enum):
    A = "A"
    B = "B"
    C = "C"

# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------
class SkillMatrixEntry(BaseModel):
    operator_id: str = Field(..., example="OP-025")
    machine_type: str = Field(..., example="overlock")
    proficiency_grade: ProficiencyGrade

class RecommendRequest(BaseModel):
    bottleneck_station: str = Field(..., example="Station-05")
    required_skill: str = Field(..., example="overlock")
    targeted_productivity: Optional[float] = Field(None, example=0.75)
    actual_productivity: Optional[float] = Field(None, example=0.60)

class SingleMove(BaseModel):
    operator_id: str
    operator_name: Optional[str] = None 
    worker_pin: Optional[str] = None    
    from_station: Optional[str]
    to_station: str
    proficiency_grade: str
    cost_of_move: float
    expected_production_gain: float
    net_profit: float
    donor_cascade_risk: bool
    donor_risk_detail: Optional[str]
    donor_replacement_id: Optional[str] = None
    donor_replacement_grade: Optional[str] = None

class MoveInstruction(BaseModel):
    recommended: bool
    no_move_reason: Optional[str]
    moves: list[SingleMove]
    workers_needed: int
    workers_found: int
    gap_coverage_pct: float
    total_net_profit: float
    cascade_warnings: list[str]
    instruction: str
    operator_id: str
    operator_name: Optional[str] = None 
    worker_pin: Optional[str] = None    
    from_station: Optional[str]
    to_station: str
    proficiency_grade: str
    cost_of_move: float
    expected_production_gain: float
    net_profit: float

class StationOut(BaseModel):
    station_id: str
    wip: int
    required_skill: str
    is_bottleneck: bool
    targeted_productivity: Optional[float] = None
    actual_productivity: Optional[float] = None
    line_id: Optional[str] = None
    cooldown_until: Optional[str] = None # Added for frontend UI badge

class SkillMatrixOut(BaseModel):
    operator_id: str
    operator_name: Optional[str] = None 
    worker_pin: Optional[str] = None    
    machine_type: str
    proficiency_grade: str
    efficiency_pct: float

class StationSetup(BaseModel):
    station_id: str = Field(..., example="Station-01")
    sequence_order: int = Field(default=1, example=1)
    required_skill: str = Field(..., example="single_needle")

class LineLayoutRequest(BaseModel):
    line_id: str = Field(..., example="Line-A")
    stations: list[StationSetup]

class WorkerAssignment(BaseModel):
    operator_id: str
    station_id: Optional[str] = Field(None, description="Null means returned to the unassigned pool")

class BatchAssignmentRequest(BaseModel):
    line_id: str
    assignments: list[WorkerAssignment]

class AcceptMoveItem(BaseModel):
    operator_id: str
    from_station: Optional[str]
    to_station: str
    machine_type: str
    proficiency_grade: str

class AcceptMoveRequest(BaseModel):
    moves: list[AcceptMoveItem]

    
# ---------------------------------------------------------------------------
# Dynamic Config Fetcher
# ---------------------------------------------------------------------------
def get_algorithm_config():
    res = supabase.table("algorithm_config").select("key, value").execute()
    config = {row["key"]: row["value"] for row in res.data}
    
    return {
        "learning_penalty": config.get("learning_penalty", {"A": 2.0, "B": 5.0, "C": 10.0}),
        "grade_efficiency": config.get("grade_efficiency", {"A": 1.00, "B": 0.85, "C": 0.70}),
        "fallback_gain": config.get("fallback_gain", {"A": 20.0, "B": 14.0, "C": 8.0}),
        "system": config.get("system_constants", {"per_worker_gain_fraction": 0.12, "t_relocation_min": 5.0})
    }

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "StitchFlow Profitability Engine V2.1"}

@app.post("/line-layout", response_model=dict)
async def setup_line_layout(request: LineLayoutRequest, _: dict = Depends(require_auth)):
    errors = []
    upsert_data = []

    for station in request.stations:
        upsert_data.append({
            "station_id": station.station_id,
            "line_id": request.line_id,
            "sequence_order": station.sequence_order,
            "required_skill": station.required_skill,
            "wip": 0,
            "actual_productivity": 0.0,
            "targeted_productivity": 0.85,
            "cooldown_until": None # Reset cooldown on layout change
        })

    try:
        supabase.table("production_status").upsert(
            upsert_data, 
            on_conflict="station_id"
        ).execute()
    except Exception as exc:
        errors.append(f"Failed to update line layout: {exc}")

    if errors:
        raise HTTPException(status_code=503, detail="; ".join(errors))

    return {
        "status": "success", 
        "message": f"Successfully configured {len(request.stations)} stations for {request.line_id}.",
        "updated_stations": [s.station_id for s in request.stations]
    }

@app.get("/stations", response_model=list[StationOut])
async def get_stations(_: dict = Depends(require_auth)):
    try:
        # Fetch base station config, now including cooldown_until
        response = supabase.table("production_status").select(
            "station_id, line_id, wip, required_skill, targeted_productivity, actual_productivity, cooldown_until"
        ).order("station_id").execute()
        
        # Fetch TODAY'S actual performance from laborers_data
        today_str = datetime.datetime.utcnow().date().isoformat()
        ld_res = supabase.table("laborers_data").select("station_id, efficiency").eq("date", today_str).execute()
        
        station_today = {}
        if ld_res.data:
            for r in ld_res.data:
                sid = r.get("station_id")
                eff = r.get("efficiency")
                if sid and eff is not None:
                    if sid not in station_today:
                        station_today[sid] = []
                    station_today[sid].append(float(eff))
                    
        # Calculate today's average efficiency per station (scaled 0.0 to 1.0)
        today_actuals = {sid: round((sum(effs)/len(effs))/100.0, 4) for sid, effs in station_today.items()}
        
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database query failed: {exc}")
        
    if not response.data:
        raise HTTPException(status_code=404, detail="No stations found.")

    threshold = BOTTLENECK_THRESHOLD_PCT / 100
    result = []
    
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    
    for s in response.data:
        sid = s["station_id"]
        t = s.get("targeted_productivity")
        
        # Override the static table value with TODAY'S live average
        a = today_actuals.get(sid, 0.0)
        s["actual_productivity"] = a
        
        # Evaluate cooldown status
        cooldown_str = s.get("cooldown_until")
        in_cooldown = False
        if cooldown_str:
            try:
                # Handle ISO8601 formatting from Supabase
                cooldown_time = datetime.datetime.fromisoformat(cooldown_str.replace("Z", "+00:00"))
                if now_utc < cooldown_time:
                    in_cooldown = True
            except Exception as e:
                print(f"[DATE PARSE ERROR] {e}")

        # Avoid marking offline/unstarted stations OR stations in transit as bottlenecks
        if t is None or t <= 0 or a == 0.0 or in_cooldown:
            is_bottleneck = False
        else:
            is_bottleneck = (t - a) / t >= threshold
            
        result.append({**s, "is_bottleneck": is_bottleneck})

    return result

@app.get("/skill-matrix", response_model=list[SkillMatrixOut])
def get_skill_matrix(_: dict = Depends(require_auth)):
    res = supabase.table("skill_matrix").select(
        "operator_id, machine_type, proficiency_grade, operators(name, worker_id)"
    ).execute()
    
    formatted_data = []
    for row in res.data:
        operator_info = row.get("operators") or {}
        grade = row.get("proficiency_grade", "C")
        
        eff_pct = 95.0 if grade == "A" else 75.0 if grade == "B" else 55.0
        
        formatted_data.append({
            "operator_id": row["operator_id"],
            "machine_type": row["machine_type"],
            "proficiency_grade": grade,
            "operator_name": operator_info.get("name", "Unknown"),
            "worker_pin": operator_info.get("worker_id", "N/A"),
            "efficiency_pct": eff_pct
        })
        
    return formatted_data

@app.post("/recommend", response_model=MoveInstruction)
async def recommend(request: RecommendRequest, _: dict = Depends(require_auth)):
    config = get_algorithm_config()
    per_worker_fraction = config["system"]["per_worker_gain_fraction"]

    try:
        sm_response = (
            supabase.table("skill_matrix")
            .select("operator_id, machine_type, proficiency_grade, operators(name, worker_id)")
            .eq("machine_type", request.required_skill)
            .in_("proficiency_grade", ["A", "B", "C"])
            .order("proficiency_grade")
            .limit(20)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database query failed: {exc}")

    candidates_raw = sm_response.data
    if not candidates_raw:
        raise HTTPException(status_code=404, detail=f"No qualified operators found for skill '{request.required_skill}'.")

    candidate_ids = [c["operator_id"] for c in candidates_raw]
    today_str = datetime.datetime.utcnow().date().isoformat()

    today_resp = (
        supabase.table("laborers_data")
        .select("operator_id, efficiency")
        .in_("operator_id", candidate_ids)
        .eq("date", today_str)
        .execute()
    )
    
    today_map = {}
    if today_resp.data:
        for row in today_resp.data:
            op = row["operator_id"]
            if op not in today_map:
                today_map[op] = []
            today_map[op].append(float(row["efficiency"]))

    hist_resp = (
        supabase.table("laborers_data")
        .select("operator_id, efficiency")
        .in_("operator_id", candidate_ids)
        .neq("date", today_str)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    
    hist_map = {}
    if hist_resp.data:
        for row in hist_resp.data:
            op = row["operator_id"]
            if op not in hist_map:
                hist_map[op] = []
            if len(hist_map[op]) < 5: 
                hist_map[op].append(float(row["efficiency"]))

    personal_efficiency = {}
    for c_id in candidate_ids:
        if c_id in today_map and today_map[c_id]:
            eff_val = sum(today_map[c_id]) / len(today_map[c_id])
            personal_efficiency[c_id] = eff_val / 100.0 if eff_val > 1.5 else eff_val
        elif c_id in hist_map and hist_map[c_id]:
            eff_val = sum(hist_map[c_id]) / len(hist_map[c_id])
            personal_efficiency[c_id] = eff_val / 100.0 if eff_val > 1.5 else eff_val

    candidates_raw = [c for c in candidates_raw if c["operator_id"] in personal_efficiency]
    
    if not candidates_raw:
        raise HTTPException(status_code=404, detail=f"No operators with actual production history found for '{request.required_skill}'.")

    op_station_map = {}
    try:
        ops_resp = supabase.table("operator_productivity").select("operator_id, current_station").in_("operator_id", candidate_ids).execute()
        op_station_map = {r["operator_id"]: r.get("current_station") for r in ops_resp.data}
    except Exception:
        pass

    candidates = [{**c, "current_station": op_station_map.get(c["operator_id"])} for c in candidates_raw]

    selection = select_workers(
        candidates=candidates,
        personal_efficiency=personal_efficiency,
        bottleneck_station=request.bottleneck_station,
        targeted_productivity=request.targeted_productivity,
        actual_productivity=request.actual_productivity,
        config=config,
        shift_remaining_min=SHIFT_REMAINING_MIN,
    )
    selected = selection["selected"]

    if selection["no_move"]:
        no_move_data = selection["no_move"]
        no_move = SingleMove(
            **{
                key: value
                for key, value in no_move_data.items()
                if key != "no_move_reason"
            },
            donor_cascade_risk=False,
            donor_risk_detail=None,
        )
        return MoveInstruction(
            recommended=False,
            no_move_reason=no_move_data["no_move_reason"],
            moves=[no_move],
            workers_needed=selection["workers_needed"],
            workers_found=0,
            gap_coverage_pct=0.0,
            total_net_profit=0.0,
            cascade_warnings=[],
            instruction="No move recommended.",
            operator_id=no_move.operator_id,
            operator_name=no_move.operator_name,
            worker_pin=no_move.worker_pin,
            from_station=no_move.from_station,
            to_station=no_move.to_station,
            proficiency_grade=no_move.proficiency_grade,
            cost_of_move=no_move.cost_of_move,
            expected_production_gain=no_move.expected_production_gain,
            net_profit=no_move.net_profit,
        )

    donor_ids = list({m["from_station"] for m in selected if m["from_station"]})
    donor_data = {}
    if donor_ids:
        try:
            dr = supabase.table("production_status").select(
                "station_id, targeted_productivity, actual_productivity, required_skill"
            ).in_("station_id", donor_ids).execute()
            for row in dr.data:
                donor_data[row["station_id"]] = row
        except Exception:
            pass

    selected_ids = {move["operator_id"] for move in selected}
    donor_backfills = {}
    for donor_id, d in donor_data.items():
        projected_gap_pct = projected_donor_gap_pct(d, per_worker_fraction)
        if (
            projected_gap_pct is None
            or projected_gap_pct < BOTTLENECK_THRESHOLD_PCT
        ):
            continue
        donor_skill = d.get("required_skill")
        if not donor_skill:
            continue
        try:
            rep_resp = supabase.table("skill_matrix").select("operator_id, proficiency_grade").eq(
                "machine_type", donor_skill).in_("proficiency_grade", ["A", "B", "C"]).order("proficiency_grade").limit(5).execute()
            for rep in rep_resp.data:
                if rep["operator_id"] not in selected_ids:
                    donor_backfills[donor_id] = (rep["operator_id"], rep["proficiency_grade"])
                    break
        except Exception:
            pass

    final_moves_data, cascade_warnings = evaluate_donor_risks(
        selected=selected,
        donor_data=donor_data,
        donor_backfills=donor_backfills,
        threshold_pct=BOTTLENECK_THRESHOLD_PCT,
        per_worker_fraction=per_worker_fraction,
    )
    final_moves = [SingleMove(**move) for move in final_moves_data]

    total_gain = sum(m.expected_production_gain for m in final_moves)
    total_profit = sum(m.net_profit for m in final_moves)

    if len(final_moves) == 1:
        instruction_text = f"Move {final_moves[0].operator_name} to {request.bottleneck_station}"
    else:
        names = ", ".join(m.operator_name for m in final_moves)
        instruction_text = f"Move {len(final_moves)} workers to {request.bottleneck_station}: {names}"

    try:
        supabase.table("move_recommendations").insert({
            "operator_id": final_moves[0].operator_id,
            "to_station": request.bottleneck_station,
            "profit_score": total_profit,
            "instruction": instruction_text,
        }).execute()
    except Exception:
        pass

    first = final_moves[0]
    return MoveInstruction(
        recommended=True, no_move_reason=None, moves=final_moves,
        workers_needed=selection["workers_needed"], workers_found=len(final_moves),
        gap_coverage_pct=selection["gap_coverage_pct"], total_net_profit=total_profit,
        cascade_warnings=cascade_warnings, instruction=instruction_text,
        operator_id=first.operator_id, 
        operator_name=first.operator_name,
        worker_pin=first.worker_pin,
        from_station=first.from_station,
        to_station=first.to_station, 
        proficiency_grade=first.proficiency_grade,
        cost_of_move=first.cost_of_move, 
        expected_production_gain=total_gain, 
        net_profit=total_profit,
    )

@app.post("/skill-matrix", response_model=dict)
async def upsert_skill(entry: SkillMatrixEntry, _: dict = Depends(require_auth)):
    try:
        result = supabase.table("skill_matrix").update({"proficiency_grade": entry.proficiency_grade}).eq("operator_id", entry.operator_id).eq("machine_type", entry.machine_type).execute()
        if not result.data:
            result = supabase.table("skill_matrix").insert(entry.model_dump()).execute()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database write failed: {exc}")
    return {"status": "ok", "data": result.data}

@app.post("/accept-move", response_model=dict)
async def accept_move(request: AcceptMoveRequest, _: dict = Depends(require_auth)):
    config = get_algorithm_config()
    baseline_eff = config["grade_efficiency"]
    per_worker_fraction = config["system"]["per_worker_gain_fraction"]

    errors = []

    # Calculate UTC time X minutes from now for the cooldown
    cooldown_time = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=COOLDOWN_MINUTES)).isoformat()

    for move in request.moves:
        grade = move.proficiency_grade.upper()
        boost = per_worker_fraction * baseline_eff.get(grade, 1.0)

        try:
            supabase.table("operator_productivity").update({"current_station": move.to_station}).eq("operator_id", move.operator_id).execute()
        except Exception as exc:
            errors.append(f"Station update failed for {move.operator_id}: {exc}")
            continue

        try:
            result = supabase.table("skill_matrix").update({"proficiency_grade": move.proficiency_grade}).eq("operator_id", move.operator_id).eq("machine_type", move.machine_type).execute()
            if not result.data:
                supabase.table("skill_matrix").insert({"operator_id": move.operator_id, "machine_type": move.machine_type, "proficiency_grade": move.proficiency_grade}).execute()
        except Exception as exc:
            errors.append(f"Skill update failed for {move.operator_id}: {exc}")

        try:
            dest_resp = supabase.table("production_status").select("actual_productivity, targeted_productivity").eq("station_id", move.to_station).single().execute()
            if dest_resp.data:
                current = dest_resp.data["actual_productivity"] or 0.0
                targeted = dest_resp.data["targeted_productivity"] or 0.0
                loc_boost = targeted * per_worker_fraction * baseline_eff.get(grade, 1.0) if targeted > 0 else 0.0
                new_actual = min(targeted, current + loc_boost) if targeted > 0 else current + loc_boost
                
                # Apply the cooldown time to the destination station
                supabase.table("production_status").update({
                    "actual_productivity": round(new_actual, 4),
                    "cooldown_until": cooldown_time 
                }).eq("station_id", move.to_station).execute()
        except Exception as exc:
            errors.append(f"Productivity update failed for {move.to_station}: {exc}")

        if move.from_station:
            try:
                donor_resp = supabase.table("production_status").select("actual_productivity, targeted_productivity").eq("station_id", move.from_station).single().execute()
                if donor_resp.data:
                    current = donor_resp.data["actual_productivity"] or 0.0
                    donor_targeted = donor_resp.data["targeted_productivity"] or 0.0
                    loss = donor_targeted * per_worker_fraction * baseline_eff.get(grade, 1.0) if donor_targeted > 0 else per_worker_fraction
                    new_actual = max(0.0, current - loss)
                    supabase.table("production_status").update({"actual_productivity": round(new_actual, 4)}).eq("station_id", move.from_station).execute()
            except Exception as exc:
                errors.append(f"Donor productivity update failed for {move.from_station}: {exc}")

    if errors:
        raise HTTPException(status_code=503, detail="; ".join(errors))
    return {"status": "ok", "updated": len(request.moves)}

@app.post("/assign-workers", response_model=dict)
async def assign_workers_to_stations(request: BatchAssignmentRequest, _: dict = Depends(require_auth)):
    errors = []

    for assignment in request.assignments:
        try:
            supabase.table("operator_productivity").update({
                "current_station": assignment.station_id,
                "current_line_id": request.line_id 
            }).eq("operator_id", assignment.operator_id).execute()
        except Exception as exc:
            errors.append(f"Failed to update operator {assignment.operator_id}: {exc}")

    if errors:
        raise HTTPException(
            status_code=500,
            detail=f"Partial failure during assignment: {'; '.join(errors)}"
        )

    return {
        "status": "success",
        "message": f"Successfully updated {len(request.assignments)} operator assignments on {request.line_id}."
    }

@app.post("/trigger-regrade", response_model=dict)
async def trigger_regrade(_: dict = Depends(require_auth)):
    try:
        fourteen_days_ago = (datetime.datetime.now() - datetime.timedelta(days=14)).date().isoformat()
        ld_resp = supabase.table("laborers_data").select("operator_id, station_id, efficiency").gte("date", fourteen_days_ago).execute()
        st_resp = supabase.table("production_status").select("station_id, required_skill").execute()
        
        if not ld_resp.data:
            return {"status": "ok", "message": "No recent efficiency data found to process.", "updated_records": 0}
            
        station_skill_map = {row["station_id"]: row["required_skill"] for row in st_resp.data}
        
        agg_data = {}
        for row in ld_resp.data:
            op_id = row["operator_id"]
            st_id = row["station_id"]
            eff = float(row["efficiency"])
            
            if st_id not in station_skill_map:
                continue
                
            machine_type = station_skill_map[st_id]
            key = (op_id, machine_type)
            
            if key not in agg_data:
                agg_data[key] = []
            agg_data[key].append(eff)
            
        success_count = 0
        for (op_id, machine_type), effs in agg_data.items():
            avg_eff = sum(effs) / len(effs)
            normalized_eff = avg_eff if avg_eff <= 1.5 else avg_eff / 100.0
            
            if normalized_eff >= 0.85:
                new_grade = "A"
            elif normalized_eff >= 0.70:
                new_grade = "B"
            else:
                new_grade = "C"
                
            try:
                update_res = supabase.table("skill_matrix").update({
                    "proficiency_grade": new_grade
                }).eq("operator_id", op_id).eq("machine_type", machine_type).execute()
                
                if not update_res.data:
                    supabase.table("skill_matrix").insert({
                        "operator_id": op_id,
                        "machine_type": machine_type,
                        "proficiency_grade": new_grade
                    }).execute()
                    
                success_count += 1
            except Exception as e:
                print(f"Error updating matrix for {op_id}: {e}")
            
        return {
            "status": "success", 
            "message": "Dynamic skill grades successfully recalculated.", 
            "updated_records": success_count
        }
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to recalculate grades: {exc}")