from __future__ import annotations
"""Flask application entrypoint for API v2.

This module wires environment loading, app configuration, core services,
and route blueprints in one place.
"""

import os
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from .routes.analytics_routes import analytics_bp
from .routes.auth_routes import auth_bp
from .routes.chat_routes import chat_bp
from .routes.predict_routes import predict_bp
from .routes.students_routes import students_bp


@dataclass
class _PredictionResult:
    risk_level: str
    probability: float
    recommendation: str


class _HeuristicRiskModel:
    """Lightweight fallback model for constrained runtimes."""

    def predict(self, attendance_pct: float, marks: float, behavior_score: float) -> _PredictionResult:
        attendance = max(0.0, min(100.0, float(attendance_pct)))
        marks_value = max(0.0, min(100.0, float(marks)))
        behavior = max(0.0, min(1.0, float(behavior_score)))

        risk = ((100 - attendance) * 0.45 + (100 - marks_value) * 0.35 + ((1 - behavior) * 100) * 0.2) / 100
        probability = max(0.01, min(0.99, round(risk, 4)))

        if probability >= 0.7:
            return _PredictionResult("High", probability, "Urgent 1:1 mentoring and parent engagement within 48 hours")
        if probability >= 0.4:
            return _PredictionResult("Medium", probability, "Weekly check-ins, tutoring, and attendance follow-up")
        return _PredictionResult("Low", probability, "Continue current support and monthly monitoring")


def _build_risk_model() -> object:
    mode = str(os.getenv("RISK_MODEL_BACKEND", "auto")).strip().lower()
    if mode == "heuristic":
        return _HeuristicRiskModel()

    try:
        from .model.risk_model import StudentRiskModel

        return StudentRiskModel()
    except Exception:
        logging.exception("Failed to initialize sklearn model. Falling back to heuristic risk model.")
        return _HeuristicRiskModel()


def _safe_int_env(name: str, default: int) -> int:
    raw_value = str(os.getenv(name, "")).strip()
    if not raw_value:
        return default

    try:
        return int(raw_value)
    except ValueError:
        match = re.search(r"-?\d+", raw_value)
        if match:
            try:
                return int(match.group(0))
            except ValueError:
                pass

    logging.warning("Invalid integer env value for %s=%r. Falling back to default=%s", name, raw_value, default)
    return default


def create_app() -> Flask:
    # Load backend-local environment variables (backend/.env).
    env_path = Path(__file__).resolve().parent / ".env"
    load_dotenv(dotenv_path=env_path)

    project_root = Path(__file__).resolve().parents[1]
    frontend_dist = project_root / "frontend" / "dist"

    app = Flask(__name__, static_folder=str(frontend_dist), static_url_path="/")
    # Core security and token configuration.
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "change-this-in-production-min-32-characters")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = _safe_int_env("JWT_EXPIRES_SEC", 86400)

    # Allow frontend(s) configured in CORS_ORIGINS to access this API.
    CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*").split(",")}})
    JWTManager(app)

    # Initialize and cache the ML model once at app startup.
    app.config["risk_model"] = _build_risk_model()

    # Register API modules.
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(predict_bp)
    app.register_blueprint(students_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(chat_bp)

    @app.get("/health")
    def health():
        return jsonify({"ok": True, "service": "student-retention-api-v2"})

    @app.get("/")
    def serve_frontend_index():
        index_file = frontend_dist / "index.html"
        if index_file.exists():
            return send_from_directory(frontend_dist, "index.html")
        return jsonify({"ok": True, "message": "Frontend build not found. Build frontend/dist for production serving."})

    @app.get("/<path:asset_path>")
    def serve_frontend_assets(asset_path: str):
        index_file = frontend_dist / "index.html"
        requested = frontend_dist / asset_path

        if requested.is_file():
            return send_from_directory(frontend_dist, asset_path)
        if index_file.exists():
            # SPA fallback for client-side routing.
            return send_from_directory(frontend_dist, "index.html")
        return jsonify({"error": "Not found"}), 404

    return app


if __name__ == "__main__":
    flask_app = create_app()
    port = _safe_int_env("PORT", 5000)
    # Use FLASK_DEBUG=true only for local development.
    flask_app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
