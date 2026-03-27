import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import AppShell from "../components/layout/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { predictionApi, studentsApi } from "../api/client";

export default function StudentDetailPage() {
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  const loadStudent = async () => {
    try {
      const res = await studentsApi.getById(studentId);
      setStudent(res.data.student);
      setPrediction(res.data.prediction || null);
    } catch {
      toast.error("Unable to load student details");
    }
  };

  useEffect(() => {
    loadStudent();
  }, [studentId]);

  const runPrediction = async () => {
    if (!student) return;
    try {
      const res = await predictionApi.predict(student);
      setPrediction(res.data);
      toast.success("Prediction updated");
    } catch {
      toast.error("Prediction failed");
    }
  };

  const displayName = String(student?.name || "").trim() || `Student ${student?.student_id ?? "N/A"}`;
  const displayAttendance = Math.round(Number(student?.attendance_pct ?? student?.attendance ?? 0));
  const displayMarks = Number(student?.average_marks ?? student?.marks ?? 0).toFixed(0);
  const displayBehavior = Number(student?.behavior_score ?? student?.behavior ?? 0.5).toFixed(2);
  const displayProbability = Math.round(Number(prediction?.probability || 0) * 100);

  const mcqQuestions = student
    ? [
        {
          id: "q1",
          question: "If attendance drops below 60%, what should be the first action?",
          options: ["Ignore for one month", "Plan immediate mentor/counselor follow-up", "Only send exam timetable", "Wait for semester end"],
          correct: 1,
        },
        {
          id: "q2",
          question: "Which habit most improves long-term retention?",
          options: ["Passive re-reading only", "Active recall and spaced repetition", "Studying only before exams", "Skipping revision"],
          correct: 1,
        },
        {
          id: "q3",
          question: `For ${displayName}, the strongest current focus area is:`,
          options: [
            "No intervention required",
            prediction?.risk_level?.toLowerCase() === "low" ? "Maintain current consistency" : "Attendance, academic recovery, and stress support",
            "Only extracurricular activity",
            "Reduce counselor engagement",
          ],
          correct: 1,
        },
      ]
    : [];

  const mcqScore = mcqQuestions.reduce((score, item) => (answers[item.id] === item.correct ? score + 1 : score), 0);
  const answeredCount = mcqQuestions.reduce((count, item) => (answers[item.id] !== undefined ? count + 1 : count), 0);
  const allAnswered = mcqQuestions.length > 0 && answeredCount === mcqQuestions.length;

  return (
    <AppShell notifications={[]}> 
      {!student ? (
        <div className="skeleton h-64 rounded-2xl" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="glass-card p-5">
            <h3 className="text-lg font-semibold">Student Profile</h3>
            <div className="mt-3 space-y-2 text-sm">
              <p><span className="text-slate-500 dark:text-slate-300">ID:</span> {student.student_id ?? "N/A"}</p>
              <p><span className="text-slate-500 dark:text-slate-300">Name:</span> {displayName}</p>
              <p><span className="text-slate-500 dark:text-slate-300">Attendance:</span> {displayAttendance}%</p>
              <p><span className="text-slate-500 dark:text-slate-300">Marks:</span> {displayMarks}</p>
              <p><span className="text-slate-500 dark:text-slate-300">Behavior Score:</span> {displayBehavior}</p>
            </div>
            <button className="primary-btn mt-4" onClick={runPrediction}>Re-run AI Prediction</button>
          </section>

          {/* Only show Risk Insight and MCQ for students */}
          {userRole === "student" && (
            <>
              <section className="glass-card p-5">
                <h3 className="text-lg font-semibold">Risk Insight</h3>
                {!prediction ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Run prediction to generate risk insight.</p>
                ) : (
                  <div className="mt-3 space-y-2 text-sm">
                    <p><span className="text-slate-500 dark:text-slate-300">Risk Level:</span> {prediction.risk_level || "N/A"}</p>
                    <p><span className="text-slate-500 dark:text-slate-300">Probability:</span> {displayProbability}%</p>
                    <p><span className="text-slate-500 dark:text-slate-300">Action:</span> {prediction.recommendation || "No recommendation available"}</p>
                  </div>
                )}
              </section>

              <section className="glass-card p-5 lg:col-span-2">
                <h3 className="section-title">Student MCQs (Quick Check)</h3>
                <p className="section-description mt-1">Short MCQs to reinforce retention and intervention best practices.</p>
                <div className="mt-4 space-y-4">
                  {mcqQuestions.map((item, index) => (
                    <div key={item.id} className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-700/70">
                      <p className="text-base font-semibold">Q{index + 1}. {item.question}</p>
                      <div className="mt-2 grid gap-2">
                        {item.options.map((option, optionIndex) => {
                          const isSelected = answers[item.id] === optionIndex;
                          const isCorrect = submitted && reviewMode && optionIndex === item.correct;
                          const isWrongSelected = submitted && reviewMode && isSelected && optionIndex !== item.correct;
                          const tone = isCorrect
                            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                            : isWrongSelected
                            ? "border-red-400 bg-red-50 dark:bg-red-500/10"
                            : isSelected
                              ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10"
                              : "border-slate-300 dark:border-slate-600";

                          return (
                            <button
                              key={optionIndex}
                              type="button"
                              onClick={() => {
                                if (!submitted) setAnswers((prev) => ({ ...prev, [item.id]: optionIndex }));
                              }}
                              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-base ${tone} ${submitted ? "cursor-default" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                            >
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-bold ${
                                  isSelected
                                    ? "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-400 dark:text-slate-900"
                                    : "border-slate-400 text-transparent"
                                }`}
                              >
                                ✓
                              </span>
                              <span>{option}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {!submitted ? (
                    <>
                      <button className="primary-btn" onClick={() => setSubmitted(true)} disabled={!allAnswered}>
                        Submit MCQ
                      </button>
                      {allAnswered && (
                        <button className="ghost-btn" onClick={() => setReviewMode((prev) => !prev)}>
                          {reviewMode ? "Hide Review" : "Review Selection"}
                        </button>
                      )}
                      {!allAnswered && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Tick one option for each question to enable Submit and Review.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-base font-semibold">Score: {mcqScore}/{mcqQuestions.length}</p>
                      <button className="ghost-btn" onClick={() => setReviewMode((prev) => !prev)}>
                        {reviewMode ? "Hide Review" : "Review Answers"}
                      </button>
                      <button
                        className="ghost-btn"
                        onClick={() => {
                          setAnswers({});
                          setSubmitted(false);
                          setReviewMode(false);
                        }}
                      >
                        Reset
                      </button>
                    </>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
// ...existing code...
}
