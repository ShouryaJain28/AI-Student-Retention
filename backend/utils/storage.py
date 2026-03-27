from __future__ import annotations
"""JSON file-based storage helpers for users and students.

Keeps persistence logic centralized so routes can focus on request handling.
"""

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
USERS_FILE = DATA_DIR / "users.json"
STUDENTS_FILE = DATA_DIR / "students.json"
CHAT_MESSAGES_FILE = DATA_DIR / "chat_messages.json"


def _ensure_data_file(path: Path, default_content: Any) -> None:
    # Create the data directory/file lazily for first run environments.
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(json.dumps(default_content, indent=2), encoding="utf-8")


def load_users() -> list[dict[str, Any]]:
    _ensure_data_file(USERS_FILE, [])
    return json.loads(USERS_FILE.read_text(encoding="utf-8"))


def save_users(users: list[dict[str, Any]]) -> None:
    _ensure_data_file(USERS_FILE, [])
    USERS_FILE.write_text(json.dumps(users, indent=2), encoding="utf-8")


def load_students() -> list[dict[str, Any]]:
    _ensure_data_file(STUDENTS_FILE, [])
    return json.loads(STUDENTS_FILE.read_text(encoding="utf-8"))


def save_students(students: list[dict[str, Any]]) -> None:
    _ensure_data_file(STUDENTS_FILE, [])
    STUDENTS_FILE.write_text(json.dumps(students, indent=2), encoding="utf-8")


def load_chat_messages() -> list[dict[str, Any]]:
    _ensure_data_file(CHAT_MESSAGES_FILE, [])
    return json.loads(CHAT_MESSAGES_FILE.read_text(encoding="utf-8"))


def save_chat_messages(messages: list[dict[str, Any]]) -> None:
    _ensure_data_file(CHAT_MESSAGES_FILE, [])
    CHAT_MESSAGES_FILE.write_text(json.dumps(messages, indent=2), encoding="utf-8")


def next_student_id(students: list[dict[str, Any]]) -> int:
    # Generate a monotonic numeric id from existing student records.
    if not students:
        return 1
    return max(int(student["student_id"]) for student in students) + 1
