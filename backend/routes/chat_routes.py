from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ..utils.storage import load_chat_messages, load_users, save_chat_messages, save_users

chat_bp = Blueprint("chat", __name__)
VALID_GROUPS = {"student", "teacher"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(iso_value: str | None) -> datetime | None:
    if not iso_value:
        return None
    try:
        return datetime.fromisoformat(str(iso_value).replace("Z", "+00:00"))
    except Exception:
        return None


def _resolve_sender_profile(email: str) -> dict[str, Any]:
    users = load_users()
    normalized_email = str(email or "").strip().lower()
    user_index = next(
        (idx for idx, item in enumerate(users) if str(item.get("email", "")).strip().lower() == normalized_email),
        None,
    )
    if user_index is None:
        return {"user_id": None, "student_id": None, "name": None}

    user = users[user_index]
    student_id_raw = user.get("student_id")
    student_id: int | None = None
    if student_id_raw not in (None, ""):
        try:
            student_id = int(student_id_raw)
        except Exception:
            student_id = None

    return {
        # Stable 1-based id from users.json ordering.
        "user_id": int(user_index) + 1,
        "student_id": student_id,
        "name": str(user.get("name") or "").strip() or None,
    }


def _enrich_sender_metadata(messages: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
    changed = False
    enriched_messages: list[dict[str, Any]] = []

    for message in messages:
        sender_email = str(message.get("sender_email", "")).strip().lower()
        if not sender_email:
            enriched_messages.append(message)
            continue

        profile = _resolve_sender_profile(sender_email)
        next_message = dict(message)

        if next_message.get("sender_user_id") != profile.get("user_id"):
            next_message["sender_user_id"] = profile.get("user_id")
            changed = True
        if next_message.get("sender_student_id") != profile.get("student_id"):
            next_message["sender_student_id"] = profile.get("student_id")
            changed = True
        if (not str(next_message.get("sender_name", "")).strip()) and profile.get("name"):
            next_message["sender_name"] = profile.get("name")
            changed = True

        enriched_messages.append(next_message)

    return enriched_messages, changed


@chat_bp.get("/chat/messages")
@jwt_required()
def list_messages() -> Any:
    claims = get_jwt()
    role = str(claims.get("role", "")).strip().lower()
    email = str(get_jwt_identity() or "").strip().lower()

    messages = load_chat_messages()
    messages, changed = _enrich_sender_metadata(messages)
    if changed:
        save_chat_messages(messages)

    if role == "student":
        visible_messages = [
            message
            for message in messages
            if str(message.get("group", "")).strip().lower() == "student" or bool(message.get("notify_students", False))
        ]
    else:
        visible_messages = messages

    users = load_users()
    user = next((item for item in users if str(item.get("email", "")).strip().lower() == email), None)
    last_seen = _parse_iso((user or {}).get("chat_last_seen_important_at"))

    important_notifications: list[dict[str, Any]] = []
    if role == "student":
        for message in visible_messages:
            if not bool(message.get("important", False)):
                continue
            if not bool(message.get("notify_students", False)):
                continue
            sent_at = _parse_iso(message.get("created_at"))
            if last_seen and sent_at and sent_at <= last_seen:
                continue
            important_notifications.append(
                {
                    "id": message.get("id"),
                    "title": "Important update from teacher",
                    "severity": "high",
                    "message": str(message.get("text", "")).strip(),
                }
            )

    ordered_messages = sorted(visible_messages, key=lambda item: str(item.get("created_at", "")))
    return jsonify(
        {
            "messages": ordered_messages,
            "important_notifications": important_notifications[:20],
        }
    )


@chat_bp.post("/chat/messages")
@jwt_required()
def create_message() -> Any:
    claims = get_jwt()
    role = str(claims.get("role", "")).strip().lower()
    sender_email = str(get_jwt_identity() or "").strip().lower()
    sender_profile = _resolve_sender_profile(sender_email)
    sender_name = str(sender_profile.get("name") or claims.get("name", "User")).strip() or "User"
    sender_user_id = sender_profile.get("user_id")
    sender_student_id = sender_profile.get("student_id")

    payload = request.get_json(silent=True) or {}
    text = str(payload.get("text", "")).strip()
    group = str(payload.get("group", "student")).strip().lower()
    important = bool(payload.get("important", False))

    if not text:
        return jsonify({"error": "Message text is required"}), 400

    if group not in VALID_GROUPS:
        return jsonify({"error": "Invalid group"}), 400

    if role == "student" and group != "student":
        return jsonify({"error": "Students can post only in student group"}), 403

    if important and role not in {"teacher", "admin"}:
        return jsonify({"error": "Only teacher/admin can send important messages"}), 403

    message = {
        "id": str(uuid4()),
        "group": group,
        "text": text,
        "sender_name": sender_name,
        "sender_role": role,
        "sender_email": sender_email,
        "sender_user_id": sender_user_id,
        "sender_student_id": sender_student_id,
        "important": important,
        "notify_students": important and role in {"teacher", "admin"},
        "created_at": _now_iso(),
    }

    messages = load_chat_messages()
    messages.append(message)
    save_chat_messages(messages)

    return jsonify({"message": message, "ok": True})


@chat_bp.post("/chat/mark-important-seen")
@jwt_required()
def mark_important_seen() -> Any:
    claims = get_jwt()
    role = str(claims.get("role", "")).strip().lower()
    email = str(get_jwt_identity() or "").strip().lower()

    if role != "student":
        return jsonify({"ok": True})

    users = load_users()
    user_index = next((idx for idx, item in enumerate(users) if str(item.get("email", "")).strip().lower() == email), None)
    if user_index is None:
        return jsonify({"error": "User not found"}), 404

    users[user_index]["chat_last_seen_important_at"] = _now_iso()
    save_users(users)

    return jsonify({"ok": True})
