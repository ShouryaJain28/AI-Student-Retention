from __future__ import annotations

from io import StringIO
from collections import Counter
import math
from typing import Any

import pandas as pd
from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from ..utils.authz import get_current_role, resolve_current_student, role_required
from ..utils.storage import load_students, next_student_id, save_students

students_bp = Blueprint("students", __name__)

DEFAULT_STUDENT_FIELDS: dict[str, Any] = {
    "semester": 1,
    "attendance_trend": "stable",
    "consecutive_absences": 0,
    "subjects": {"math": 0, "dbms": 0, "os": 0},
    "backlogs": 0,
    "performance_trend": "stable",
    "assignment_submission_rate": 0.0,
    "portal_login_frequency": 0,
    "time_spent_on_platform": 0,
    "stress_level": "medium",
    "counselor_visits": 0,
    "family_income_range": "medium",
    "scholarship_status": "none",
    "scholarship_type": "none",
    "scholarship_amount": 0,
    "scholarship_at_risk": False,
    "previously_lost": False,
    "hostel": False,
    "works_part_time": False,
    "program_satisfaction_score": 3.0,
    "first_generation_student": False,
    "previous_sem_risk": "low",
}


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
        if pd.isna(number):
            return default
        return number
    except Exception:
        return default


def _pick_value(source: dict[str, Any], keys: list[str], default: Any = None) -> Any:
    for key in keys:
        if key in source and source[key] is not None and str(source[key]).strip() != "":
            return source[key]
    return default


def _normalize_existing_students(students: list[dict[str, Any]], model: Any) -> tuple[list[dict[str, Any]], bool]:
    changed = False
    normalized: list[dict[str, Any]] = []
    name_counts: Counter[str] = Counter()

    for student in students:
        needs_prediction_refresh = (
            student.get("risk_level") in (None, "")
            or student.get("risk_probability") in (None, "")
            or student.get("recommendation") in (None, "")
            or student.get("average_marks") is None
            or student.get("attendance_pct") is None
            or student.get("behavior_score") is None
        )

        enriched = _enrich_student(model, student) if needs_prediction_refresh else {
            "attendance_pct": round(_safe_float(student.get("attendance_pct"), 0), 2),
            "average_marks": round(_safe_float(student.get("average_marks", student.get("marks", 0)), 0), 2),
            "behavior_score": round(_safe_float(student.get("behavior_score"), 0.5), 2),
            "risk_level": student.get("risk_level"),
            "risk_probability": _safe_float(student.get("risk_probability"), 0),
            "recommendation": student.get("recommendation") or "Continue current support and monthly monitoring",
        }
        student_id = int(_pick_value(student, ["student_id"], next_student_id(normalized)))
        base_name = str(student.get("name") or f"Student {student_id}").strip()
        normalized_name_key = base_name.lower()
        name_counts[normalized_name_key] += 1
        unique_name = base_name if name_counts[normalized_name_key] == 1 else f"{base_name} ({student_id})"

        subjects = student.get("subjects") if isinstance(student.get("subjects"), dict) else {}
        merged_subjects = {
            "math": int(_safe_float(subjects.get("math", 0), 0)),
            "dbms": int(_safe_float(subjects.get("dbms", 0), 0)),
            "os": int(_safe_float(subjects.get("os", 0), 0)),
        }

        merged = {
            "student_id": student_id,
            "name": unique_name,
            **DEFAULT_STUDENT_FIELDS,
            **student,
            "subjects": merged_subjects,
            "attendance_pct": enriched["attendance_pct"],
            "average_marks": enriched["average_marks"],
            "behavior_score": enriched["behavior_score"],
            "risk_level": enriched["risk_level"],
            "risk_probability": enriched["risk_probability"],
            "recommendation": enriched["recommendation"],
        }
        merged.pop("marks", None)

        if (
            student.get("average_marks") != merged.get("average_marks")
            or student.get("risk_probability") != merged.get("risk_probability")
            or student.get("name") != merged.get("name")
            or "marks" in student
            or needs_prediction_refresh
        ):
            changed = True

        normalized.append(merged)

    return normalized, changed


def _enrich_student(model: Any, payload: dict[str, Any]) -> dict[str, Any]:
    attendance_pct = _safe_float(_pick_value(payload, ["attendance_pct", "attendance", "attendance_percent"], 0), 0)
    marks = _safe_float(
        _pick_value(
            payload,
            [
                "average_marks",
                "marks",
                "grade_avg",
                "grade_average",
                "avg_marks",
                "score",
            ],
            0,
        ),
        0,
    )
    behavior_score = _safe_float(_pick_value(payload, ["behavior_score", "behavior", "discipline_score"], 0.5), 0.5)

    attendance_pct = max(0.0, min(100.0, attendance_pct))
    marks = max(0.0, min(100.0, marks))
    behavior_score = max(0.0, min(1.0, behavior_score))

    prediction = model.predict(attendance_pct=attendance_pct, marks=marks, behavior_score=behavior_score)

    return {
        **payload,
        "attendance_pct": round(attendance_pct, 2),
        "average_marks": round(marks, 2),
        "behavior_score": round(behavior_score, 2),
        "risk_level": prediction.risk_level,
        "risk_probability": prediction.probability,
        "recommendation": prediction.recommendation,
    }


def _to_json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _to_json_safe(val) for key, val in value.items()}
    if isinstance(value, list):
        return [_to_json_safe(item) for item in value]
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


@students_bp.get("/students")
@jwt_required()
def list_students() -> Any:
    students = load_students()
    role = get_current_role()

    if role == "student":
        current_student = resolve_current_student(students)
        students = [current_student] if current_student else []

    if request.args.get("lite") == "1":
        lite_students = [
            {
                "student_id": int(_pick_value(student, ["student_id"], idx + 1)),
                "name": str(student.get("name") or f"Student {idx + 1}").strip(),
                "attendance_pct": round(_safe_float(student.get("attendance_pct", student.get("attendance", 0)), 0), 2),
                "average_marks": round(_safe_float(student.get("average_marks", student.get("marks", 0)), 0), 2),
                "behavior_score": round(_safe_float(student.get("behavior_score", student.get("behavior", 0.5)), 0.5), 2),
                "risk_level": student.get("risk_level"),
                "risk_probability": _safe_float(student.get("risk_probability"), 0),
                "recommendation": student.get("recommendation") or "Continue current support and monthly monitoring",
                "scholarship_status": student.get("scholarship_status", "none"),
                "scholarship_type": student.get("scholarship_type", "none"),
                "scholarship_amount": _safe_float(student.get("scholarship_amount"), 0),
                "scholarship_at_risk": bool(student.get("scholarship_at_risk", False)),
            }
            for idx, student in enumerate(students)
        ]

        lite_notifications = [
            {
                "id": f"lite-{int(_pick_value(student, ['student_id'], idx + 1))}",
                "title": f"Student {str(student.get('name') or f'Student {idx + 1}').strip()}",
                "severity": str(student.get("risk_level") or "low").lower(),
                "message": student.get("recommendation") or "Continue current support and monthly monitoring",
            }
            for idx, student in enumerate(students)
            if str(student.get("risk_level") or "").lower() in {"high", "medium"}
        ][:10]

        response = jsonify({"students": _to_json_safe(lite_students), "notifications": _to_json_safe(lite_notifications)})
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        return response

    model = current_app.config["risk_model"]
    students, changed = _normalize_existing_students(students, model)
    if changed:
        save_students(students)

    notifications = [
        {
            "id": f"high-{student['student_id']}",
            "title": f"High-risk: {student.get('name', student['student_id'])}",
            "severity": "high",
            "message": student.get("recommendation", "Needs intervention"),
        }
        for student in students
        if student.get("risk_level") == "High"
    ][:10]

    response = jsonify({"students": _to_json_safe(students), "notifications": _to_json_safe(notifications)})
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return response


@students_bp.get("/students/<int:student_id>")
@jwt_required()
def get_student(student_id: int) -> Any:
    students = load_students()
    role = get_current_role()

    if role == "student":
        current_student = resolve_current_student(students)
        if not current_student:
            return jsonify({"error": "Student not found"}), 404
        if int(current_student.get("student_id", -1)) != int(student_id):
            return jsonify({"error": "Forbidden for this student"}), 403

    model = current_app.config["risk_model"]
    students, changed = _normalize_existing_students(students, model)
    if changed:
        save_students(students)

    student = next((item for item in students if int(item["student_id"]) == student_id), None)
    if not student:
        return jsonify({"error": "Student not found"}), 404

    return jsonify(
        {
            "student": _to_json_safe(student),
            "prediction": {
                "risk_level": student.get("risk_level"),
                "probability": student.get("risk_probability"),
                "recommendation": student.get("recommendation"),
            },
        }
    )


@students_bp.post("/students")
@jwt_required()
@role_required("admin", "teacher")
def create_student() -> Any:
    payload = request.get_json(silent=True) or {}
    students = load_students()
    model = current_app.config["risk_model"]

    student = _enrich_student(model, payload)
    student["student_id"] = int(payload.get("student_id") or next_student_id(students))
    student["name"] = str(payload.get("name", f"Student {student['student_id']}"))
    student = {**DEFAULT_STUDENT_FIELDS, **student}
    student["subjects"] = student.get("subjects") if isinstance(student.get("subjects"), dict) else {"math": 0, "dbms": 0, "os": 0}
    student.pop("marks", None)

    students.append(student)
    save_students(students)
    return jsonify({"student": student, "ok": True})


@students_bp.post("/upload-csv")
@jwt_required()
@role_required("admin", "teacher")
def upload_csv() -> Any:
    if "file" not in request.files:
        return jsonify({"error": "CSV file is required"}), 400

    file = request.files["file"]
    try:
        df = pd.read_csv(file)
    except Exception:
        return jsonify({"error": "Invalid CSV"}), 400

    df.columns = [str(col).strip().lower() for col in df.columns]

    alias_map = {
        "name": ["name", "student_name", "full_name"],
        "attendance_pct": ["attendance_pct", "attendance", "attendance_percent"],
        "marks": ["marks", "average_marks", "avg_marks", "grade_avg", "score"],
        "behavior_score": ["behavior_score", "behavior", "discipline_score"],
    }

    selected_cols: dict[str, str] = {}
    for canonical, aliases in alias_map.items():
        match = next((alias for alias in aliases if alias in df.columns), None)
        if match:
            selected_cols[canonical] = match

    if set(selected_cols.keys()) != {"name", "attendance_pct", "marks", "behavior_score"}:
        return jsonify(
            {
                "error": "CSV missing required columns.",
                "expected": {
                    "name": alias_map["name"],
                    "attendance_pct": alias_map["attendance_pct"],
                    "marks": alias_map["marks"],
                    "behavior_score": alias_map["behavior_score"],
                },
            }
        ), 400

    model = current_app.config["risk_model"]
    students = load_students()
    current_id = next_student_id(students)
    added = 0
    skipped = 0
    skipped_rows: list[int] = []

    for _, row in df.iterrows():
        try:
            student = _enrich_student(
                model,
                {
                    "name": str(row[selected_cols["name"]]).strip(),
                    "attendance_pct": row[selected_cols["attendance_pct"]],
                    "marks": row[selected_cols["marks"]],
                    "behavior_score": row[selected_cols["behavior_score"]],
                },
            )
            if not student["name"]:
                raise ValueError("Missing name")
            student["student_id"] = current_id
            student = {**DEFAULT_STUDENT_FIELDS, **student}
            student["subjects"] = student.get("subjects") if isinstance(student.get("subjects"), dict) else {"math": 0, "dbms": 0, "os": 0}
            student.pop("marks", None)
            current_id += 1
            students.append(student)
            added += 1
        except Exception:
            skipped += 1
            skipped_rows.append(int(_) + 2)

    save_students(students)

    return jsonify(
        {
            "rows_processed": int(len(df)),
            "added": added,
            "skipped": skipped,
            "skipped_rows": skipped_rows[:15],
            "message": "CSV uploaded successfully",
        }
    )


@students_bp.get("/students/export")
@jwt_required()
def export_students() -> Any:
    students = load_students()
    role = get_current_role()

    if role == "student":
        current_student = resolve_current_student(students)
        students = [current_student] if current_student else []

    if not students:
        return Response("", mimetype="text/csv")

    df = pd.DataFrame(students)
    csv_buffer = StringIO()
    df.to_csv(csv_buffer, index=False)

    return Response(
        csv_buffer.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=students_report.csv"},
    )
