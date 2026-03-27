import { CartesianGrid, LabelList, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function PerformanceLineChart({ data }) {
  const trendData = Array.isArray(data)
    ? data.map((item) => ({
        month: item?.month || "-",
        marks: Number(item?.marks || 0),
      }))
    : [];

  const avgMarks = trendData.length > 0 ? trendData.reduce((sum, item) => sum + item.marks, 0) / trendData.length : 0;
  const stdDeviation =
    trendData.length > 0
      ? Math.sqrt(trendData.reduce((sum, item) => sum + (item.marks - avgMarks) ** 2, 0) / trendData.length)
      : 0;
  const cl = Number(avgMarks.toFixed(2));
  const ucl = Number(Math.min(100, avgMarks + stdDeviation * 1.5).toFixed(2));
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const axisColor = isDark ? "#E2E8F0" : "#0f172a";
  const axisStroke = isDark ? "#94A3B8" : "#64748b";
  const gridStroke = isDark ? "rgba(148, 163, 184, 0.22)" : "rgba(148, 163, 184, 0.15)";
  const lineStroke = isDark ? "#CBD5E1" : "#1E3A8A";
  const secondaryStroke = isDark ? "#94A3B8" : "#334155";

  const getTrendColor = (index) => {
    if (isDark) return lineStroke;
    if (index === 0) return "#2563EB";
    const prev = Number(trendData[index - 1]?.marks) || 0;
    const current = Number(trendData[index]?.marks) || 0;
    if (current > prev) return "#16A34A";
    if (current < prev) return "#0F172A";
    return "#2563EB";
  };

  const renderDot = ({ cx, cy, index }) => {
    if (typeof cx !== "number" || typeof cy !== "number") return null;
    return <circle cx={cx} cy={cy} r={5.5} fill={getTrendColor(index)} stroke={axisColor} strokeWidth={1.2} />;
  };

  const renderValueLabel = ({ x, y, value, index }) => {
    if (typeof x !== "number" || typeof y !== "number") return null;
    return (
      <text x={x} y={y - 14} fontSize={16} fontWeight={800} fill={isDark ? axisColor : "#0f172a"} textAnchor="middle">
        {`${Math.round(Number(value) || 0)}%`}
      </text>
    );
  };

  return (
    <div className="chart-card text-slate-900 dark:text-slate-100">
      <h3 className="section-title mb-3">Monthly Trend Chart</h3>
      <p className="mb-2 text-base text-slate-700 dark:text-slate-200">Trend with center line (CL) and upper control line (UCL).</p>
      <div className="h-72 rounded-xl border border-slate-200/80 bg-white/70 p-2 dark:border-white/15 dark:bg-slate-900">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ top: 12, right: 20, left: 4, bottom: 4 }}>
            {!isDark && (
              <defs>
                <linearGradient id="trendStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="50%" stopColor="#16A34A" />
                  <stop offset="100%" stopColor="#0F172A" />
                </linearGradient>
              </defs>
            )}
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="month" stroke={axisStroke} tick={{ fontSize: 17, fontWeight: 800, fill: axisColor }} tickMargin={8} />
            <YAxis stroke={axisStroke} tick={{ fontSize: 17, fontWeight: 800, fill: axisColor }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} width={56} />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(1)}%`, "Avg Marks"]}
              contentStyle={{ fontSize: "14px", borderRadius: "10px", backgroundColor: isDark ? "#0f172a" : "#ffffff", borderColor: isDark ? "#334155" : "#cbd5e1" }}
              labelStyle={{ fontSize: "14px", fontWeight: 700, color: axisColor }}
            />
            <Legend wrapperStyle={{ fontSize: "16px", fontWeight: 800, color: axisColor }} />
            <ReferenceLine
              y={ucl}
              stroke={isDark ? lineStroke : "#1E3A8A"}
              strokeDasharray="4 4"
              label={{ value: `UCL ${ucl}%`, position: "right", fill: axisColor, fontSize: 13, fontWeight: 700 }}
            />
            <ReferenceLine
              y={cl}
              stroke={secondaryStroke}
              strokeDasharray="4 4"
              label={{ value: `CL ${cl}%`, position: "right", fill: axisColor, fontSize: 13, fontWeight: 700 }}
            />
            <Line
              type="natural"
              dataKey="marks"
              name="Avg Marks"
              stroke={isDark ? lineStroke : "url(#trendStroke)"}
              strokeWidth={4.5}
              dot={renderDot}
              activeDot={{ r: 7, fill: isDark ? secondaryStroke : "#7C3AED" }}
            >
              <LabelList
                dataKey="marks"
                position="top"
                content={renderValueLabel}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
