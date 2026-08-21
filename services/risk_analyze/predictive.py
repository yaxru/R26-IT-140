"""
predictive.py

STUB / MOCK for Function 2: "Predictive Model Brain" (the teammate's Random
Forest model). The real model isn't wired up yet, so this simulates
plausible outputs with the exact same response shape the real one will
return: predicted_output, predicted_efficiency, efficiency_class,
batch_completion_time.

Ported 1:1 from the original Node.js `service/predictiveService.js`.

TO SWAP IN THE REAL MODEL LATER:
    Replace the body of `predict()` with a call to your teammate's
    /predict endpoint (or import their SDK/model directly), keeping the
    same input/output shape so nothing else in this service has to change.
"""
from __future__ import annotations

import random
from typing import Optional

SKILL_FACTOR = {"A": 1.05, "B": 1.0, "C": 0.9}


def _clamp(value: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, value))


def predict(
    target_output: float,
    working_minutes: float,
    operator_skill: str = "B",
    shift: str = "day",
    machine_status: str = "ok",
    historical_avg_efficiency: Optional[float] = None,
) -> dict:
    # Baseline "employee performance" factor — falls back to a
    # random-but-plausible baseline for employees with no history yet.
    if historical_avg_efficiency is not None:
        perf = float(historical_avg_efficiency) / 100
    else:
        perf = 0.85 + random.random() * 0.1
    perf = _clamp(perf, 0.4, 1.0)

    skill_factor = SKILL_FACTOR.get(operator_skill, 1.0)
    shift_factor = 0.95 if shift == "night" else 1.0
    machine_factor = {"maintenance": 0.65, "breakdown": 0.4}.get(machine_status, 1.0)

    # +/- 3% random noise so it doesn't look perfectly deterministic
    noise = 1 + (random.random() * 0.06 - 0.03)

    combined_factor = _clamp(perf * skill_factor * shift_factor * machine_factor * noise, 0.1, 1.15)

    predicted_output = round(target_output * combined_factor, 2)
    predicted_efficiency = round(combined_factor * 100, 2)
    efficiency_class = "High Efficiency" if predicted_efficiency >= 75 else "Low Efficiency"

    batch_completion_time = (
        round((target_output / predicted_output) * working_minutes, 2)
        if working_minutes and predicted_output > 0
        else None
    )

    return {
        "predicted_output": predicted_output,
        "predicted_efficiency": predicted_efficiency,
        "efficiency_class": efficiency_class,
        "batch_completion_time": batch_completion_time,
    }
