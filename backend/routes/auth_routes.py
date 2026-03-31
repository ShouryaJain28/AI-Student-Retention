from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash, generate_password_hash

from ..utils.storage import load_students, load_users, save_users

auth_bp = Blueprint("auth", __name__)
ALLOWED_DOC_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "doc", "docx", "txt"}
ALLOWED_ROLES = {"student", "teacher", "admin"}
LEGACY_SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
GOOGLE_CLIENT_ID_PATTERN = re.compile(r"^[\w-]+\.apps\.googleusercontent\.com$")
ROOT = Path(__file__).resolve().parents[1]
UPLOADS_DIR = ROOT / "data" / "documents"


def _build_user_claims(user: dict[str, Any]) -> dict[str, Any]:
    claims = {"role": user["role"], "name": user["name"]}
    if user.get("role") == "student" and user.get("student_id") is not None:
        claims["student_id"] = int(user["student_id"])
    return claims


def _build_user_payload(user: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "personal_data": user.get("personal_data", {}),
        "documents": user.get("documents", []),
    }
    if user.get("role") == "student" and user.get("student_id") is not None:
        payload["student_id"] = int(user["student_id"])
    return payload


def _safe_email_folder(email: str) -> str:
    return secure_filename(email.replace("@", "_at_")) or "user"


def _get_doc_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _find_user_by_email(users: list[dict[str, Any]], email: str) -> tuple[int | None, dict[str, Any] | None]:
    index = next((idx for idx, item in enumerate(users) if item["email"] == email), None)
    if index is None:
        return None, None
    return index, users[index]


def _normalize_role(raw_role: Any, default: str = "student") -> str:
    role = str(raw_role or default).strip().lower() or default
    return role if role in ALLOWED_ROLES else default


def _password_matches(stored_hash: str, candidate_password: str) -> bool:
    if not stored_hash or not candidate_password:
        return False

    # Preferred path for werkzeug-generated password hashes.
    try:
        if check_password_hash(stored_hash, candidate_password):
            return True
    except Exception:
        pass

    # Compatibility path for older plain SHA256 hex digests.
    normalized_hash = stored_hash.strip().lower()
    if LEGACY_SHA256_PATTERN.fullmatch(normalized_hash):
        computed_hash = hashlib.sha256(candidate_password.encode("utf-8")).hexdigest()
        return hmac.compare_digest(normalized_hash, computed_hash)

    return False


def _decode_jwt_payload_without_verification(token: str) -> dict[str, Any]:
    parts = str(token or "").split(".")
    if len(parts) != 3:
        return {}

    payload_segment = parts[1]
    payload_segment += "=" * (-len(payload_segment) % 4)
    try:
        payload_bytes = base64.urlsafe_b64decode(payload_segment.encode("utf-8"))
        payload = json.loads(payload_bytes.decode("utf-8"))
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def _google_audience_matches(audience: Any, expected_client_id: str) -> bool:
    if not expected_client_id:
        return True
    if isinstance(audience, list):
        return expected_client_id in [str(item).strip() for item in audience]
    return str(audience or "").strip() == expected_client_id


def _read_google_client_id() -> str:
    raw = str(os.getenv("GOOGLE_CLIENT_ID", "")).strip().strip("\"'").strip()
    if not raw:
        return ""

    # Allow accidental env values like "GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com".
    if "=" in raw:
        maybe_key, maybe_value = raw.split("=", 1)
        if maybe_key.strip().upper() == "GOOGLE_CLIENT_ID":
            raw = maybe_value.strip().strip("\"'").strip()

    # If multiple values are accidentally pasted, keep the first non-empty token.
    first_token = next((token.strip() for token in re.split(r"[\s,]+", raw) if token.strip()), "")
    if not first_token:
        return ""

    if not GOOGLE_CLIENT_ID_PATTERN.fullmatch(first_token):
        return ""

    return first_token


def _infer_student_id(email: str, name: str) -> int | None:
    students = load_students()
    normalized_email = str(email or "").strip().lower()
    normalized_name = str(name or "").strip().lower()

    if normalized_email:
        by_email = next(
            (
                student
                for student in students
                if str(student.get("email", "")).strip().lower() == normalized_email
            ),
            None,
        )
        if by_email and by_email.get("student_id") is not None:
            try:
                return int(by_email["student_id"])
            except Exception:
                pass

    if normalized_name:
        by_name = next(
            (
                student
                for student in students
                if str(student.get("name", "")).strip().lower() == normalized_name
            ),
            None,
        )
        if by_name and by_name.get("student_id") is not None:
            try:
                return int(by_name["student_id"])
            except Exception:
                pass

    return None


@auth_bp.get("/google-config")
def google_config() -> Any:
    client_id = _read_google_client_id()
    return jsonify({"enabled": bool(client_id), "clientId": client_id})


@auth_bp.post("/signup")
def signup() -> Any:
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", "")).strip()
    role = _normalize_role(payload.get("role"), default="student")
    name = str(payload.get("name", "User")).strip()
    student_id_raw = payload.get("student_id")
    student_id = int(student_id_raw) if student_id_raw not in (None, "") else None

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    users = load_users()
    if any(user["email"] == email for user in users):
        return jsonify({"error": "User already exists"}), 409

    new_user = {
        "name": name,
        "email": email,
        "role": role,
        "password_hash": generate_password_hash(password),
    }
    if role == "student" and student_id is None:
        student_id = _infer_student_id(email=email, name=name)

    if role == "student" and student_id is not None:
        new_user["student_id"] = student_id
    users.append(new_user)
    save_users(users)

    claims = {"role": role, "name": name}
    if role == "student" and student_id is not None:
        claims["student_id"] = student_id
    token = create_access_token(identity=email, additional_claims=claims)

    response_user = {"name": name, "email": email, "role": role}
    if role == "student" and student_id is not None:
        response_user["student_id"] = student_id
    return jsonify({"token": token, "user": response_user})


@auth_bp.post("/login")
def login() -> Any:
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", "")).strip()

    users = load_users()
    user_index, user = _find_user_by_email(users, email)
    stored_hash = str((user or {}).get("password_hash", "")).strip()
    if user is None or not _password_matches(stored_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401

    if user.get("role") == "student" and user.get("student_id") in (None, ""):
        inferred_student_id = _infer_student_id(email=user.get("email", ""), name=user.get("name", ""))
        if inferred_student_id is not None and user_index is not None:
            user["student_id"] = inferred_student_id
            users[user_index] = user
            save_users(users)

    claims = _build_user_claims(user)
    token = create_access_token(identity=user["email"], additional_claims=claims)
    response_user = _build_user_payload(user)

    return jsonify(
        {
            "token": token,
            "user": response_user,
        }
    )


@auth_bp.post("/forgot-password")
def forgot_password() -> Any:
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    new_password = str(payload.get("new_password", "")).strip()

    if not email or not new_password:
        return jsonify({"error": "Email and new password are required"}), 400

    users = load_users()
    user_index, user = _find_user_by_email(users, email)
    if user_index is None or user is None:
        return jsonify({"error": "User not found"}), 404

    user["password_hash"] = generate_password_hash(new_password)
    users[user_index] = user
    save_users(users)

    return jsonify({"message": "Password reset successful"})


@auth_bp.post("/google")
def login_google() -> Any:
    payload = request.get_json(silent=True) or {}
    token = str(payload.get("token", "")).strip()
    provided_email = str(payload.get("email", "")).strip().lower()
    provided_name = str(payload.get("name", "")).strip()
    role = _normalize_role(payload.get("role"), default="student")

    if not token:
        return jsonify({"error": "Missing Google token"}), 400

    token_claims = _decode_jwt_payload_without_verification(token)
    configured_client_id = _read_google_client_id()

    if token_claims and configured_client_id and not _google_audience_matches(token_claims.get("aud"), configured_client_id):
        return jsonify({"error": "Invalid Google token audience"}), 401

    if token_claims.get("email_verified") is False:
        return jsonify({"error": "Google account email is not verified"}), 401

    email = provided_email or str(token_claims.get("email", "")).strip().lower()
    name = provided_name or str(token_claims.get("name") or token_claims.get("given_name") or "Google User").strip() or "Google User"

    if not email:
        return jsonify({"error": "Google email not available. Ensure profile email scope is enabled."}), 400

    users = load_users()
    user = next((item for item in users if item["email"] == email), None)

    if user is None:
        user = {
            "name": name,
            "email": email,
            "role": role,
            "password_hash": generate_password_hash(token[:20] + "google-oauth"),
        }
        if role == "student":
            inferred_student_id = _infer_student_id(email=email, name=name)
            if inferred_student_id is not None:
                user["student_id"] = inferred_student_id
        users.append(user)
        save_users(users)
    elif user.get("role") == "student" and user.get("student_id") in (None, ""):
        user_index, _ = _find_user_by_email(users, email)
        inferred_student_id = _infer_student_id(email=user.get("email", ""), name=user.get("name", ""))
        if inferred_student_id is not None and user_index is not None:
            user["student_id"] = inferred_student_id
            users[user_index] = user
            save_users(users)

    claims = _build_user_claims(user)
    jwt_token = create_access_token(identity=user["email"], additional_claims=claims)
    response_user = _build_user_payload(user)

    return jsonify(
        {
            "token": jwt_token,
            "user": response_user,
        }
    )


@auth_bp.get("/profile")
@jwt_required()
def get_profile() -> Any:
    email = str(get_jwt_identity() or "").strip().lower()
    users = load_users()
    user = next((item for item in users if item["email"] == email), None)
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"user": _build_user_payload(user)})


@auth_bp.put("/profile")
@jwt_required()
def update_profile() -> Any:
    current_email = str(get_jwt_identity() or "").strip().lower()
    payload = request.get_json(silent=True) or {}

    users = load_users()
    user_index = next((index for index, item in enumerate(users) if item["email"] == current_email), None)
    if user_index is None:
        return jsonify({"error": "User not found"}), 404

    user = users[user_index]

    new_name = str(payload.get("name", user.get("name", ""))).strip()
    new_email = str(payload.get("email", user.get("email", ""))).strip().lower()
    new_password = str(payload.get("password", "")).strip()
    incoming_personal_data = payload.get("personal_data", {})

    if not new_name or not new_email:
        return jsonify({"error": "Name and email are required"}), 400

    if new_email != current_email and any(item["email"] == new_email for item in users):
        return jsonify({"error": "Email already in use"}), 409

    user["name"] = new_name
    user["email"] = new_email
    if new_password:
        user["password_hash"] = generate_password_hash(new_password)

    if isinstance(incoming_personal_data, dict):
        user["personal_data"] = {
            "phone": str(incoming_personal_data.get("phone", user.get("personal_data", {}).get("phone", ""))).strip(),
            "dob": str(incoming_personal_data.get("dob", user.get("personal_data", {}).get("dob", ""))).strip(),
            "address": str(incoming_personal_data.get("address", user.get("personal_data", {}).get("address", ""))).strip(),
            "department": str(incoming_personal_data.get("department", user.get("personal_data", {}).get("department", ""))).strip(),
            "bio": str(incoming_personal_data.get("bio", user.get("personal_data", {}).get("bio", ""))).strip(),
        }

    user.setdefault("documents", [])

    users[user_index] = user
    save_users(users)

    token = create_access_token(identity=user["email"], additional_claims=_build_user_claims(user))

    return jsonify(
        {
            "token": token,
            "user": _build_user_payload(user),
            "message": "Profile updated successfully",
        }
    )


@auth_bp.get("/profile/documents")
@jwt_required()
def list_profile_documents() -> Any:
    email = str(get_jwt_identity() or "").strip().lower()
    users = load_users()
    _, user = _find_user_by_email(users, email)
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"documents": user.get("documents", [])})


@auth_bp.post("/profile/documents")
@jwt_required()
def upload_profile_document() -> Any:
    email = str(get_jwt_identity() or "").strip().lower()
    users = load_users()
    user_index, user = _find_user_by_email(users, email)
    if user_index is None or user is None:
        return jsonify({"error": "User not found"}), 404

    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "Document file is required"}), 400

    original_name = secure_filename(file.filename)
    extension = _get_doc_extension(original_name)
    if extension not in ALLOWED_DOC_EXTENSIONS:
        return jsonify({"error": "Unsupported file type"}), 400

    doc_id = uuid4().hex
    user_folder = UPLOADS_DIR / _safe_email_folder(email)
    user_folder.mkdir(parents=True, exist_ok=True)
    stored_name = f"{doc_id}_{original_name}"
    saved_path = user_folder / stored_name
    file.save(saved_path)

    doc_info = {
        "id": doc_id,
        "name": original_name,
        "stored_name": stored_name,
        "size": saved_path.stat().st_size,
        "content_type": file.mimetype,
        "uploaded_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }

    user.setdefault("documents", []).append(doc_info)
    users[user_index] = user
    save_users(users)

    return jsonify({"message": "Document uploaded", "document": doc_info}), 201


@auth_bp.delete("/profile/documents/<doc_id>")
@jwt_required()
def delete_profile_document(doc_id: str) -> Any:
    email = str(get_jwt_identity() or "").strip().lower()
    users = load_users()
    user_index, user = _find_user_by_email(users, email)
    if user_index is None or user is None:
        return jsonify({"error": "User not found"}), 404

    documents = user.get("documents", [])
    doc = next((item for item in documents if item.get("id") == doc_id), None)
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    user_folder = UPLOADS_DIR / _safe_email_folder(email)
    file_path = user_folder / str(doc.get("stored_name", ""))
    if file_path.exists():
        file_path.unlink()

    user["documents"] = [item for item in documents if item.get("id") != doc_id]
    users[user_index] = user
    save_users(users)

    return jsonify({"message": "Document deleted", "documents": user["documents"]})
