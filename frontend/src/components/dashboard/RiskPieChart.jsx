import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const RISK_COLORS = {
  high: "#16A34A",
  medium: "#FACC15",
  low: "#DC2626",
};

const getRiskColor = (name = "") => {
  const key = String(name).trim().toLowerCase();
  return RISK_COLORS[key] || "#64748B";
};

export default function RiskPieChart({ data }) {
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  const renderLabel = ({ value, percent, cx, cy, midAngle, outerRadius }) => {
    if (!value) return "";
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 18;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#334155" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={14} fontWeight={800}>
        {`${Math.round(percent * 100)}%`}
      </text>
    );
  };

  return (
    <div className="chart-card">
      <h3 className="section-title mb-3">Risk Distribution</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={102} label={renderLabel} labelLine={false}>
              {data.map((item, index) => (
                <Cell key={`pie-${index}`} fill={getRiskColor(item.name)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${Number(value).toFixed(0)} students`, name]}
              contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {data.map((item) => {
          const count = Number(item.value) || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={item.name} className="rounded-lg border border-slate-200/80 px-3 py-2 dark:border-slate-700/70">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getRiskColor(item.name) }} />
                <p className="text-xl font-bold">{item.name}</p>
              </div>
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">{count} students • {pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
