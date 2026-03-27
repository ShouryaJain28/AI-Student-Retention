from __future__ import annotations

from typing import Any

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

predict_bp = Blueprint("predict", __name__)


@predict_bp.post("/predict")
@jwt_required()
def predict() -> Any:
    payload = request.get_json(silent=True) or {}
    attendance_pct = float(payload.get("attendance_pct") or payload.get("attendance") or 0)
    marks = float(payload.get("average_marks") or payload.get("marks") or 0)
    behavior_score = float(payload.get("behavior_score") or 0.5)

    model = current_app.config["risk_model"]
    result = model.predict(attendance_pct=attendance_pct, marks=marks, behavior_score=behavior_score)

    return jsonify(
        {
            "risk_level": result.risk_level,
            "probability": result.probability,
            "recommendation": result.recommendation,
        }
    )
