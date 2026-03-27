import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const PAGE_SIZE = 20;

export default function StudentsTable({ rows, loading = false }) {
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [sortKey, setSortKey] = useState("risk_probability");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return rows
      .filter((student) => {
        const matchesQuery =
          String(student.student_id).includes(query) ||
          student.name?.toLowerCase().includes(query.toLowerCase());
        const matchesRisk = riskFilter === "all" || student.risk_level === riskFilter;
        return matchesQuery && matchesRisk;
      })
      .sort((a, b) => {
        const factor = sortDir === "asc" ? 1 : -1;
        const av = a[sortKey] ?? 0;
        const bv = b[sortKey] ?? 0;
        if (typeof av === "string") return av.localeCompare(bv) * factor;
        return (Number(av) - Number(bv)) * factor;
      });
  }, [rows, query, riskFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  };

  const getEligibility = (student) => {
    const status = String(student?.scholarship_status || "").toLowerCase();
    if (status === "active" || status === "pending") return "Eligible";
    if (status === "expired" || status === "none") return "Not Eligible";

    const attendance = Number(student?.attendance_pct || 0);
    const marks = Number(student?.average_marks ?? student?.marks ?? 0);
    return attendance >= 60 && marks >= 50 ? "Eligible" : "Not Eligible";
  };

  const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;
  const formatMarks = (student) => Number(student?.average_marks ?? student?.marks ?? 0).toFixed(0);
  const sanitizeName = (name) =>
    String(name || "")
      .trim()
      .replace(/\s*\(\d+\)\s*$/, "")
      .replace(/\s+\d+\s*$/, "")
      .trim();
  const getStudentName = (student) => sanitizeName(student?.name) || `Student ${student?.student_id ?? "N/A"}`;

  return (
    <div className="glass-card p-5">
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <input
          className="input"
          placeholder="Search by ID or name"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input"
          value={riskFilter}
          onChange={(e) => {
            setRiskFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Risk Levels</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <button className="ghost-btn" onClick={() => updateSort("risk_probability")}>Sort by Risk</button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-base">
          <thead>
            <tr className="border-b border-slate-200/80 text-left text-slate-700 dark:border-white/20 dark:text-white">
              <th className="px-3 py-3">Student</th>
              <th className="px-3 py-3">Attendance</th>
              <th className="px-3 py-3">Marks</th>
              <th className="px-3 py-3 cursor-pointer" onClick={() => updateSort("risk_level")}>Risk Level</th>
              <th className="px-3 py-3">Eligible</th>
              <th className="px-3 py-3">Score</th>
              <th className="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-3 py-5 text-slate-500 dark:text-slate-300" colSpan={7}>Loading students...</td>
              </tr>
            )}
            {!loading && pageRows.length === 0 && (
              <tr>
                <td className="px-3 py-5 text-slate-400" colSpan={7}>No students found.</td>
              </tr>
            )}
            {pageRows.map((student) => (
              <tr key={student.student_id ?? student.name} className="border-b border-white/5">
                <td className="px-3 py-3">
                  <p className="font-semibold">{getStudentName(student)}</p>
                  <p className="text-xs text-slate-400">ID: {student.student_id ?? "N/A"}</p>
                </td>
                <td className="px-3 py-3">{formatPercent(student.attendance_pct)}</td>
                <td className="px-3 py-3">{formatMarks(student)}</td>
                <td className="px-3 py-3">{student.risk_level || "N/A"}</td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      getEligibility(student) === "Eligible"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                    }`}
                  >
                    {getEligibility(student)}
                  </span>
                </td>
                <td className="px-3 py-3">{Math.round((student.risk_probability || 0) * 100)}%</td>
                <td className="px-3 py-3">
                  {student.student_id ? (
                    <Link className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400" to={`/students/${student.student_id}`}>
                      View Detail
                    </Link>
                  ) : (
                    <span className="inline-flex items-center rounded-lg bg-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      Detail N/A
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button className="ghost-btn" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
            Prev
          </button>
          <button className="ghost-btn" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
