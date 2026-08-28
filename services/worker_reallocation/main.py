import math
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

app = FastAPI(title="StitchFlow Profitability Engine", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# ---------------------------------------------------------------------------
# Constants 
# ---------------------------------------------------------------------------
SHIFT_REMAINING_MIN: float = float(os.environ.get("SHIFT_REMAINING_MIN", "240"))
BOTTLENECK_THRESHOLD_PCT: float = float(os.environ.get("BOTTLENECK_THRESHOLD_PCT", "5"))

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

class SkillMatrixOut(BaseModel):
    operator_id: str
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
    """Fetches real-time algorithm weights from the database."""
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
    return {"status": "ok", "service": "StitchFlow Profitability Engine V2"}

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
            "targeted_productivity": 0.85 
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
        response = supabase.table("production_status").select(
            "station_id, wip, required_skill, targeted_productivity, actual_productivity"
        ).order("station_id").execute()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database query failed: {exc}")
        
    if not response.data:
        raise HTTPException(status_code=404, detail="No stations found.")

    threshold = BOTTLENECK_THRESHOLD_PCT / 100
    result = []
    for s in response.data:
        t = s.get("targeted_productivity")
        a = s.get("actual_productivity")
        if t is None or a is None or t <= 0:
            is_bottleneck = False
        else:
            is_bottleneck = (t - a) / t >= threshold
        result.append({**s, "is_bottleneck": is_bottleneck})

    return result

@app.get("/skill-matrix", response_model=list[SkillMatrixOut])
async def get_skill_matrix(_: dict = Depends(require_auth)):
    config = get_algorithm_config()
    grade_eff = config["grade_efficiency"]
    
    try:
        response = supabase.table("skill_matrix").select(
            "operator_id, machine_type, proficiency_grade"
        ).order("operator_id").execute()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database query failed: {exc}")

    return [
        {
            **row,
            "efficiency_pct": grade_eff.get(str(row.get("proficiency_grade", "")).upper(), 0.0) * 100
        }
        for row in response.data
    ]

@app.post("/recommend", response_model=MoveInstruction)
async def recommend(request: RecommendRequest, _: dict = Depends(require_auth)):
    config = get_algorithm_config()
    learning_penalty = config["learning_penalty"]
    baseline_eff = config["grade_efficiency"]
    fallback_gain = config["fallback_gain"]
    per_worker_fraction = config["system"]["per_worker_gain_fraction"]
    t_relocation = config["system"]["t_relocation_min"]

    threshold = BOTTLENECK_THRESHOLD_PCT / 100
    targeted = request.targeted_productivity
    actual_prod = request.actual_productivity
    use_dynamic = targeted is not None and actual_prod is not None and targeted > 0

    remaining_gap = max(0.0, targeted - actual_prod) if use_dynamic else 0.0

    try:
        sm_response = (
            supabase.table("skill_matrix")
            .select("operator_id, machine_type, proficiency_grade")
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

    hist_resp = (
        supabase.table("laborers_data")
        .select("operator_id, efficiency")
        .in_("operator_id", candidate_ids)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    
    hist_map = {}
    for row in hist_resp.data:
        op = row["operator_id"]
        if op not in hist_map:
            hist_map[op] = []
        if len(hist_map[op]) < 5: 
            hist_map[op].append(float(row["efficiency"]))

    personal_efficiency = {
        op: (sum(effs) / len(effs)) / 100.0 if sum(effs)/len(effs) > 1.5 else (sum(effs) / len(effs))
        for op, effs in hist_map.items() if effs
    }

    op_station_map = {}
    try:
        ops_resp = supabase.table("operator_productivity").select("operator_id, current_station").in_("operator_id", candidate_ids).execute()
        op_station_map = {r["operator_id"]: r.get("current_station") for r in ops_resp.data}
    except Exception:
        pass

    candidates = [{**c, "current_station": op_station_map.get(c["operator_id"])} for c in candidates_raw]

    best_grade = candidates[0]["proficiency_grade"].upper()
    if use_dynamic and remaining_gap > 0:
        best_boost = targeted * per_worker_fraction * baseline_eff.get(best_grade, 1.0)
        workers_needed = math.ceil(remaining_gap / best_boost) if best_boost > 0 else 1
    else:
        workers_needed = 1

    gap_left = remaining_gap
    selected = []
    used_ids = set()

    for c in candidates:
        if use_dynamic and gap_left <= 0:
            break

        op_id = c["operator_id"]
        if op_id in used_ids:
            continue

        grade = c["proficiency_grade"].upper()
        from_station = c.get("current_station")

        if from_station == request.bottleneck_station:
            continue

        actual_eff = personal_efficiency.get(op_id, baseline_eff.get(grade, 0.85))

        if use_dynamic:
            per_worker_boost = targeted * per_worker_fraction * actual_eff
            this_gap_closed = min(gap_left, per_worker_boost)
            this_gain_min = this_gap_closed * SHIFT_REMAINING_MIN
        else:
            this_gain_min = fallback_gain.get(grade, 14.0)

        cost = t_relocation + learning_penalty.get(grade, 5.0)
        profit = this_gain_min - cost

        if profit <= 0:
            break

        selected.append({
            "operator_id": op_id,
            "from_station": from_station,
            "to_station": request.bottleneck_station,
            "proficiency_grade": c["proficiency_grade"],
            "cost_of_move": cost,
            "expected_production_gain": this_gain_min,
            "net_profit": profit,
        })
        used_ids.add(op_id)
        if use_dynamic:
            gap_left = max(0.0, gap_left - per_worker_boost)

    if not selected:
        fc = candidates[0]
        fg = fc["proficiency_grade"].upper()
        ff = fc.get("current_station")
        
        actual_eff = personal_efficiency.get(fc["operator_id"], baseline_eff.get(fg, 0.85))
        if use_dynamic:
            boost = targeted * per_worker_fraction * actual_eff
            gain = min(remaining_gap, boost) * SHIFT_REMAINING_MIN
        else:
            gain = fallback_gain.get(fg, 14.0)
            
        cost = t_relocation + learning_penalty.get(fg, 5.0)
        profit = gain - cost

        no_move = SingleMove(
            operator_id=fc["operator_id"], from_station=ff, to_station=request.bottleneck_station,
            proficiency_grade=fc["proficiency_grade"], cost_of_move=cost, expected_production_gain=gain,
            net_profit=profit, donor_cascade_risk=False, donor_risk_detail=None,
        )
        return MoveInstruction(
            recommended=False,
            no_move_reason=f"Best available worker would recover {gain:.1f} min but relocation costs {cost:.1f} min - net {profit:.1f} min. No move justified.",
            moves=[no_move], workers_needed=workers_needed, workers_found=0, gap_coverage_pct=0.0,
            total_net_profit=0.0, cascade_warnings=[], instruction="No move recommended.",
            operator_id=fc["operator_id"], from_station=ff, to_station=request.bottleneck_station,
            proficiency_grade=fc["proficiency_grade"], cost_of_move=cost, expected_production_gain=gain, net_profit=profit,
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

    donor_backfills = {} 
    for donor_id, d in donor_data.items():
        dt = d.get("targeted_productivity")
        da = d.get("actual_productivity")
        if not (dt and da and dt > 0):
            continue
        new_actual = da - per_worker_fraction
        if max(0.0, (dt - new_actual) / dt * 100) < BOTTLENECK_THRESHOLD_PCT:
            continue
        donor_skill = d.get("required_skill")
        if not donor_skill:
            continue
        try:
            rep_resp = supabase.table("skill_matrix").select("operator_id, proficiency_grade").eq(
                "machine_type", donor_skill).in_("proficiency_grade", ["A", "B", "C"]).order("proficiency_grade").limit(5).execute()
            for rep in rep_resp.data:
                if rep["operator_id"] not in used_ids:
                    donor_backfills[donor_id] = (rep["operator_id"], rep["proficiency_grade"])
                    break
        except Exception:
            pass

    cascade_warnings = []
    final_moves = []

    for move in selected:
        donor_id = move["from_station"]
        cascade_risk = False
        risk_detail = None
        replacement_id = None
        replacement_grade = None

        if donor_id and donor_id in donor_data:
            d = donor_data[donor_id]
            dt = d.get("targeted_productivity")
            da = d.get("actual_productivity")
            if dt and da and dt > 0:
                new_actual = da - per_worker_fraction
                projected_gap_pct = max(0.0, (dt - new_actual) / dt * 100)
                if projected_gap_pct >= BOTTLENECK_THRESHOLD_PCT:
                    cascade_risk = True
                    risk_detail = f"{donor_id} projected gap: {projected_gap_pct:.1f}% (≥ {BOTTLENECK_THRESHOLD_PCT:.0f}% threshold)"
                    cascade_warnings.append(f"Moving {move['operator_id']} from {donor_id} may create a new bottleneck there (projected gap {projected_gap_pct:.1f}%)")
                    if donor_id in donor_backfills:
                        replacement_id, replacement_grade = donor_backfills[donor_id]

        final_moves.append(SingleMove(
            operator_id=move["operator_id"], from_station=move["from_station"], to_station=move["to_station"],
            proficiency_grade=move["proficiency_grade"], cost_of_move=move["cost_of_move"],
            expected_production_gain=move["expected_production_gain"], net_profit=move["net_profit"],
            donor_cascade_risk=cascade_risk, donor_risk_detail=risk_detail,
            donor_replacement_id=replacement_id, donor_replacement_grade=replacement_grade,
        ))

    total_gain = sum(m.expected_production_gain for m in final_moves)
    total_profit = sum(m.net_profit for m in final_moves)

    if use_dynamic and remaining_gap > 0:
        gap_coverage_pct = min(100.0, (remaining_gap - max(0.0, gap_left)) / remaining_gap * 100)
    else:
        gap_coverage_pct = 100.0

    if len(final_moves) == 1:
        instruction_text = f"Move {final_moves[0].operator_id} to {request.bottleneck_station}"
    else:
        ids = ", ".join(m.operator_id for m in final_moves)
        instruction_text = f"Move {len(final_moves)} workers to {request.bottleneck_station}: {ids}"

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
        workers_needed=workers_needed, workers_found=len(final_moves),
        gap_coverage_pct=gap_coverage_pct, total_net_profit=total_profit,
        cascade_warnings=cascade_warnings, instruction=instruction_text,
        operator_id=first.operator_id, from_station=first.from_station,
        to_station=first.to_station, proficiency_grade=first.proficiency_grade,
        cost_of_move=first.cost_of_move, expected_production_gain=total_gain, net_profit=total_profit,
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
                supabase.table("production_status").update({"actual_productivity": round(new_actual, 4)}).eq("station_id", move.to_station).execute()
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

# ---------------------------------------------------------------------------
# NEW: Automated Skill Grading Endpoint
# ---------------------------------------------------------------------------
@app.post("/trigger-regrade", response_model=dict)
async def trigger_regrade(_: dict = Depends(require_auth)):
    """
    Analyzes the last 14 days of operator performance from laborers_data
    and automatically adjusts their A/B/C skill grade in the matrix.
    """
    try:
        fourteen_days_ago = (datetime.datetime.now() - datetime.timedelta(days=14)).date().isoformat()
        
        # 1. Fetch recent performance data
        ld_resp = supabase.table("laborers_data").select("operator_id, station_id, efficiency").gte("date", fourteen_days_ago).execute()
        
        # 2. Fetch station definitions to map physical stations to machine skills
        st_resp = supabase.table("production_status").select("station_id, required_skill").execute()
        
        if not ld_resp.data:
            return {"status": "ok", "message": "No recent efficiency data found to process.", "updated_records": 0}
            
        station_skill_map = {row["station_id"]: row["required_skill"] for row in st_resp.data}
        
        # 3. Aggregate efficiency scores per operator per machine type
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
            
        # 4. Calculate averages and assign new grades
        success_count = 0
        for (op_id, machine_type), effs in agg_data.items():
            avg_eff = sum(effs) / len(effs)
            
            # Normalize percentage (handling both 0.85 and 85.0 formats)
            normalized_eff = avg_eff if avg_eff <= 1.5 else avg_eff / 100.0
            
            if normalized_eff >= 0.85:
                new_grade = "A"
            elif normalized_eff >= 0.70:
                new_grade = "B"
            else:
                new_grade = "C"
                
            # 5. Safely update or insert into the skill matrix
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