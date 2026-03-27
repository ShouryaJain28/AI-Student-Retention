from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression


@dataclass
class PredictionResult:
    risk_level: str
    probability: float
    recommendation: str


class StudentRiskModel:
    def __init__(self) -> None:
        self.logistic_model = LogisticRegression(max_iter=400)
        self.forest_model = RandomForestClassifier(
            n_estimators=140,
            max_depth=6,
            random_state=42,
        )
        self._fit()

    def _fit(self) -> None:
        rng = np.random.default_rng(42)
        attendance = rng.uniform(35, 99, 1200)
        marks = rng.uniform(30, 98, 1200)
        behavior = rng.uniform(0.1, 1.0, 1200)

        risk_score = (
            (100 - attendance) * 0.45
            + (100 - marks) * 0.35
            + (1 - behavior) * 100 * 0.2
        )
        labels = (risk_score > 45).astype(int)

        x = np.vstack([attendance, marks, behavior]).T

        self.logistic_model.fit(x, labels)
        self.forest_model.fit(x, labels)

    def predict(self, attendance_pct: float, marks: float, behavior_score: float) -> PredictionResult:
        sample = np.array([[attendance_pct, marks, behavior_score]])
        probability = float(self.forest_model.predict_proba(sample)[0][1])

        if probability >= 0.7:
            risk_level = "High"
            recommendation = "Urgent 1:1 mentoring and parent engagement within 48 hours"
        elif probability >= 0.4:
            risk_level = "Medium"
            recommendation = "Weekly check-ins, tutoring, and attendance follow-up"
        else:
            risk_level = "Low"
            recommendation = "Continue current support and monthly monitoring"

        return PredictionResult(
            risk_level=risk_level,
            probability=round(probability, 4),
            recommendation=recommendation,
        )
