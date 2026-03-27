const SCHOLARSHIP_SCHEMES = [
  {
    id: "nsp-merit",
    name: "National Scholarship Portal",
    provider: "Government of India",
    amount: "₹10,000 - ₹50,000",
    deadline: "2026-09-30",
    applyUrl: "https://scholarships.gov.in/",
    category: "Merit + Need",
  },
  {
    id: "mp-state",
    name: "MP State Scholarship",
    provider: "Madhya Pradesh Govt",
    amount: "₹8,000 - ₹30,000",
    deadline: "2026-10-15",
    applyUrl: "https://scholarshipportal.mp.nic.in/",
    category: "State Support",
  },
  {
    id: "aicte-pragati",
    name: "AICTE Pragati (Women)",
    provider: "AICTE",
    amount: "₹50,000",
    deadline: "2026-08-31",
    applyUrl: "https://www.aicte-india.org/schemes/students-development-schemes/Pragati",
    category: "Women in Tech",
  },
  {
    id: "aicte-saksham",
    name: "AICTE Saksham (PwD)",
    provider: "AICTE",
    amount: "₹50,000",
    deadline: "2026-08-31",
    applyUrl: "https://www.aicte-india.org/schemes/students-development-schemes/Saksham",
    category: "PwD Support",
  },
  {
    id: "ugc-scholarship",
    name: "UGC Scholarships",
    provider: "UGC",
    amount: "Varies",
    deadline: "Rolling",
    applyUrl: "https://ugc.ac.in/pg/scholarships.aspx",
    category: "Higher Education Support",
  },
];

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const incomeBand = (student = {}) => String(student.family_income_range || "").toLowerCase();

const scoreScheme = (student, scheme) => {
  const marks = toNumber(student.average_marks, 0);
  const attendance = toNumber(student.attendance_pct, 0);
  const backlog = toNumber(student.backlogs, 0);
  const firstGen = Boolean(student.first_generation_student);
  const risk = String(student.risk_level || "").toLowerCase();
  const scholarshipRisk = Boolean(student.scholarship_at_risk);
  const income = incomeBand(student);

  let score = 0;

  if (marks >= 75) score += 30;
  else if (marks >= 60) score += 18;
  else if (marks >= 45) score += 10;

  if (attendance >= 85) score += 20;
  else if (attendance >= 70) score += 12;
  else if (attendance >= 55) score += 6;

  if (income === "very_low") score += 22;
  else if (income === "low") score += 18;
  else if (income === "medium") score += 8;

  if (firstGen) score += 8;
  if (backlog <= 1) score += 10;
  else if (backlog <= 3) score += 4;

  if (risk === "high" || risk === "critical") score += 8;
  if (scholarshipRisk) score += 6;

  if (scheme.id === "aicte-pragati") {
    score += 4;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

export const getScholarshipRecommendations = (student = {}) => {
  const recommended = SCHOLARSHIP_SCHEMES.map((scheme) => {
    const score = scoreScheme(student, scheme);
    return {
      ...scheme,
      score,
      eligible: score >= 55,
    };
  }).sort((a, b) => b.score - a.score);

  const applySteps = [
    "Check eligibility criteria for marks, income, and category.",
    "Keep required documents ready (ID, marksheets, income certificate, bank details).",
    "Create account on official portal and complete student profile.",
    "Submit application before deadline and note reference number.",
    "Track status weekly and respond to correction requests quickly.",
  ];

  return {
    recommended,
    applySteps,
    topScore: recommended[0]?.score ?? 0,
  };
};

export { SCHOLARSHIP_SCHEMES };