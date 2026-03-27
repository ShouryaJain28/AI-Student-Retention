export default function KpiCard({ label, value, tone = "slate", detail, tip }) {
  const toneMap = {
    red: "text-slate-900 dark:text-slate-100 border-red-200/80 dark:border-white/20 bg-red-50/80 dark:bg-slate-900",
    orange: "text-slate-900 dark:text-slate-100 border-amber-200/80 dark:border-white/20 bg-amber-50/80 dark:bg-slate-900",
    green: "text-slate-900 dark:text-slate-100 border-emerald-200/80 dark:border-white/20 bg-emerald-50/80 dark:bg-slate-900",
    blue: "text-slate-900 dark:text-slate-100 border-blue-200/80 dark:border-white/20 bg-blue-50/80 dark:bg-slate-900",
    slate: "text-slate-900 dark:text-slate-100 border-slate-200/80 dark:border-white/20 bg-white/85 dark:bg-slate-900",
  };

  const accentMap = {
    red: {
      label: "text-red-700 dark:text-red-300",
      value: "text-red-800 dark:text-red-200",
    },
    orange: {
      label: "text-amber-700 dark:text-amber-300",
      value: "text-amber-800 dark:text-amber-200",
    },
    green: {
      label: "text-emerald-700 dark:text-emerald-300",
      value: "text-emerald-800 dark:text-emerald-200",
    },
    blue: {
      label: "text-blue-700 dark:text-blue-300",
      value: "text-blue-800 dark:text-blue-200",
    },
    slate: {
      label: "text-slate-800 dark:text-slate-200",
      value: "text-slate-900 dark:text-white",
    },
  };

  const accent = accentMap[tone] || accentMap.slate;

  return (
    <div className={`glass-card p-4 ${toneMap[tone] || toneMap.slate}`}>
      <p className={`text-base font-bold uppercase tracking-wider ${accent.label}`}>{label}</p>
      <h3 className={`mt-1 text-5xl font-extrabold ${accent.value}`}>{value}</h3>
      {detail && <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{detail}</p>}
      {tip && <p className="mt-3 rounded-lg bg-slate-200/80 px-3 py-2 text-base font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">{tip}</p>}
    </div>
  );
}
