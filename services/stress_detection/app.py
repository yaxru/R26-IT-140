"""
Stress Detection Service — Flask backend
Component 4 of R26-IT-140 (Garment Production Optimization System)

Flow: secure-link token resolve -> baseline -> PSS-10 -> Game 1 (Egg Cracker)
-> Game 2 (Precision Inflator, 3 trials) -> predict -> HR dashboard read.
"""

import os
import re
import traceback
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

PLACEHOLDER_VALUES = {
    "your-project.supabase.co",
    "https://your-project.supabase.co",
    "your-service-role-key",
    "change-me-shared-with-component2",
}

REQUIRED_LINK_CLAIMS = ("worker_id", "worker_name")
IS_DEV = os.environ.get("FLASK_ENV") == "development"


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Missing required environment variable '{name}'. "
            f"Copy .env.example to .env in this folder, fill in real values, "
            f"and restart the server."
        )
    if value in PLACEHOLDER_VALUES:
        raise RuntimeError(
            f"'{name}' is still set to the placeholder value from .env.example "
            f"('{value}'). Replace it with your real Supabase value and restart."
        )
    return value


def require_jwt_shaped_env(name: str) -> str:
    """Extra check for Supabase keys: must look like a JWT (3 dot-separated
    base64 segments), otherwise supabase-py fails with an unhelpful
    'Invalid API key' error with no indication of which variable is wrong."""
    value = require_env(name)
    if len(value.split(".")) != 3 or not re.match(r"^[A-Za-z0-9_\-\.]+$", value):
        raise RuntimeError(
            f"'{name}' doesn't look like a valid Supabase key (expected a JWT "
            f"with 3 dot-separated segments, e.g. 'eyJ...eyJ...signature'). "
            f"Check for stray quotes, trailing whitespace/newlines, or that you "
            f"copied the 'service_role' key (not the project URL or anon key) "
            f"from Supabase Dashboard -> Settings -> API."
        )
    return value


SUPABASE_URL = require_env("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = require_jwt_shaped_env("SUPABASE_SERVICE_ROLE_KEY")
SECURE_LINK_SECRET = require_env("SECURE_LINK_SECRET")  # shared with Component 2
FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:3000")

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
except Exception as e:
    raise RuntimeError(
        f"Failed to create Supabase client with SUPABASE_URL='{SUPABASE_URL}'. "
        f"Double-check the URL is your project's exact URL from "
        f"Supabase Dashboard -> Settings -> API -> Project URL. Original error: {e}"
    ) from e

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
# Auth helpers
# ---------------------------------------------------------------------------

class InvalidLinkError(Exception):
    """Raised when a secure-link token fails validation for any reason."""


def verify_link_token(token: str) -> dict:
    """Decode & validate the secure-link token issued by Component 2.

    Expected claims: worker_id, worker_name, exp.
    Raises InvalidLinkError with a clear message on any failure.
    """
    try:
        claims = jwt.decode(token, SECURE_LINK_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise InvalidLinkError("This link has expired.")
    except jwt.InvalidTokenError as e:
        raise InvalidLinkError(f"This link is invalid: {e}")

    missing = [c for c in REQUIRED_LINK_CLAIMS if c not in claims]
    if missing:
        raise InvalidLinkError(
            f"Token is missing required claim(s): {', '.join(missing)}. "
            f"Expected claims: {REQUIRED_LINK_CLAIMS}. "
            f"If you're testing locally, restart the server and use the test "
            f"link printed in the console, or GET /api/stress-detection/dev/token."
        )
    return claims


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


def make_dev_token(worker_id: str, worker_name: str, expires_in: int) -> str:
    payload = {
        "worker_id": worker_id,
        "worker_name": worker_name,
        "exp": int(datetime.now(timezone.utc).timestamp()) + expires_in,
    }
    return jwt.encode(payload, SECURE_LINK_SECRET, algorithm="HS256")


# ---------------------------------------------------------------------------
# Dev-only helper — generate a test secure-link token without needing a
# separate script or worrying about secret mismatches, since this process
# already has SECURE_LINK_SECRET loaded. Disabled unless FLASK_ENV=development.
# ---------------------------------------------------------------------------

@app.route("/api/stress-detection/dev/token", methods=["GET"])
def dev_generate_token():
    if not IS_DEV:
        return jsonify({"error": "not found"}), 404

    worker_id = request.args.get("worker_id", "EMP-1042")
    worker_name = request.args.get("worker_name", "Nimal Perera")
    try:
        expires_in = int(request.args.get("expires_in", 7200))
    except ValueError:
        return jsonify({"error": "expires_in must be an integer (seconds)"}), 400

    token = make_dev_token(worker_id, worker_name, expires_in)

    return jsonify({
        "token": token,
        "test_url": f"{FRONTEND_BASE_URL}/?token={token}",
        "worker_id": worker_id,
        "worker_name": worker_name,
        "expires_in_seconds": expires_in,
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
    except InvalidLinkError as e:
        return jsonify({"error": str(e)}), 401

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

    NOTE: avg_time_on_target_ms and total_overshoot_count are `integer`
    columns in schema.sql — they must be cast with round()/int() before
    being sent to Supabase, since Python's `/` always produces a float and
    Postgres will reject a float literal for an integer column
    (error 22P02: invalid input syntax for type integer).
    """
    body = request.get_json(force=True)
    session_id = body["session_id"]
    trials = body["trials"]

    if len(trials) != 3:
        return jsonify({"error": "exactly 3 trials required"}), 400

    avg_inflator_pressure = sum(t["avg_touch_pressure"] for t in trials) / 3
    peak_inflator_pressure = max(t["peak_pressure"] for t in trials)
    avg_time_on_target_ms = round(sum(t["time_on_target_ms"] for t in trials) / 3)
    avg_jitter_index = sum(t["jitter_index"] for t in trials) / 3
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


def print_dev_test_link():
    token = make_dev_token("EMP-1042", "Nimal Perera", expires_in=7200)
    test_url = f"{FRONTEND_BASE_URL}/?token={token}"
    banner = "=" * max(60, len(test_url) + 4)
    print("\n" + banner)
    print(" DEV TEST LINK (worker: Nimal Perera / EMP-1042, valid 2h)")
    print(f" {test_url}")
    print(" Regenerate anytime: GET /api/stress-detection/dev/token")
    print(banner + "\n")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5003))

    if IS_DEV and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        # Flask's debug reloader re-executes this file in a child process
        # (setting WERKZEUG_RUN_MAIN=true there). This guard ensures the
        # link prints exactly once instead of twice.
        print_dev_test_link()

    app.run(host="0.0.0.0", port=port, debug=IS_DEV)




