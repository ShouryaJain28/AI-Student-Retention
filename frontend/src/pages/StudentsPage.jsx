import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../components/layout/AppShell";
import StudentsTable from "../components/students/StudentsTable";
import { studentsApi } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

const emptyForm = {
  name: "",
  attendance_pct: 70,
  marks: 65,
  behavior_score: 0.5,
  role: "student",
};

export default function StudentsPage() {
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const userEmail = String(user?.email || "").toLowerCase();
  const userStudentId = user?.student_id != null ? Number(user.student_id) : null;
  const cacheKey = `students_page_cache_${userRole || "unknown"}_${userEmail || "unknown"}`;
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const visibleStudents = useMemo(() => {
    if (userRole !== "student") return students;
    if (userStudentId == null) return students.slice(0, 1);
    return students.filter((item) => Number(item?.student_id) === userStudentId);
  }, [students, userRole, userStudentId]);

  const loadStudents = async (options = {}) => {
    const { silent = false } = options;
    if (!silent || students.length === 0) {
      setLoading(true);
    }
    setErrorMessage("");
    try {
      const res = await studentsApi.list({ lite: 1, _t: Date.now() });
      const rows = res.data.students || [];
      const nextNotifications = res.data.notifications || [];
      setStudents(rows);
      setNotifications(nextNotifications);
      sessionStorage.setItem(cacheKey, JSON.stringify({ students: rows, notifications: nextNotifications }));
    } catch (error) {
      const message = error?.response?.data?.error || "Failed to load students";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    sessionStorage.removeItem("students_page_cache");
    try {
      const cachedRaw = sessionStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        const cachedStudents = Array.isArray(cached?.students) ? cached.students : [];
        const cachedNotifications = Array.isArray(cached?.notifications) ? cached.notifications : [];
        const safeCachedStudents =
          userRole === "student" && userStudentId != null
            ? cachedStudents.filter((item) => Number(item?.student_id) === userStudentId)
            : cachedStudents;

        if (safeCachedStudents.length > 0) {
          setStudents(safeCachedStudents);
          setNotifications(cachedNotifications);
          setLoading(false);
        } else if (userRole !== "student" && cachedStudents.length > 0) {
          setStudents(cachedStudents);
          setNotifications(cachedNotifications);
          setLoading(false);
        }
      }
    } catch {
      // ignore cache parse failures
    }

    loadStudents({ silent: true });
  }, [cacheKey, userRole, userStudentId]);

  const submitManual = async (e) => {
    e.preventDefault();
    try {
      await studentsApi.create(form);
      toast.success("Student added");
      setForm(emptyForm);
      loadStudents();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to add student");
    }
  };

  const exportCsv = async () => {
    try {
      const res = await studentsApi.exportCsv();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "students_report.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("CSV exported");
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <AppShell notifications={notifications}>
      <div className="grid gap-4">
        <div className="space-y-3">
          {errorMessage && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              {errorMessage}. Ensure backend is running, then click retry.
              <button className="ghost-btn mt-2" onClick={loadStudents} type="button">Retry</button>
            </div>
          )}
          <StudentsTable rows={visibleStudents} loading={loading} />
        </div>

        {/* Student MCQ section only for students */}
        {userRole === "student" && (
          <section className="glass-card p-5">
            <h3 className="section-title">Student MCQs (Quick Check)</h3>
            <p className="section-description mt-1">Short MCQs to reinforce retention and intervention best practices.</p>
            <ul className="mt-4 space-y-4">
              <li>
                <strong>Q1.</strong> If attendance drops below 60%, what should be the first action?
                <ul className="ml-4 mt-1 list-disc">
                  <li>Ignore for one month</li>
                  <li><strong>Plan immediate mentor/counselor follow-up</strong></li>
                  <li>Only send exam timetable</li>
                  <li>Wait for semester end</li>
                </ul>
              </li>
              <li>
                <strong>Q2.</strong> Which habit most improves long-term retention?
                <ul className="ml-4 mt-1 list-disc">
                  <li>Passive re-reading only</li>
                  <li><strong>Active recall and spaced repetition</strong></li>
                  <li>Studying only before exams</li>
                  <li>Skipping revision</li>
                </ul>
              </li>
              <li>
                <strong>Q3.</strong> For a student with similar attendance and performance data, the strongest current focus area is:
                <ul className="ml-4 mt-1 list-disc">
                  <li>No intervention required</li>
                  <li><strong>Attendance, academic recovery, and stress support</strong></li>
                  <li>Only extracurricular activity</li>
                  <li>Reduce counselor engagement</li>
                </ul>
              </li>
            </ul>
          </section>
        )}

        {/* For teachers/admins, always show add student form and table */}
        {(userRole === "teacher" || userRole === "admin") && (
          <aside className="glass-card p-4">
            <h3 className="text-sm font-semibold">Add Student Manually</h3>
            <form className="mt-3 space-y-2" onSubmit={submitManual}>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="manual-student-name">Name</label>
              <input id="manual-student-name" className="input" placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="manual-student-attendance">Attendance %</label>
              <input id="manual-student-attendance" className="input" type="number" min="0" max="100" placeholder="Attendance %" value={form.attendance_pct} onChange={(e) => setForm((p) => ({ ...p, attendance_pct: Number(e.target.value) }))} required />
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="manual-student-marks">Average Marks</label>
              <input id="manual-student-marks" className="input" type="number" min="0" max="100" placeholder="Average Marks" value={form.marks} onChange={(e) => setForm((p) => ({ ...p, marks: Number(e.target.value) }))} required />
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="manual-student-behavior">Behavior Score</label>
              <input id="manual-student-behavior" className="input" type="number" min="0" max="1" step="0.01" placeholder="Behavior Score" value={form.behavior_score} onChange={(e) => setForm((p) => ({ ...p, behavior_score: Number(e.target.value) }))} required />
              <button className="primary-btn w-full" type="submit">Save Student</button>
            </form>

            <button className="ghost-btn mt-3 w-full" onClick={exportCsv}>Export Report CSV</button>
          </aside>
        )}
      </div>
    </AppShell>
  );
}
