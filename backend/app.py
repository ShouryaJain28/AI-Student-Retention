from __future__ import annotations
"""Flask application entrypoint for API v2.

This module wires environment loading, app configuration, core services,
and route blueprints in one place.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from .model.risk_model import StudentRiskModel
from .routes.analytics_routes import analytics_bp
from .routes.auth_routes import auth_bp
from .routes.chat_routes import chat_bp
from .routes.predict_routes import predict_bp
from .routes.students_routes import students_bp


def create_app() -> Flask:
    # Load backend-local environment variables (backend/.env).
    env_path = Path(__file__).resolve().parent / ".env"
    load_dotenv(dotenv_path=env_path)

    app = Flask(__name__)
    # Core security and token configuration.
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "change-this-in-production-min-32-characters")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = int(os.getenv("JWT_EXPIRES_SEC", "86400"))

    # Allow frontend(s) configured in CORS_ORIGINS to access this API.
    CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*").split(",")}})
    JWTManager(app)

    # Initialize and cache the ML model once at app startup.
    app.config["risk_model"] = StudentRiskModel()

    # Register API modules.
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(predict_bp)
    app.register_blueprint(students_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(chat_bp)

    @app.get("/health")
    def health():
        return jsonify({"ok": True, "service": "student-retention-api-v2"})

    return app


if __name__ == "__main__":
    flask_app = create_app()
    port = int(os.getenv("PORT", "5000"))
    # Use FLASK_DEBUG=true only for local development.
    flask_app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
