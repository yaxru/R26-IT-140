"""
Stress Detection — model inference.

Model artifacts (trained offline, see TESTING.ipynb):
  - stress_model.pkl  -> sklearn LogisticRegression
  - scaler.pkl        -> sklearn StandardScaler

Core input features (in this exact order, matching training):
  [unlock_time_ms / response_time_ms, avg_touch_pressure / avg_game_pressure]

Place both .pkl files in services/stress_detection/models/ before running.
"""

import os
import pickle

import numpy as np

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODELS_DIR, "stress_model.pkl")
SCALER_PATH = os.path.join(MODELS_DIR, "scaler.pkl")

_model = None
_scaler = None


def _load():
    global _model, _scaler
    if _model is None:
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
        with open(SCALER_PATH, "rb") as f:
            _scaler = pickle.load(f)
    return _model, _scaler


def predict_stress(response_time_ms: float, avg_touch_pressure: float) -> tuple[int, float]:
    """Returns (model_output, model_confidence_percent).

    model_output: 0 = Not Stressed, 1 = Stressed
    model_confidence: probability (%) of the predicted class
    """
    model, scaler = _load()

    input_data = np.array([[response_time_ms, avg_touch_pressure]])
    input_scaled = scaler.transform(input_data)

    prediction = int(model.predict(input_scaled)[0])

    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(input_scaled)[0]
        confidence = round(float(proba[prediction]) * 100, 2)
    else:
        confidence = 100.0

    return prediction, confidence
