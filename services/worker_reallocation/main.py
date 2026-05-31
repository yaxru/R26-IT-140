import math
import os
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
# JWT authentication — delegate verification to Supabase Auth API
# ---------------------------------------------------------------------------
_bearer = HTTPBearer()

def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """Ask Supabase to validate the bearer token and return the user."""
    try:
        response = supabase.auth.get_user(credentials.credentials)
        if response.user is None:
            raise ValueError("No user in response")
        return {"user_id": response.user.id, "email": response.user.email}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

app = FastAPI(title="StitchFlow Profitability Engine", version="1.0.0")

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
# Constants & helpers
# ---------------------------------------------------------------------------
# Recommended Supabase index for fast /recommend lookups (run once in SQL editor):
#   CREATE INDEX IF NOT EXISTS idx_skill_matrix_machine_grade
#     ON skill_matrix (machine_type, proficiency_grade);

# How many minutes of the shift remain (used in gain formula).
# Override with env var: SHIFT_REMAINING_MIN=120
SHIFT_REMAINING_MIN: float = float(os.environ.get("SHIFT_REMAINING_MIN", "240"))

# A station is only a bottleneck if actual productivity is this many percent
# below target. Default 5 % — tiny natural variance is not a bottleneck.
# Override with env var: BOTTLENECK_THRESHOLD_PCT=8
BOTTLENECK_THRESHOLD_PCT: float = float(os.environ.get("BOTTLENECK_THRESHOLD_PCT", "5"))

T_RELOCATION_MIN: float = 5.0  # fixed relocation time (minutes)

LEARNING_PENALTY: dict[str, float] = {
    "A": 2.0,
    "B": 5.0,
    "C": 10.0,
}

# How efficiently each grade recovers the lost throughput once seated.
# Grade A works at full target pace; B/C at reduced pace.
GRADE_EFFICIENCY: dict[str, float] = {
    "A": 1.00,
    "B": 0.85,
    "C": 0.70,
}

# Fallback gain (minutes) used when the DB has no productivity columns yet.
FALLBACK_GAIN: dict[str, float] = {
    "A": 20.0,
    "B": 14.0,
    "C": 8.0,
}

# How much of the targeted productivity rate one additional worker contributes
# to a station. Default 12 % per worker — tune via PER_WORKER_GAIN_FRACTION env var.
# Example: targeted=0.85, Grade A → adds 0.85×0.12×1.00 ≈ 0.10 productivity,
# which for a 240-min shift = 24 min of recovered throughput.
PER_WORKER_GAIN_FRACTION: float = float(
    os.environ.get("PER_WORKER_GAIN_FRACTION", "0.12")
)


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
    # Productivity values from production_status (0.0–1.0 efficiency ratio).
    # When supplied, gain is calculated dynamically instead of using fallbacks.
    targeted_productivity: Optional[float] = Field(None, example=0.75)
    actual_productivity: Optional[float] = Field(None, example=0.60)


class SingleMove(BaseModel):
    """One worker move within a multi-worker plan."""
    operator_id: str
    from_station: Optional[str]
    to_station: str
    proficiency_grade: str
    cost_of_move: float
    expected_production_gain: float
    net_profit: float
    donor_cascade_risk: bool
    donor_risk_detail: Optional[str]
    # Suggested backfill for the donor station if cascade risk is high
    donor_replacement_id: Optional[str] = None
    donor_replacement_grade: Optional[str] = None


class MoveInstruction(BaseModel):
    # False means no move is profitable.
    recommended: bool
    no_move_reason: Optional[str]
    # Multi-worker plan
    moves: list[SingleMove]
    workers_needed: int          # minimum to fully close the gap
    workers_found: int           # profitable workers actually available
    gap_coverage_pct: float      # % of the productivity gap the plan covers
    total_net_profit: float
    cascade_warnings: list[str]  # donor stations that may become bottlenecks
    instruction: str
    # Legacy single-worker fields kept for backward compat (refer to first move)
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
    # targeted_productivity and actual_productivity come from production_status.
    targeted_productivity: Optional[float] = None
    actual_productivity: Optional[float] = None


# ---------------------------------------------------------------------------
# Profitability calculations
# ---------------------------------------------------------------------------
def calculate_cost_of_move(grade: str) -> float:
    """C_M = T_relocation + P_learning"""
    penalty = LEARNING_PENALTY.get(grade.upper())
    if penalty is None:
        raise ValueError(f"Unknown proficiency grade: {grade}")
    return T_RELOCATION_MIN + penalty


def calculate_net_profit(
    grade: str, production_gain: float
) -> tuple[float, float, float]:
    """Returns (expected_gain, cost_of_move, net_profit)."""
    cost = calculate_cost_of_move(grade)
    return production_gain, cost, production_gain - cost


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "StitchFlow Profitability Engine"}


@app.get("/stations", response_model=list[StationOut])
async def get_stations(_: dict = Depends(require_auth)):
    """
    Return all stations, each tagged with is_bottleneck=True/False.

    A station is a bottleneck when:
        (targeted_productivity - actual_productivity) / targeted_productivity
        >= BOTTLENECK_THRESHOLD_PCT / 100

    All stations are always returned so the dashboard never goes blank.
    """
    try:
        response = (
            supabase.table("production_status")
            .select(
                "station_id, wip, required_skill, "
                "targeted_productivity, actual_productivity"
            )
            .order("station_id")
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Database query failed: {exc}",
        )
    if not response.data:
        raise HTTPException(status_code=404, detail="No stations found.")

    threshold = BOTTLENECK_THRESHOLD_PCT / 100
    result = []
    for s in response.data:
        t = s.get("targeted_productivity")
        a = s.get("actual_productivity")
        if t is None or a is None or t <= 0:
            is_bottleneck = False  # no data — assume OK
        else:
            is_bottleneck = (t - a) / t >= threshold
        result.append({**s, "is_bottleneck": is_bottleneck})

    return result


@app.post("/recommend", response_model=MoveInstruction)
async def recommend(request: RecommendRequest, _: dict = Depends(require_auth)):
    """
    Calculate the minimum number of workers needed to close the productivity
    gap and check whether removing them would create new bottlenecks elsewhere.

    Algorithm
    ---------
    1. Workers needed = ceil(gap / per_worker_boost) where
         gap = targeted − actual  (productivity fraction, e.g. 0.25)
         per_worker_boost = PER_WORKER_GAIN_FRACTION × GRADE_EFFICIENCY[grade]
       This is informational — the loop stops automatically when moves are
       no longer profitable (safety valve), so the plan may be shorter.

    2. Fetch up to 20 candidates ordered A→B→C.  For each:
         gain = min(remaining_gap, per_worker_boost) × SHIFT_REMAINING_MIN
         If gain ≤ cost_of_move: stop (diminishing returns are unprofitable).

    3. Cascade check: batch-fetch every donor station and estimate the
       productivity drop if their worker leaves.  Flag stations that would
       cross the bottleneck threshold.
    """
    threshold = BOTTLENECK_THRESHOLD_PCT / 100
    targeted = request.targeted_productivity
    actual_prod = request.actual_productivity
    use_dynamic = targeted is not None and actual_prod is not None and targeted > 0

    remaining_gap = max(0.0, targeted - actual_prod) if use_dynamic else 0.0

    # ------------------------------------------------------------------
    # 1. Fetch candidates
    # ------------------------------------------------------------------
    try:
        sm_response = (
            supabase.table("skill_matrix")
            .select("operator_id, machine_type, proficiency_grade")
            .eq("machine_type", request.required_skill)
            .in_("proficiency_grade", ["A", "B", "C"])
            .order("proficiency_grade")  # A → B → C
            .limit(20)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database query failed: {exc}")

    candidates_raw = sm_response.data
    if not candidates_raw:
        raise HTTPException(
            status_code=404,
            detail=f"No qualified operators found for skill '{request.required_skill}'.",
        )

    # Fetch current stations directly from operators table (no FK join required)
    op_station_map: dict[str, Optional[str]] = {}
    try:
        ops_resp = (
            supabase.table("operators")
            .select("operator_id, current_station")
            .in_("operator_id", [c["operator_id"] for c in candidates_raw])
            .execute()
        )
        op_station_map = {r["operator_id"]: r.get("current_station") for r in ops_resp.data}
    except Exception:
        pass  # no station data — workers at bottleneck won't be filtered but won't crash

    candidates = [
        {**c, "current_station": op_station_map.get(c["operator_id"])}
        for c in candidates_raw
    ]

    # ------------------------------------------------------------------
    # 2. Calculate workers_needed (informational display only)
    # ------------------------------------------------------------------
    best_grade = candidates[0]["proficiency_grade"].upper()
    if use_dynamic and remaining_gap > 0:
        # boost = targeted × fraction × grade_efficiency (matches the comment on PER_WORKER_GAIN_FRACTION)
        best_boost = targeted * PER_WORKER_GAIN_FRACTION * GRADE_EFFICIENCY[best_grade]
        workers_needed = math.ceil(remaining_gap / best_boost) if best_boost > 0 else 1
    else:
        workers_needed = 1

    # ------------------------------------------------------------------
    # 3. Select minimum workers to close the gap
    # ------------------------------------------------------------------
    gap_left = remaining_gap
    selected: list[dict] = []
    used_ids: set[str] = set()

    for c in candidates:
        if use_dynamic and gap_left <= 0:
            break

        op_id = c["operator_id"]
        if op_id in used_ids:
            continue

        grade = c["proficiency_grade"].upper()
        from_station: Optional[str] = c.get("current_station")

        # Skip workers already stationed at the bottleneck
        if from_station == request.bottleneck_station:
            continue

        if use_dynamic:
            # boost = targeted × fraction × grade_efficiency (matches the comment on PER_WORKER_GAIN_FRACTION)
            per_worker_boost = targeted * PER_WORKER_GAIN_FRACTION * GRADE_EFFICIENCY[grade]
            this_gap_closed = min(gap_left, per_worker_boost)
            this_gain_min = this_gap_closed * SHIFT_REMAINING_MIN
        else:
            this_gain_min = FALLBACK_GAIN[grade]

        cost = calculate_cost_of_move(grade)
        profit = this_gain_min - cost

        if profit <= 0:
            break  # Marginal worker is unprofitable — stop here

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
            gap_left = max(0.0, gap_left - per_worker_boost)  # per_worker_boost already scaled by targeted

    # ------------------------------------------------------------------
    # No profitable move found
    # ------------------------------------------------------------------
    if not selected:
        fc = candidates[0]
        fg = fc["proficiency_grade"].upper()
        ff = fc.get("current_station")
        if use_dynamic:
            boost = targeted * PER_WORKER_GAIN_FRACTION * GRADE_EFFICIENCY[fg]
            gain = min(remaining_gap, boost) * SHIFT_REMAINING_MIN
        else:
            gain = FALLBACK_GAIN[fg]
        cost = calculate_cost_of_move(fg)
        profit = gain - cost

        no_move = SingleMove(
            operator_id=fc["operator_id"], from_station=ff,
            to_station=request.bottleneck_station,
            proficiency_grade=fc["proficiency_grade"],
            cost_of_move=cost, expected_production_gain=gain,
            net_profit=profit, donor_cascade_risk=False, donor_risk_detail=None,
        )
        return MoveInstruction(
            recommended=False,
            no_move_reason=(
                f"Best available worker (Grade {fg}) would recover {gain:.1f} min "
                f"but relocation costs {cost:.1f} min — net {profit:.1f} min. "
                f"Gap is within normal variance; no move justified."
            ),
            moves=[no_move], workers_needed=workers_needed, workers_found=0,
            gap_coverage_pct=0.0, total_net_profit=0.0, cascade_warnings=[],
            instruction="No move recommended.",
            operator_id=fc["operator_id"], from_station=ff,
            to_station=request.bottleneck_station,
            proficiency_grade=fc["proficiency_grade"],
            cost_of_move=cost, expected_production_gain=gain, net_profit=profit,
        )

    # ------------------------------------------------------------------
    # 4. Cascade check — batch-fetch donor stations
    # ------------------------------------------------------------------
    donor_ids = list({m["from_station"] for m in selected if m["from_station"]})
    donor_data: dict[str, dict] = {}
    if donor_ids:
        try:
            dr = (
                supabase.table("production_status")
                .select("station_id, targeted_productivity, actual_productivity, required_skill")
                .in_("station_id", donor_ids)
                .execute()
            )
            for row in dr.data:
                donor_data[row["station_id"]] = row
        except Exception:
            pass  # advisory check — never fail the response

    # Pre-compute backfill suggestions for donor stations that will hit cascade risk
    donor_backfills: dict[str, tuple[str, str]] = {}  # donor_id -> (operator_id, grade)
    for donor_id, d in donor_data.items():
        dt = d.get("targeted_productivity")
        da = d.get("actual_productivity")
        if not (dt and da and dt > 0):
            continue
        new_actual = da - PER_WORKER_GAIN_FRACTION
        if max(0.0, (dt - new_actual) / dt * 100) < BOTTLENECK_THRESHOLD_PCT:
            continue  # no cascade risk for this station
        donor_skill = d.get("required_skill")
        if not donor_skill:
            continue
        try:
            rep_resp = (
                supabase.table("skill_matrix")
                .select("operator_id, proficiency_grade")
                .eq("machine_type", donor_skill)
                .in_("proficiency_grade", ["A", "B", "C"])
                .order("proficiency_grade")
                .limit(5)
                .execute()
            )
            for rep in rep_resp.data:
                if rep["operator_id"] not in used_ids:
                    donor_backfills[donor_id] = (rep["operator_id"], rep["proficiency_grade"])
                    break
        except Exception:
            pass

    cascade_warnings: list[str] = []
    final_moves: list[SingleMove] = []

    for move in selected:
        donor_id = move["from_station"]
        cascade_risk = False
        risk_detail: Optional[str] = None
        replacement_id: Optional[str] = None
        replacement_grade: Optional[str] = None

        if donor_id and donor_id in donor_data:
            d = donor_data[donor_id]
            dt = d.get("targeted_productivity")
            da = d.get("actual_productivity")
            if dt and da and dt > 0:
                new_actual = da - PER_WORKER_GAIN_FRACTION
                projected_gap_pct = max(0.0, (dt - new_actual) / dt * 100)
                if projected_gap_pct >= BOTTLENECK_THRESHOLD_PCT:
                    cascade_risk = True
                    risk_detail = (
                        f"{donor_id} projected gap: {projected_gap_pct:.1f}% "
                        f"(≥ {BOTTLENECK_THRESHOLD_PCT:.0f}% threshold)"
                    )
                    cascade_warnings.append(
                        f"Moving {move['operator_id']} from {donor_id} may create a new "
                        f"bottleneck there (projected gap {projected_gap_pct:.1f}%)"
                    )
                    if donor_id in donor_backfills:
                        replacement_id, replacement_grade = donor_backfills[donor_id]

        final_moves.append(SingleMove(
            operator_id=move["operator_id"],
            from_station=move["from_station"],
            to_station=move["to_station"],
            proficiency_grade=move["proficiency_grade"],
            cost_of_move=move["cost_of_move"],
            expected_production_gain=move["expected_production_gain"],
            net_profit=move["net_profit"],
            donor_cascade_risk=cascade_risk,
            donor_risk_detail=risk_detail,
            donor_replacement_id=replacement_id,
            donor_replacement_grade=replacement_grade,
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
        instruction_text = (
            f"Move {len(final_moves)} workers to {request.bottleneck_station}: {ids}"
        )

    # Persist (fire-and-forget)
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
        recommended=True,
        no_move_reason=None,
        moves=final_moves,
        workers_needed=workers_needed,
        workers_found=len(final_moves),
        gap_coverage_pct=gap_coverage_pct,
        total_net_profit=total_profit,
        cascade_warnings=cascade_warnings,
        instruction=instruction_text,
        # Legacy single-worker fields (first worker in plan)
        operator_id=first.operator_id,
        from_station=first.from_station,
        to_station=first.to_station,
        proficiency_grade=first.proficiency_grade,
        cost_of_move=first.cost_of_move,
        expected_production_gain=total_gain,
        net_profit=total_profit,
    )


@app.post("/skill-matrix", response_model=dict)
async def upsert_skill(entry: SkillMatrixEntry, _: dict = Depends(require_auth)):
    """Insert or update a worker's skill record (safe update-then-insert)."""
    try:
        result = (
            supabase.table("skill_matrix")
            .update({"proficiency_grade": entry.proficiency_grade})
            .eq("operator_id", entry.operator_id)
            .eq("machine_type", entry.machine_type)
            .execute()
        )
        if not result.data:
            # Row does not exist yet — insert it
            result = (
                supabase.table("skill_matrix")
                .insert(entry.model_dump())
                .execute()
            )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Database write failed: {exc}",
        )
    return {"status": "ok", "data": result.data}


# ---------------------------------------------------------------------------
# AcceptMove — atomic endpoint that updates all affected tables
# ---------------------------------------------------------------------------
class AcceptMoveItem(BaseModel):
    operator_id: str
    from_station: Optional[str]
    to_station: str
    machine_type: str
    proficiency_grade: str


class AcceptMoveRequest(BaseModel):
    moves: list[AcceptMoveItem]


@app.post("/accept-move", response_model=dict)
async def accept_move(request: AcceptMoveRequest, _: dict = Depends(require_auth)):
    """
    Accept a move recommendation and update all relevant tables:
      1. operators.current_station  — physically reassign the operator
      2. skill_matrix               — ensure the operator's skill entry is up-to-date
      3. production_status          — adjust actual_productivity for both the
                                      destination (bottleneck) and donor stations
    """
    errors: list[str] = []

    for move in request.moves:
        grade = move.proficiency_grade.upper()
        boost = PER_WORKER_GAIN_FRACTION * GRADE_EFFICIENCY.get(grade, 1.0)

        # 1. Update the operator's current station
        try:
            supabase.table("operators").update(
                {"current_station": move.to_station}
            ).eq("operator_id", move.operator_id).execute()
        except Exception as exc:
            errors.append(f"Station update failed for {move.operator_id}: {exc}")
            continue

        # 2. Safe upsert: update if exists, insert if not
        try:
            result = (
                supabase.table("skill_matrix")
                .update({"proficiency_grade": move.proficiency_grade})
                .eq("operator_id", move.operator_id)
                .eq("machine_type", move.machine_type)
                .execute()
            )
            if not result.data:
                supabase.table("skill_matrix").insert({
                    "operator_id": move.operator_id,
                    "machine_type": move.machine_type,
                    "proficiency_grade": move.proficiency_grade,
                }).execute()
        except Exception as exc:
            errors.append(f"Skill update failed for {move.operator_id}: {exc}")

        # 3. Adjust production_status for the destination (bottleneck) station
        try:
            dest_resp = (
                supabase.table("production_status")
                .select("actual_productivity, targeted_productivity")
                .eq("station_id", move.to_station)
                .single()
                .execute()
            )
            if dest_resp.data:
                current = dest_resp.data["actual_productivity"] or 0.0
                targeted = dest_resp.data["targeted_productivity"] or 0.0
                # boost = targeted × fraction × grade_efficiency
                boost = targeted * PER_WORKER_GAIN_FRACTION * GRADE_EFFICIENCY.get(grade, 1.0) if targeted > 0 else 0.0
                new_actual = min(targeted, current + boost) if targeted > 0 else current + boost
                supabase.table("production_status").update(
                    {"actual_productivity": round(new_actual, 4)}
                ).eq("station_id", move.to_station).execute()
        except Exception as exc:
            errors.append(f"Productivity update failed for {move.to_station}: {exc}")

        # 4. Adjust production_status for the donor station (if applicable)
        if move.from_station:
            try:
                donor_resp = (
                    supabase.table("production_status")
                    .select("actual_productivity, targeted_productivity")
                    .eq("station_id", move.from_station)
                    .single()
                    .execute()
                )
                if donor_resp.data:
                    current = donor_resp.data["actual_productivity"] or 0.0
                    donor_targeted = donor_resp.data["targeted_productivity"] or 0.0
                    # Use donor station's targeted to scale the loss consistently
                    loss = donor_targeted * PER_WORKER_GAIN_FRACTION * GRADE_EFFICIENCY.get(grade, 1.0) if donor_targeted > 0 else PER_WORKER_GAIN_FRACTION
                    new_actual = max(0.0, current - loss)
                    supabase.table("production_status").update(
                        {"actual_productivity": round(new_actual, 4)}
                    ).eq("station_id", move.from_station).execute()
            except Exception as exc:
                errors.append(f"Donor productivity update failed for {move.from_station}: {exc}")

    if errors:
        raise HTTPException(
            status_code=503,
            detail="; ".join(errors),
        )
    return {"status": "ok", "updated": len(request.moves)}
