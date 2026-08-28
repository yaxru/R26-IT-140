"""
Stress Detection Service — Flask backend
Component 4 of R26-IT-140 (Garment Production Optimization System)

Flow: secure-link token resolve -> baseline -> PSS-10 -> Game 1 (Egg Cracker)
-> Game 2 (Precision Inflator, 3 trials) -> predict -> HR dashboard read.
"""

import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()  # reads .env in the current working directory before anything else

import jwt
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client

from predictive import predict_stress

# ---------------------------------------------------------------------------
# App & Supabase setup
# ---------------------------------------------------------------------------

app = Flask(__name__)

CORS(
    app,
    resources={r"/api/*": {"origins": ["http://localhost:3000"]}},
    supports_credentials=False,
)



def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable '{name}'. "
            f"Copy .env.example to .env in this folder and fill in real values, "
            f"then restart the server."
        )
    return value


SUPABASE_URL = require_env("SUPABASE_URL")
SUPABASE_KEY = require_env("SUPABASE_KEY")
SECURE_LINK_SECRET = require_env("SECURE_LINK_SECRET")  # shared with Component 2

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

TABLE = "stress_assessments"

PSS10_NEGATIVE_ITEMS = {1, 2, 3, 6, 9, 10}
PSS10_POSITIVE_ITEMS = {4, 5, 7, 8}
REVERSE_SCORE = {0: 4, 1: 3, 2: 2, 3: 1, 4: 0}


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def verify_link_token(token: str) -> dict:
    """Decode & validate the secure-link token issued by Component 2.

    Expected claims: worker_id, worker_name, exp.
    Raises jwt exceptions on failure — caller must handle.
    """
    payload = jwt.decode(token, SECURE_LINK_SECRET, algorithms=["HS256"])
    return payload


def verify_hr_session():
    """Validate the Supabase session bearer token for HR dashboard routes.

    Returns the Supabase user object, or None if invalid/missing.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    access_token = auth_header.split(" ", 1)[1]
    try:
        user_response = supabase.auth.get_user(access_token)
        return user_response.user
    except Exception:
        return None


def require_hr_auth(fn):
    from functools import wraps

    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = verify_hr_session()
        if user is None:
            return jsonify({"error": "unauthorized"}), 401
        return fn(*args, **kwargs)

    return wrapper


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def score_pss10(answers: dict) -> tuple[int, str]:
    """answers: {"1": 0-4, "2": 0-4, ..., "10": 0-4}"""
    total = 0
    for item_num in range(1, 11):
        raw = int(answers[str(item_num)])
        if item_num in PSS10_POSITIVE_ITEMS:
            total += REVERSE_SCORE[raw]
        else:
            total += raw

    if total <= 13:
        classification = "Low"
    elif total <= 26:
        classification = "Moderate"
    else:
        classification = "High"
    return total, classification


def pressure_status(gap: float) -> str:
    if gap > 0:
        return "Increased"
    if gap == 0:
        return "Stable"
    return "Decreased"


def intervention_recommendation(model_output: int, pss10_classification: str) -> str:
    if model_output == 1 and pss10_classification == "High":
        return "Escalate to Counsellor"
    if model_output == 1 or pss10_classification in ("Moderate", "High"):
        return "Welfare Check"
    return "Monitor"


def get_session_row(session_id: str) -> dict | None:
    result = supabase.table(TABLE).select("*").eq("session_id", session_id).execute()
    return result.data[0] if result.data else None


# ---------------------------------------------------------------------------
# Link Generation for Supervisor Dashboard
# ---------------------------------------------------------------------------
@app.route("/api/stress-detection/dev/token", methods=["GET"])
def dev_generate_token():
    worker_id = request.args.get("worker_id", "EMP-UNKNOWN")
    worker_name = request.args.get("worker_name", "Unknown Worker")
    expires_in = 7200 # 2 hours
    
    payload = {
        "worker_id": worker_id,
        "worker_name": worker_name,
        "exp": int(datetime.now(timezone.utc).timestamp()) + expires_in,
    }
    
    token = jwt.encode(payload, SECURE_LINK_SECRET, algorithm="HS256")
    
    # We send back the exact URL the worker needs to click
    frontend_url = os.environ.get("FRONTEND_BASE_URL", "http://localhost:3000/assessment")
    
    return jsonify({
        "token": token,
        "test_url": f"{frontend_url}?token={token}",
    })


# ---------------------------------------------------------------------------
# Routes — Worker flow (token-authenticated, no login screen)
# ---------------------------------------------------------------------------

@app.route("/api/stress-detection/session/resolve", methods=["POST"])
def resolve_session():
    body = request.get_json(force=True)
    token = body.get("token")
    if not token:
        return jsonify({"error": "token is required"}), 400

    try:
        claims = verify_link_token(token)
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "link expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "invalid link"}), 401

    session_id = str(uuid.uuid4())
    supabase.table(TABLE).insert({
        "session_id": session_id,
        "worker_id": claims["worker_id"],
        "worker_name": claims["worker_name"],
        "session_datetime": datetime.now(timezone.utc).isoformat(),
    }).execute()

    return jsonify({
        "session_id": session_id,
        "worker_id": claims["worker_id"],
        "worker_name": claims["worker_name"],
    })


@app.route("/api/stress-detection/baseline", methods=["POST"])
def submit_baseline():
    body = request.get_json(force=True)
    session_id = body["session_id"]
    pressures = body["pressures"]  # list[float], 0.0-1.0

    avg_baseline_pressure = sum(pressures) / len(pressures) if pressures else 0.0

    supabase.table(TABLE).update({
        "avg_baseline_pressure": avg_baseline_pressure,
    }).eq("session_id", session_id).execute()

    return jsonify({"avg_baseline_pressure": avg_baseline_pressure})


@app.route("/api/stress-detection/pss10", methods=["POST"])
def submit_pss10():
    body = request.get_json(force=True)
    session_id = body["session_id"]
    answers = body["answers"]  # {"1": 0-4, ..., "10": 0-4}

    total, classification = score_pss10(answers)

    supabase.table(TABLE).update({
        "pss10_score": total,
        "pss10_classification": classification,
    }).eq("session_id", session_id).execute()

    return jsonify({"pss10_score": total, "pss10_classification": classification})


@app.route("/api/stress-detection/game1", methods=["POST"])
def submit_game1():
    body = request.get_json(force=True)
    session_id = body["session_id"]
    pressures = body["pressures"]  # list[float] captured during Egg Cracker
    response_time_ms = int(body["response_time_ms"])

    avg_game1_pressure = sum(pressures) / len(pressures) if pressures else 0.0

    supabase.table(TABLE).update({
        "avg_game1_pressure": avg_game1_pressure,
        "response_time_ms": response_time_ms,
    }).eq("session_id", session_id).execute()

    return jsonify({
        "avg_game1_pressure": avg_game1_pressure,
        "response_time_ms": response_time_ms,
    })


@app.route("/api/stress-detection/game2", methods=["POST"])
def submit_game2():
    """body.trials: list of exactly 3 trial dicts, each with:
    avg_touch_pressure, peak_pressure, time_on_target_ms, jitter_index, overshoot_count
    """
    body = request.get_json(force=True)
    session_id = body["session_id"]
    trials = body["trials"]

    if len(trials) != 3:
        return jsonify({"error": "exactly 3 trials required"}), 400

    avg_inflator_pressure = sum(t["avg_touch_pressure"] for t in trials) / 3
    peak_inflator_pressure = max(t["peak_pressure"] for t in trials)
    # avg_time_on_target_ms = sum(t["time_on_target_ms"] for t in trials) / 3
    avg_time_on_target_ms = round(sum(t["time_on_target_ms"] for t in trials) / 3)
    avg_jitter_index = sum(t["jitter_index"] for t in trials) / 3
    # total_overshoot_count = sum(t["overshoot_count"] for t in trials)
    total_overshoot_count = int(sum(t["overshoot_count"] for t in trials))


    supabase.table(TABLE).update({
        "avg_inflator_pressure": avg_inflator_pressure,
        "peak_inflator_pressure": peak_inflator_pressure,
        "avg_time_on_target_ms": avg_time_on_target_ms,
        "avg_jitter_index": avg_jitter_index,
        "total_overshoot_count": total_overshoot_count,
    }).eq("session_id", session_id).execute()

    return jsonify({
        "avg_inflator_pressure": avg_inflator_pressure,
        "peak_inflator_pressure": peak_inflator_pressure,
        "avg_time_on_target_ms": avg_time_on_target_ms,
        "avg_jitter_index": avg_jitter_index,
        "total_overshoot_count": total_overshoot_count,
    })


@app.route("/api/stress-detection/predict", methods=["POST"])
def predict():
    body = request.get_json(force=True)
    session_id = body["session_id"]

    row = get_session_row(session_id)
    if row is None:
        return jsonify({"error": "session not found"}), 404

    for field in ("avg_game1_pressure", "avg_inflator_pressure", "response_time_ms"):
        if row.get(field) is None:
            return jsonify({"error": f"missing {field}; complete prior steps first"}), 400

    avg_game_pressure = (row["avg_game1_pressure"] + row["avg_inflator_pressure"]) / 2
    gap = avg_game_pressure - (row.get("avg_baseline_pressure") or 0.0)
    status = pressure_status(gap)

    model_output, model_confidence = predict_stress(
        response_time_ms=row["response_time_ms"],
        avg_touch_pressure=avg_game_pressure,
    )

    recommendation = intervention_recommendation(
        model_output, row.get("pss10_classification", "Low")
    )

    supabase.table(TABLE).update({
        "avg_game_pressure": avg_game_pressure,
        "pressure_gap": gap,
        "pressure_status": status,
        "model_output": model_output,
        "model_confidence": model_confidence,
    }).eq("session_id", session_id).execute()

    return jsonify({
        "avg_game_pressure": avg_game_pressure,
        "pressure_gap": gap,
        "pressure_status": status,
        "model_output": model_output,
        "model_confidence": model_confidence,
        "intervention_recommendation": recommendation,
    })


# ---------------------------------------------------------------------------
# Routes — HR dashboard (Supabase-session authenticated)
# ---------------------------------------------------------------------------

@app.route("/api/stress-detection/assessments", methods=["GET"])
@require_hr_auth
def list_assessments():
    result = (
        supabase.table(TABLE)
        .select("*")
        .order("session_datetime", desc=True)
        .execute()
    )
    return jsonify(result.data)


@app.route("/api/stress-detection/assessments/<session_id>", methods=["GET"])
@require_hr_auth
def get_assessment(session_id):
    row = get_session_row(session_id)
    if row is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(row)


@app.route("/healthz", methods=["GET"])
def healthz():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5003))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_ENV") == "development") 
