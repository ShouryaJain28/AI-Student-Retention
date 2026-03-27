import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../components/layout/AppShell";
import { studentsApi } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { getScholarshipRecommendations, SCHOLARSHIP_SCHEMES } from "../utils/scholarshipRecommendation";

export default function ScholarshipPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cacheKey = "scholarship_students_cache";

    try {
      const cachedRaw = sessionStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        const cachedRows = Array.isArray(cached?.students) ? cached.students : [];
        const cachedNotifications = Array.isArray(cached?.notifications) ? cached.notifications : [];
        if (cachedRows.length > 0) {
          setStudents(cachedRows);
          setNotifications(cachedNotifications);
          setSelectedStudentId((prev) => prev ?? cachedRows[0].student_id);
          setLoading(false);
        }
      }
    } catch {
      // ignore cache errors
    }

    const load = async () => {
      try {
        const res = await studentsApi.list({ lite: 1, _t: Date.now() });
        const rows = res.data.students || [];
        setStudents(rows);
        setNotifications(res.data.notifications || []);
        sessionStorage.setItem(cacheKey, JSON.stringify({ students: rows, notifications: res.data.notifications || [] }));
        if (rows.length > 0) {
          setSelectedStudentId((prev) => prev ?? rows[0].student_id);
        }
      } catch (error) {
        toast.error(error?.response?.data?.error || "Failed to load scholarship details");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const activeStudent = useMemo(() => {
    if (students.length === 0) return null;
    if (user?.role === "student") return students[0] || null;
    return students.find((student) => Number(student.student_id) === Number(selectedStudentId)) || students[0] || null;
  }, [students, selectedStudentId, user?.role]);

  const scholarshipPack = useMemo(
    () => (activeStudent ? getScholarshipRecommendations(activeStudent) : { recommended: [], applySteps: [], topScore: 0 }),
    [activeStudent]
  );

  return (
    <AppShell notifications={notifications}>
      <div className="space-y-4">
        <section className="glass-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="section-title">Scholarship Detail</h3>
              <p className="section-description mt-1">
                Scholarship recommendations and eligibility prediction based on student profile.
              </p>
            </div>
            {user?.role !== "student" && (
              <select
                className="input max-w-sm"
                value={selectedStudentId ?? ""}
                onChange={(e) => setSelectedStudentId(Number(e.target.value))}
              >
                {students.map((student) => (
                  <option key={student.student_id} value={student.student_id}>
                    {student.name} (ID: {student.student_id})
                  </option>
                ))}
              </select>
            )}
          </div>
        </section>

        {loading ? (
          <div className="glass-card p-6 text-base font-semibold text-slate-700 dark:text-slate-200">Loading scholarship details...</div>
        ) : !activeStudent ? (
          <div className="glass-card p-6 text-sm text-slate-600 dark:text-slate-300">No student data available.</div>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-4">
              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold text-slate-500">Student</h4>
                <p className="mt-2 text-base font-semibold">{activeStudent.name}</p>
                <p className="text-sm text-slate-500">ID: {activeStudent.student_id}</p>
              </div>
              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold text-slate-500">Scholarship Status</h4>
                <p className="mt-2 text-base font-semibold">{activeStudent.scholarship_status || "unknown"}</p>
                <p className="text-sm text-slate-500">Type: {activeStudent.scholarship_type || "none"}</p>
              </div>
              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold text-slate-500">Current Amount</h4>
                <p className="mt-2 text-base font-semibold">₹{Number(activeStudent.scholarship_amount || 0).toLocaleString("en-IN")}</p>
                <p className="text-sm text-slate-500">At risk: {activeStudent.scholarship_at_risk ? "Yes" : "No"}</p>
              </div>
              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold text-slate-500">Eligibility Prediction</h4>
                <p className="mt-2 text-base font-semibold">{scholarshipPack.topScore}%</p>
                <p className="text-sm text-slate-500">Based on income + marks + risk profile</p>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <div className="glass-card p-4">
                <h3 className="section-title">Recommended Scholarships</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-slate-500 dark:text-slate-300">
                      <tr>
                        <th className="px-2 py-2">Name</th>
                        <th className="px-2 py-2">Amount</th>
                        <th className="px-2 py-2">Deadline</th>
                        <th className="px-2 py-2">Eligible</th>
                        <th className="px-2 py-2">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scholarshipPack.recommended.map((scheme) => (
                        <tr key={scheme.id} className="border-t border-slate-200 dark:border-slate-700">
                          <td className="px-2 py-2">
                            <p className="font-semibold">{scheme.name}</p>
                            <p className="text-xs text-slate-500">{scheme.provider}</p>
                          </td>
                          <td className="px-2 py-2">{scheme.amount}</td>
                          <td className="px-2 py-2">{scheme.deadline}</td>
                          <td className="px-2 py-2">{scheme.eligible ? "Yes" : "No"}</td>
                          <td className="px-2 py-2 font-semibold">{scheme.score}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass-card p-4">
                <h3 className="section-title">How to Apply</h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
                  {scholarshipPack.applySteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
                <div className="mt-4 space-y-2 text-sm">
                  {scholarshipPack.recommended.slice(0, 3).map((scheme) => (
                    <a
                      key={scheme.id}
                      href={scheme.applyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-slate-200 px-3 py-2 text-blue-600 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800"
                    >
                      Apply: {scheme.name}
                    </a>
                  ))}
                </div>
              </div>
            </section>

            <section className="glass-card p-4">
              <h3 className="section-title">Scholarship Schemes (India)</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {SCHOLARSHIP_SCHEMES.map((scheme) => (
                  <article key={scheme.id} className="rounded-xl border border-slate-200/80 bg-white/60 p-3 dark:border-slate-700/70 dark:bg-slate-900/40">
                    <h4 className="text-sm font-semibold">{scheme.name}</h4>
                    <p className="mt-1 text-xs text-slate-500">{scheme.provider}</p>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Category: {scheme.category}</p>
                    <a href={scheme.applyUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-blue-600 dark:text-blue-300">
                      {scheme.applyUrl}
                    </a>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}