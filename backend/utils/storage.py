from __future__ import annotations
"""JSON file-based storage helpers for users and students.

Keeps persistence logic centralized so routes can focus on request handling.
"""

import json
from datetime import datetime
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


def _write_json_atomic(path: Path, payload: Any) -> None:
    _ensure_data_file(path, [] if isinstance(payload, list) else {})
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    temp_path.replace(path)


def _backup_corrupted_file(path: Path) -> None:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = path.with_suffix(path.suffix + f".corrupt-{timestamp}")
    try:
        path.replace(backup_path)
    except Exception:
        # If backup move fails, keep original file untouched.
        return


def _recover_list_prefix(raw_text: str) -> list[dict[str, Any]]:
    decoder = json.JSONDecoder()
    start = raw_text.find("[")
    if start == -1:
        return []

    idx = start + 1
    recovered: list[dict[str, Any]] = []

    while idx < len(raw_text):
        while idx < len(raw_text) and raw_text[idx] in {" ", "\n", "\r", "\t", ","}:
            idx += 1

        if idx >= len(raw_text) or raw_text[idx] == "]":
            break

        try:
            value, end = decoder.raw_decode(raw_text, idx)
        except json.JSONDecodeError:
            break

        if isinstance(value, dict):
            recovered.append(value)
        idx = end

    return recovered


def _load_list_with_recovery(path: Path) -> list[dict[str, Any]]:
    _ensure_data_file(path, [])
    raw_text = path.read_text(encoding="utf-8")

    try:
        data = json.loads(raw_text)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        recovered = _recover_list_prefix(raw_text)
        _backup_corrupted_file(path)
        _write_json_atomic(path, recovered)
        return recovered


def load_users() -> list[dict[str, Any]]:
    return _load_list_with_recovery(USERS_FILE)


def save_users(users: list[dict[str, Any]]) -> None:
    _write_json_atomic(USERS_FILE, users)


def load_students() -> list[dict[str, Any]]:
    return _load_list_with_recovery(STUDENTS_FILE)


def save_students(students: list[dict[str, Any]]) -> None:
    _write_json_atomic(STUDENTS_FILE, students)


def load_chat_messages() -> list[dict[str, Any]]:
    return _load_list_with_recovery(CHAT_MESSAGES_FILE)


def save_chat_messages(messages: list[dict[str, Any]]) -> None:
    _write_json_atomic(CHAT_MESSAGES_FILE, messages)


def next_student_id(students: list[dict[str, Any]]) -> int:
    # Generate a monotonic numeric id from existing student records.
    if not students:
        return 1
    return max(int(student["student_id"]) for student in students) + 1
