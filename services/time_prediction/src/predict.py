from pathlib import Path
import pandas as pd
import joblib

# Load model
BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BASE_DIR / "model" / "productivity_model.joblib"

pipe = joblib.load(MODEL_PATH)


def efficiency_level(p: float) -> str:
    if p >= 0.80:
        return "High"
    elif p >= 0.60:
        return "Medium"
    return "Low"


def predict_batch(
    current_row: dict,
    batch_qty: int,
    machine_breakdown_minutes: float = 0
):
    X_new = pd.DataFrame([current_row])

    pred_prod = float(pipe.predict(X_new)[0])
    pred_prod = max(pred_prod, 0.05)

    targeted = float(current_row.get("targeted_productivity", 0.7))

    if pred_prod >= targeted:
        delay_prediction = "On-time"
    elif pred_prod >= targeted * 0.85:
        delay_prediction = "Slight Delay"
    else:
        delay_prediction = "Delayed"

    try:
        smv = float(current_row["smv"])
        workers = float(current_row["no_of_workers"])
        breakdown_minutes = max(float(machine_breakdown_minutes), 0)

        if workers <= 0:
            raise ValueError("Number of workers must be > 0")

        base_minutes = (batch_qty * smv) / (workers * pred_prod)

        # Machine breakdown adjustment
        adjusted_minutes = base_minutes + breakdown_minutes
        adjusted_hours = adjusted_minutes / 60.0

        if breakdown_minutes > 0:
            if delay_prediction == "On-time":
                delay_prediction = "Disruption Delay"
            elif delay_prediction == "Slight Delay":
                delay_prediction = "Disruption + Slight Delay"
            else:
                delay_prediction = "High Delay Risk"

    except Exception as e:
        raise ValueError(f"Time calculation error: {e}")

    return {
        "predicted_productivity": round(pred_prod, 4),
        "efficiency_level": efficiency_level(pred_prod),
        "delay_prediction": delay_prediction,

        "base_time_minutes": round(base_minutes, 2),
        "base_time_hours": round(base_minutes / 60.0, 2),

        "machine_breakdown_minutes": round(breakdown_minutes, 2),

        "estimated_time_minutes": round(adjusted_minutes, 2),
        "estimated_time_hours": round(adjusted_hours, 2),
    }