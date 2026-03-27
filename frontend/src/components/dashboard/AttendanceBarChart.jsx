import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function AttendanceBarChart({ data }) {
  const HIGH_ATTENDANCE_THRESHOLD = 75;
  const HIGH_MARKS_THRESHOLD = 75;
  const TOP_STUDENTS_LIMIT = 8;

  const rows = Array.isArray(data)
    ? data.map((item) => ({
        name: item?.name || "Student",
        attendance: Number(item?.attendance || 0),
        marks: Number(item?.marks || 0),
      }))
    : [];

  const highRows = rows.filter(
    (item) => item.attendance >= HIGH_ATTENDANCE_THRESHOLD && item.marks >= HIGH_MARKS_THRESHOLD
  );

  const rankedHighRows = [...highRows]
    .sort((a, b) => b.attendance + b.marks - (a.attendance + a.marks))
    .slice(0, TOP_STUDENTS_LIMIT);

  const fallbackRows = [...rows]
    .sort((a, b) => b.attendance + b.marks - (a.attendance + a.marks))
    .slice(0, TOP_STUDENTS_LIMIT);

  const displayRows = (() => {
    if (rankedHighRows.length >= TOP_STUDENTS_LIMIT) return rankedHighRows;

    const usedNames = new Set(rankedHighRows.map((item) => item.name));
    const fillers = fallbackRows.filter((item) => !usedNames.has(item.name));
    return [...rankedHighRows, ...fillers].slice(0, TOP_STUDENTS_LIMIT);
  })();

  const showingFallback = rankedHighRows.length < TOP_STUDENTS_LIMIT;
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const axisColor = isDark ? "#E2E8F0" : "#0f172a";
  const axisStroke = isDark ? "#94A3B8" : "#334155";
  const gridStroke = isDark ? "rgba(148, 163, 184, 0.22)" : "rgba(148, 163, 184, 0.15)";
  const primaryBar = isDark ? "#CBD5E1" : "#1E3A8A";
  const secondaryBar = isDark ? "#94A3B8" : "#DC2626";
  const chartBottomMargin = displayRows.length <= 1 ? 56 : 44;

  return (
    <div className="chart-card text-slate-900 dark:text-slate-100">
      <h3 className="section-title mb-3">Attendance vs Marks</h3>
      <p className="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">
        Showing top {TOP_STUDENTS_LIMIT} students by attendance + marks.
      </p>
      {displayRows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-white/20 dark:bg-slate-900 dark:text-white">
          Attendance and marks data are not available yet.
        </p>
      ) : (
        <>
          {showingFallback && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
              Showing high attendance ({HIGH_ATTENDANCE_THRESHOLD}%+) and high marks ({HIGH_MARKS_THRESHOLD}%+) first, then filling remaining slots with top available students.
            </p>
          )}
          <div className="h-72 rounded-xl border border-slate-200/80 bg-white/70 p-2 dark:border-white/15 dark:bg-slate-900">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayRows} margin={{ top: 18, right: 20, left: 8, bottom: chartBottomMargin }} barGap={8} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="name"
                  stroke={axisStroke}
                  tick={{ fontSize: 14, fontWeight: 800, fill: axisColor }}
                  tickMargin={14}
                  angle={0}
                  textAnchor="middle"
                  minTickGap={18}
                  tickFormatter={(name) => {
                    const trimmed = String(name).trim();
                    return trimmed.length > 10 ? `${trimmed.slice(0, 10)}…` : trimmed;
                  }}
                />
                <YAxis
                  stroke={axisStroke}
                  tick={{ fontSize: 14, fontWeight: 800, fill: axisColor }}
                  domain={[0, 100]}
                  label={{ value: "Score (%)", angle: -90, position: "insideLeft", fill: axisColor, fontSize: 14, fontWeight: 800 }}
                />
                <Tooltip
                  formatter={(value, name) => [`${Number(value).toFixed(0)}%`, name === "attendance" ? "Attendance" : "Marks"]}
                  contentStyle={{ backgroundColor: isDark ? "#0f172a" : "#ffffff", borderColor: isDark ? "#334155" : "#93C5FD", borderRadius: "10px" }}
                  labelStyle={{ color: isDark ? "#E2E8F0" : "#0f172a", fontWeight: 700 }}
                />
                <Legend verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: "14px", fontWeight: 800, color: axisColor, paddingTop: "10px" }} />
                <Bar dataKey="attendance" name="Attendance" fill={primaryBar} radius={[0, 0, 0, 0]} barSize={24}>
                  <LabelList dataKey="attendance" position="top" offset={8} fontSize={14} fill={axisColor} formatter={(value) => `${Number(value).toFixed(0)}%`} />
                </Bar>
                <Bar dataKey="marks" name="Marks" fill={secondaryBar} radius={[0, 0, 0, 0]} barSize={24}>
                  <LabelList dataKey="marks" position="top" offset={8} fontSize={14} fill={axisColor} formatter={(value) => `${Number(value).toFixed(0)}%`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 overflow-auto rounded-xl border border-slate-200 dark:border-white/20">
            <table className="min-w-full text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-800 dark:text-slate-100">Student</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-800 dark:text-slate-100">Attendance</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-800 dark:text-slate-100">Marks</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((item, index) => (
                  <tr key={`${item.name}-${index}`} className="border-t border-slate-200 dark:border-white/10">
                    <td className="px-3 py-2">{index + 1}. {item.name}</td>
                    <td className="px-3 py-2">{item.attendance.toFixed(0)}%</td>
                    <td className="px-3 py-2">{item.marks.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
