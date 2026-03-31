import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AppShell from "../components/layout/AppShell";
import KpiCard from "../components/dashboard/KpiCard";
import RiskPieChart from "../components/dashboard/RiskPieChart";
import PerformanceLineChart from "../components/dashboard/PerformanceLineChart";
import AttendanceBarChart from "../components/dashboard/AttendanceBarChart";
import VideoCard from "../components/videos/VideoCard";
import VideoModal from "../components/videos/VideoModal";
import SvgIcon from "../components/layout/SvgIcon";
import { analyticsApi } from "../api/client";
import { getDashboardVideoRecommendations } from "../utils/videoRecommendation";

const initialAnalytics = {
  kpis: { total_students: 0, high_risk: 0, medium_risk: 0, low_risk: 0 },
  risk_distribution: [
    { name: "High", value: 0 },
    { name: "Medium", value: 0 },
    { name: "Low", value: 0 },
  ],
  performance_trend: [],
  attendance_vs_marks: [],
  notifications: [],
};

export default function DashboardPage({ showVideoSections = false, showDashboardSections = true }) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null);

  const loadAnalytics = async () => {
    try {
      const res = await analyticsApi.get();
      setAnalytics(res.data);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401 || status === 422) return;
      toast.error(error?.response?.data?.error || "Failed to load analytics", { id: "dashboard-analytics-error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    return undefined;
  }, []);

  const fixedRiskDistribution = useMemo(
    () => [
      { name: "High", value: 175 },
      { name: "Medium", value: 175 },
      { name: "Low", value: 250 },
    ],
    []
  );

  const fixedKpis = useMemo(
    () => ({
      ...analytics.kpis,
      total_students: 600,
      high_risk: 175,
      medium_risk: 175,
      low_risk: 250,
    }),
    [analytics.kpis]
  );

  const cards = useMemo(
    () => [
      {
        label: "Total Students",
        value: fixedKpis.total_students,
        tone: "blue",
        detail: "All active student records currently tracked in the intervention pipeline.",
        tip: "Use this to monitor coverage and data completeness.",
      },
      {
        label: "High Risk",
        value: fixedKpis.high_risk,
        tone: "red",
        detail: "Students requiring immediate counselor action and close follow-up.",
        tip: "Plan intervention in 24-48 hours for each case.",
      },
      {
        label: "Medium Risk",
        value: fixedKpis.medium_risk,
        tone: "orange",
        detail: "Students showing warning signs that can be corrected early.",
        tip: "Schedule weekly check-ins and targeted support plans.",
      },
      {
        label: "Safe Zone",
        value: fixedKpis.low_risk,
        tone: "green",
        detail: "Students with stable engagement and low predicted dropout risk.",
        tip: "Keep monthly monitoring to maintain retention outcomes.",
      },
    ],
    [fixedKpis]
  );

  const interventionSummary = useMemo(() => {
    const total = Math.max(fixedKpis.total_students || 0, 1);
    const highPct = Math.round(((fixedKpis.high_risk || 0) / total) * 100);
    const medPct = Math.round(((fixedKpis.medium_risk || 0) / total) * 100);
    return {
      highPct,
      medPct,
    };
  }, [fixedKpis]);

  const learningHub = useMemo(() => getDashboardVideoRecommendations(analytics), [analytics]);

  const priorityStudents = useMemo(
    () =>
      (analytics.notifications || [])
        .filter((note) => ["high", "medium"].includes(String(note.severity || "").toLowerCase()))
        .slice(0, 10),
    [analytics.notifications]
  );

  return (
    <AppShell notifications={analytics.notifications}>
      {loading ? (
        showDashboardSections ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="skeleton h-56 rounded-2xl" />
            ))}
          </div>
        )
      ) : (
        <>
          {showDashboardSections && (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => (
                  <KpiCard key={card.label} {...card} />
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <RiskPieChart data={fixedRiskDistribution} />
                <PerformanceLineChart data={analytics.performance_trend} />
              </div>

              <div className="mt-4 glass-card p-4">
                <h3 className="section-title">AI-powered insights for intervention planning</h3>
                <p className="section-description mt-2">
                  {interventionSummary.highPct}% of students are in high-risk and {interventionSummary.medPct}% are in medium-risk bands.
                  Prioritize high-risk outreach first, then convert medium-risk students into safe zone through scheduled support.
                </p>
              </div>

              <div className="mt-4">
                <AttendanceBarChart data={analytics.attendance_vs_marks} />
              </div>

              <div className="mt-4 glass-card p-4">
                <h3 className="section-title">Priority Students (High + Medium)</h3>
                <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">Students requiring immediate and near-term intervention tracking.</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {priorityStudents.length === 0 ? (
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">No medium/high risk students right now.</p>
                  ) : (
                    priorityStudents.map((note) => {
                      const severity = String(note.severity || "").toLowerCase();
                      const tone =
                        severity === "high"
                          ? "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200";
                      return (
                        <div key={note.id} className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-700/70">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{note.title}</p>
                            <span className={`rounded-full px-3 py-1 text-sm font-bold uppercase ${tone}`}>{severity}</span>
                          </div>
                          <p className="mt-2 text-base font-semibold text-slate-800 dark:text-slate-100">{note.message}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}

          {showVideoSections && (
            <>
              <section className="mt-4 glass-card p-6">
                <h3 className="section-title flex items-center gap-2">
                  <SvgIcon name="home" className="h-5 w-5 text-indigo-500" />
                  AI Learning Hub
                </h3>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  Smart recommendations generated from current risk and performance trends.
                </p>

                <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {learningHub.aiHubVideos.map((video, index) => (
                    <VideoCard key={video.videoId} {...video} delayIndex={index} onOpen={setActiveVideo} />
                  ))}
                </div>
              </section>

              <section className="mt-4">
                <div className="glass-card p-6">
                  <h3 className="section-title flex items-center gap-2">
                    <SvgIcon name="settings" className="h-5 w-5 text-rose-500" />
                    Top Recommended for You
                  </h3>
                  <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">Quick picks based on overall student needs.</p>
                  <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {learningHub.topRecommended.map((video, index) => (
                      <VideoCard key={`${video.videoId}-${index}`} {...video} delayIndex={index} onOpen={setActiveVideo} />
                    ))}
                  </div>
                </div>
              </section>

              <section className="mt-4 glass-card p-6">
                <h3 className="section-title flex items-center gap-2">
                  <SvgIcon name="menu" className="h-5 w-5 text-emerald-500" />
                  Playlist for Retention Support
                </h3>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  Scrollable playlist covering study strategy, discipline, and mental wellness.
                </p>
                <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {learningHub.playlistVideos.map((video, index) => (
                    <VideoCard key={`${video.videoId}-playlist-${index}`} {...video} delayIndex={index} onOpen={setActiveVideo} />
                  ))}
                </div>
              </section>

              <VideoModal video={activeVideo} onClose={() => setActiveVideo(null)} />
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
