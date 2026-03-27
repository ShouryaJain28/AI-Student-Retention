from __future__ import annotations

from functools import wraps
import re
from typing import Any, Callable

from flask import jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity

from .storage import load_users


def role_required(*roles: str) -> Callable[..., Any]:
    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            claims = get_jwt()
            role = claims.get("role")
            if roles and role not in roles:
                return jsonify({"error": "Forbidden for this role"}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def get_current_role() -> str:
        claims = get_jwt()
        return str(claims.get("role", "")).strip().lower()


def resolve_current_student(students: list[dict[str, Any]]) -> dict[str, Any] | None:
        claims = get_jwt()
        student_id_claim = claims.get("student_id")
        identity_email = str(get_jwt_identity() or "").strip().lower()
        identity_name = str(claims.get("name", "")).strip().lower()

        if identity_name:
                suffix_match = re.search(r"(\d+)\s*$", identity_name)
                if suffix_match:
                        try:
                                target_id = int(suffix_match.group(1))
                                match = next((student for student in students if int(student.get("student_id", -1)) == target_id), None)
                                if match:
                                        return match
                        except Exception:
                                pass

        if student_id_claim not in (None, ""):
                try:
                        target_id = int(student_id_claim)
                        match = next((student for student in students if int(student.get("student_id", -1)) == target_id), None)
                        if match:
                                return match
                except Exception:
                        pass

        if identity_email:
                try:
                        users = load_users()
                        user = next((item for item in users if str(item.get("email", "")).strip().lower() == identity_email), None)
                        mapped_student_id = user.get("student_id") if user else None
                        if mapped_student_id not in (None, ""):
                                target_id = int(mapped_student_id)
                                match = next((student for student in students if int(student.get("student_id", -1)) == target_id), None)
                                if match:
                                        return match
                except Exception:
                        pass

        if identity_email:
                match = next(
                        (
                                student
                                for student in students
                                if str(student.get("email", "")).strip().lower() == identity_email
                        ),
                        None,
                )
                if match:
                        return match

        if identity_name:
                match = next(
                        (
                                student
                                for student in students
                                if str(student.get("name", "")).strip().lower() == identity_name
                        ),
                        None,
                )
                if match:
                        return match

        return None
