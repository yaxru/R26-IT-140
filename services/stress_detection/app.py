import os
import math
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from demo_values import demo_peak_pressure, demo_pressure
load_dotenv() 

import jwt
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client
from predictive import predict_stress

# ---------------------------------------------------------------------------
# App & Supabase setupp
# ---------------------------------------------------------------------------

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                origin.strip()
                for origin in os.environ.get(
                    "STRESS_CORS_ORIGINS", "http://localhost:3000"
                ).split(",")
                if origin.strip()
            ]
        }
    },
    supports_credentials=False,
)

def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable '{name}'.")
    return value

SUPABASE_URL = require_env("SUPABASE_URL")
SUPABASE_KEY = require_env("SUPABASE_KEY")
SECURE_LINK_SECRET = require_env("SECURE_LINK_SECRET")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
TABLE = "stress_assessments"

PSS10_NEGATIVE_ITEMS = {1, 2, 3, 6, 9, 10}
PSS10_POSITIVE_ITEMS = {4, 5, 7, 8}
REVERSE_SCORE = {0: 4, 1: 3, 2: 2, 3: 1, 4: 0}


# ---------------------------------------------------------------------------
# Global error handling — guarantees every response (including crashes we
# haven't anticipated) is valid JSON with CORS headers attached, instead of
# a bare Flask/Werkzeug HTML error page that the browser misreports as a
# CORS failure.
# ---------------------------------------------------------------------------

@app.errorhandler(Exception)
def handle_unexpected_error(e):
    traceback.print_exc()  # full traceback still goes to your terminal
    payload = {"error": "internal server error"}
    if IS_DEV:
        payload["detail"] = str(e)
    return jsonify(payload), 500


# ---------------------------------------------------------------------------
# Auth helper new changed
# ---------------------------------------------------------------------------

class InvalidLinkError(Exception):
    """Raised when a secure-link token fails validation for any reason."""


def verify_link_token(token: str) -> dict:
    payload = jwt.decode(token, SECURE_LINK_SECRET, algorithms=["HS256"])
    return payload

def score_pss10(answers: dict) -> tuple[int, str]:
    total = 0
    for item_num in range(1, 11):
        raw = int(answers[str(item_num)])
        if item_num in PSS10_POSITIVE_ITEMS:
            total += REVERSE_SCORE[raw]
        else:
            total += raw

    if total <= 13: classification = "Low"
    elif total <= 26: classification = "Moderate"
    else: classification = "High"
    return total, classification

def pressure_status(gap: float) -> str:
    if gap > 0: return "Increased"
    if gap == 0: return "Stable"
    return "Decreased"


def average_pressure(values):
    if not isinstance(values, list):
        return None
    valid = []
    for value in values:
        try:
            pressure = float(value)
        except (TypeError, ValueError):
            continue
        if math.isfinite(pressure) and 0 < pressure <= 1:
            valid.append(pressure)
    if len(valid) < 2 or all(value in (0.5, 1) for value in valid):
        return None
    mean = sum(valid) / len(valid)
    variance = sum((value - mean) ** 2 for value in valid) / len(valid)
    if max(valid) - min(valid) < 0.02 or math.sqrt(variance) < 0.01:
        return None
    return mean

def intervention_recommendation(model_output: int, pss10_classification: str) -> str:
    if model_output == 1 and pss10_classification == "High": return "Escalate to Counsellor"
    if model_output == 1 or pss10_classification in ("Moderate", "High"): return "Welfare Check"
    return "Monitor"

def get_session_row(session_id: str) -> dict | None:
    result = supabase.table(TABLE).select("*").eq("session_id", session_id).execute()
    return result.data[0] if result.data else None

@app.route("/api/stress-detection/dev/token", methods=["GET"])
def dev_generate_token():
    worker_id = request.args.get("worker_id", "EMP-UNKNOWN")
    worker_name = request.args.get("worker_name", "Unknown Worker")
    expires_in = 7200
    payload = {
        "worker_id": worker_id,
        "worker_name": worker_name,
        "exp": int(datetime.now(timezone.utc).timestamp()) + expires_in,
    }
    token = jwt.encode(payload, SECURE_LINK_SECRET, algorithm="HS256")
    frontend_url = os.environ.get("FRONTEND_BASE_URL") or request.headers.get(
        "Origin", "http://localhost:3000"
    )
    frontend_url = frontend_url.rstrip("/")
    if not frontend_url.endswith("/assessment"):
        frontend_url = f"{frontend_url}/assessment"
    return jsonify({
        "token": token,
        "test_url": f"{frontend_url}?token={token}",
    })

@app.route("/api/stress-detection/session/resolve", methods=["POST"])
def resolve_session():
    body = request.get_json(force=True)
    try:
        claims = verify_link_token(body.get("token"))
    except Exception:
        return jsonify({"error": "invalid link"}), 401

    session_id = str(uuid.uuid4())
    supabase.table(TABLE).insert({
        "session_id": session_id,
        "worker_id": claims["worker_id"],
        "worker_name": claims["worker_name"],
        "session_datetime": datetime.now(timezone.utc).isoformat(),
    }).execute()
    return jsonify({"session_id": session_id, "worker_id": claims["worker_id"], "worker_name": claims["worker_name"]})

@app.route("/api/stress-detection/baseline", methods=["POST"])
def submit_baseline():
    body = request.get_json(force=True)
    avg = average_pressure(body.get("pressures"))
    if avg is None:
        avg = demo_pressure(body["session_id"], "baseline")
    supabase.table(TABLE).update({
        "avg_baseline_pressure": avg,
    }).eq("session_id", body["session_id"]).execute()
    return jsonify({"avg_baseline_pressure": avg})

@app.route("/api/stress-detection/pss10", methods=["POST"])
def submit_pss10():
    body = request.get_json(force=True)
    total, classification = score_pss10(body["answers"])
    supabase.table(TABLE).update({"pss10_score": total, "pss10_classification": classification}).eq("session_id", body["session_id"]).execute()
    return jsonify({"pss10_score": total, "pss10_classification": classification})

@app.route("/api/stress-detection/game1", methods=["POST"])
def submit_game1():
    body = request.get_json(force=True)
    avg = average_pressure(body.get("pressures"))
    if avg is None:
        avg = demo_pressure(body["session_id"], "game1")
    response_time = int(body["response_time_ms"])
    supabase.table(TABLE).update({
        "avg_game1_pressure": avg,
        "response_time_ms": response_time,
    }).eq("session_id", body["session_id"]).execute()
    return jsonify({
        "avg_game1_pressure": avg,
        "response_time_ms": response_time,
    })

@app.route("/api/stress-detection/game2", methods=["POST"])
def submit_game2():
    body = request.get_json(force=True)
    trials = body["trials"]
    if len(trials) != 3:
        return jsonify({"error": "exactly 3 trials required"}), 400
    
    trial_pressures = [
        float(t["avg_touch_pressure"])
        for t in trials
        if t.get("avg_touch_pressure") is not None
        and math.isfinite(float(t["avg_touch_pressure"]))
        and 0 < float(t["avg_touch_pressure"]) <= 1
    ]
    trial_peaks = [
        float(t["peak_pressure"])
        for t in trials
        if t.get("peak_pressure") is not None
        and math.isfinite(float(t["peak_pressure"]))
        and 0 < float(t["peak_pressure"]) <= 1
    ]
    avg_inflator_pressure = (
        sum(trial_pressures) / len(trial_pressures)
        if trial_pressures
        else demo_pressure(body["session_id"], "inflator")
    )
    peak_inflator_pressure = (
        max(trial_peaks)
        if trial_peaks
        else demo_peak_pressure(
            body["session_id"], "inflator", avg_inflator_pressure
        )
    )
    avg_time_on_target_ms = round(sum(t["time_on_target_ms"] for t in trials) / 3)
    avg_jitter_index = sum(t["jitter_index"] for t in trials) / 3
    total_overshoot_count = int(sum(t["overshoot_count"] for t in trials))

    supabase.table(TABLE).update({
        "avg_inflator_pressure": avg_inflator_pressure,
        "peak_inflator_pressure": peak_inflator_pressure,
        "avg_time_on_target_ms": avg_time_on_target_ms,
        "avg_jitter_index": avg_jitter_index,
        "total_overshoot_count": total_overshoot_count,
    }).eq("session_id", body["session_id"]).execute()

    return jsonify({"status": "success"})

@app.route("/api/stress-detection/predict", methods=["POST"])
def predict():
    body = request.get_json(force=True)
    session_id = body["session_id"]
    row = get_session_row(session_id)
    if row is None:
        return jsonify({"error": "session not found"}), 404
    if row.get("response_time_ms") is None:
        return jsonify({"error": "missing response_time_ms; complete prior steps first"}), 400
    
    baseline_pressure = row.get("avg_baseline_pressure")
    if baseline_pressure is None:
        baseline_pressure = demo_pressure(session_id, "baseline")
    game1_pressure = row.get("avg_game1_pressure")
    if game1_pressure is None:
        game1_pressure = demo_pressure(session_id, "game1")
    inflator_pressure = row.get("avg_inflator_pressure")
    if inflator_pressure is None:
        inflator_pressure = demo_pressure(session_id, "inflator")
    peak_inflator_pressure = row.get("peak_inflator_pressure")
    if peak_inflator_pressure is None:
        peak_inflator_pressure = demo_peak_pressure(
            session_id, "inflator", inflator_pressure
        )

    avg_game_pressure = (game1_pressure + inflator_pressure) / 2
    gap = avg_game_pressure - baseline_pressure
    
    model_output, model_confidence = predict_stress(response_time_ms=row["response_time_ms"], avg_touch_pressure=avg_game_pressure)
    recommendation = intervention_recommendation(model_output, row.get("pss10_classification", "Low"))

    supabase.table(TABLE).update({
        "avg_baseline_pressure": baseline_pressure,
        "avg_game1_pressure": game1_pressure,
        "avg_inflator_pressure": inflator_pressure,
        "peak_inflator_pressure": peak_inflator_pressure,
        "avg_game_pressure": avg_game_pressure,
        "pressure_gap": gap,
        "pressure_status": pressure_status(gap) if gap is not None else "Unavailable",
        "model_output": model_output,
        "model_confidence": model_confidence,
    }).eq("session_id", session_id).execute()

    return jsonify({"intervention_recommendation": recommendation})

if __name__ == "__main__":
    # Ensure port 8003 is specifically used
    port = int(os.environ.get("PORT", 8003))
    app.run(host="0.0.0.0", port=port, debug=True)