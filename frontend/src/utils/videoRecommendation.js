const VIDEO_LIBRARY = {
  discipline: [
    {
      videoId: "arj7oStGLkU",
      title: "Beat Procrastination and Build Discipline",
      description: "Practical mindset shifts to stop delaying work and stay consistent.",
      category: "discipline",
      qualityScore: 10,
    },
    {
      videoId: "f2O6mQkFiiw",
      title: "Daily Time Management for Students",
      description: "Simple routines to manage classes, assignments, and revision effectively.",
      category: "discipline",
      qualityScore: 9,
    },
    {
      videoId: "kICh_d6tHQk",
      title: "How to Stay Focused Every Day",
      description: "Create habits that improve attention and reduce distractions.",
      category: "discipline",
      qualityScore: 9,
    },
    {
      videoId: "52lZmIafep4",
      title: "Inside the Mind of a Master Procrastinator",
      description: "Understand procrastination loops and how to break them with practical routines.",
      category: "discipline",
      qualityScore: 10,
    },
    {
      videoId: "TQMbvJNRpLE",
      title: "Stop Procrastinating: Tiny Action Framework",
      description: "Use small commitments and clear triggers to build daily study consistency.",
      category: "discipline",
      qualityScore: 9,
    },
  ],
  study: [
    {
      videoId: "IlU-zDU6aQ0",
      title: "Study Less, Study Smart",
      description: "Evidence-based study methods to improve retention and exam performance.",
      category: "study",
      qualityScore: 10,
    },
    {
      videoId: "ukLnPbIffxE",
      title: "Active Recall and Spaced Repetition",
      description: "Learn the two strongest techniques for long-term learning.",
      category: "study",
      qualityScore: 10,
    },
    {
      videoId: "Z-zNHHpXoMM",
      title: "Exam Strategy and Mistake Reduction",
      description: "How to prepare and perform better under exam pressure.",
      category: "study",
      qualityScore: 8,
    },
    {
      videoId: "RVB3PBPxMWg",
      title: "Pomodoro Study System for Deep Focus",
      description: "Use time blocks and short breaks to improve output without burnout.",
      category: "study",
      qualityScore: 9,
    },
    {
      videoId: "eVtCO84MDj8",
      title: "How to Learn Faster and Remember More",
      description: "Retention-first learning strategies for better performance across subjects.",
      category: "study",
      qualityScore: 9,
    },
  ],
  mental: [
    {
      videoId: "inpok4MKVLM",
      title: "5-Minute Reset for Stress and Anxiety",
      description: "A quick guided practice to calm down before study sessions.",
      category: "mental",
      qualityScore: 10,
    },
    {
      videoId: "z6X5oEIg6Ak",
      title: "Improve Focus with Breathing",
      description: "Simple breathing techniques to reduce stress and regain concentration.",
      category: "mental",
      qualityScore: 9,
    },
    {
      videoId: "aEqlQvczMJQ",
      title: "Mental Health Habits for Students",
      description: "Small daily habits that protect energy, mood, and motivation.",
      category: "mental",
      qualityScore: 8,
    },
    {
      videoId: "aXItOY0sLRY",
      title: "10-Minute Mindfulness for Stress Relief",
      description: "A guided reset to reduce anxiety and bring calm before study sessions.",
      category: "mental",
      qualityScore: 9,
    },
    {
      videoId: "n6pMbRiSBPs",
      title: "Breathing Drill for Exam Anxiety",
      description: "Simple breathing pattern to lower stress and improve focus quickly.",
      category: "mental",
      qualityScore: 8,
    },
  ],
  motivation: [
    {
      videoId: "mgmVOuLgFB0",
      title: "Daily Motivation: Keep Going",
      description: "A short motivational message to build confidence and consistency.",
      category: "motivation",
      qualityScore: 9,
    },
    {
      videoId: "g-jwWYX7Jlo",
      title: "Growth Mindset for Long-Term Success",
      description: "Train your mindset to bounce back from setbacks and keep improving.",
      category: "motivation",
      qualityScore: 9,
    },
    {
      videoId: "UNQhuFL6CWg",
      title: "Motivation for Students: Keep Pushing Forward",
      description: "Rebuild momentum with disciplined actions even on low-energy days.",
      category: "motivation",
      qualityScore: 8,
    },
    {
      videoId: "wnHW6o8WMas",
      title: "Consistency Beats Talent",
      description: "Why steady effort and habits matter more than short bursts of motivation.",
      category: "motivation",
      qualityScore: 8,
    },
  ],
};

const ALL_VIDEOS = Object.values(VIDEO_LIBRARY).flat();
const VIDEO_BY_ID = ALL_VIDEOS.reduce((acc, video) => {
  acc[video.videoId] = video;
  return acc;
}, {});

const clampNumber = (value, fallback = 0) => {
  const number = Number(value);
  if (Number.isNaN(number)) return fallback;
  return number;
};

export const getStressScore = (student = {}) => {
  const directStress = clampNumber(student.stress, NaN);
  const stressLevel = clampNumber(student.stress_level, NaN);
  const stressScore = clampNumber(student.stress_score, NaN);

  if (!Number.isNaN(directStress)) return directStress;
  if (!Number.isNaN(stressLevel)) return stressLevel;
  if (!Number.isNaN(stressScore)) return stressScore;

  const behaviorScore = clampNumber(student.behavior_score, 0.6);
  return Math.round((1 - Math.max(0, Math.min(1, behaviorScore))) * 10);
};

const pickVideosByTags = (tags, limit = 4, options = {}) => {
  const { excludeIds = new Set(), fallbackTags = ["motivation"] } = options;
  const seen = new Set(excludeIds);
  const selected = [];

  tags.forEach((tag) => {
    const bucket = [...(VIDEO_LIBRARY[tag] || [])].sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
    bucket.forEach((video) => {
      if (selected.length >= limit || seen.has(video.videoId)) return;
      seen.add(video.videoId);
      selected.push(video);
    });
  });

  if (selected.length < limit) {
    fallbackTags.forEach((tag) => {
      const bucket = [...(VIDEO_LIBRARY[tag] || [])].sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
      bucket.forEach((video) => {
        if (selected.length >= limit || seen.has(video.videoId)) return;
        seen.add(video.videoId);
        selected.push(video);
      });
    });
  }

  return selected;
};

const addToUsedSet = (videos, usedSet) => {
  videos.forEach((video) => usedSet.add(video.videoId));
};

const fillUniqueVideos = (existing, limit, usedSet, preferredTags = []) => {
  const selected = [...existing];
  const preferredPool = preferredTags
    .flatMap((tag) => VIDEO_LIBRARY[tag] || [])
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
  const fallbackPool = [...ALL_VIDEOS].sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));

  const tryAdd = (video) => {
    if (!video || selected.length >= limit || usedSet.has(video.videoId)) return;
    usedSet.add(video.videoId);
    selected.push(video);
  };

  preferredPool.forEach(tryAdd);
  fallbackPool.forEach(tryAdd);

  return selected.slice(0, limit);
};

const buildSectionedRecommendations = (tags = []) => {
  const used = new Set();
  const orderedTags = [...new Set(tags)];

  const aiHubSeed = pickVideosByTags(orderedTags, 6, {
    excludeIds: used,
    fallbackTags: ["study", "discipline", "mental", "motivation"],
  });
  const aiHubVideos = fillUniqueVideos(aiHubSeed, 6, used, orderedTags);
  addToUsedSet(aiHubVideos, used);

  const dailyMotivationSeed =
    pickVideosByTags(["motivation"], 1, { excludeIds: used, fallbackTags: ["motivation"] })[0] ||
    VIDEO_LIBRARY.motivation.find((video) => !used.has(video.videoId)) ||
    VIDEO_LIBRARY.motivation[0];
  const dailyMotivation = fillUniqueVideos(dailyMotivationSeed ? [dailyMotivationSeed] : [], 1, used, ["motivation"])[0];
  if (dailyMotivation) used.add(dailyMotivation.videoId);

  const topSeed = pickVideosByTags([...new Set([...orderedTags, "study", "discipline", "mental", "motivation"])], 8, {
    excludeIds: used,
    fallbackTags: ["study", "discipline", "mental", "motivation"],
  });
  const topRecommended = fillUniqueVideos(topSeed, 8, used, [...new Set([...orderedTags, "study", "discipline", "mental", "motivation"])]);
  addToUsedSet(topRecommended, used);

  const playlistSeed = pickVideosByTags(["study", "discipline", "mental", "motivation"], 10, {
    excludeIds: used,
    fallbackTags: ["study", "discipline", "mental", "motivation"],
  });
  const playlistVideos = fillUniqueVideos(playlistSeed, 10, used, ["study", "discipline", "mental", "motivation"]);

  return {
    aiHubVideos,
    dailyMotivation,
    topRecommended,
    playlistVideos,
  };
};

export const getStudentVideoRecommendations = (student = {}) => {
  const attendance = clampNumber(student.attendance_pct, 0);
  const marks = clampNumber(student.average_marks ?? student.marks, 0);
  const stress = getStressScore(student);

  const tags = [];
  if (attendance < 60) tags.push("discipline");
  if (marks < 40) tags.push("study");
  if (stress > 7) tags.push("mental");

  if (tags.length === 0) {
    tags.push("study", "motivation");
  }

  const sectioned = buildSectionedRecommendations(tags);

  return {
    ruleInputs: {
      attendance,
      marks,
      stress,
    },
    personalizedVideos: sectioned.aiHubVideos,
    dailyMotivation: sectioned.dailyMotivation,
    topRecommended: sectioned.topRecommended,
    playlistVideos: sectioned.playlistVideos,
  };
};

export const getDashboardVideoRecommendations = (analytics = {}) => {
  const pick = (ids = []) =>
    ids
      .map((id) => VIDEO_BY_ID[id])
      .filter(Boolean)
      .map((video) => ({ ...video }));

  return {
    aiHubVideos: pick([
      "arj7oStGLkU",
      "52lZmIafep4",
      "f2O6mQkFiiw",
      "kICh_d6tHQk",
      "TQMbvJNRpLE",
      "inpok4MKVLM",
    ]),
    dailyMotivation: pick(["mgmVOuLgFB0"])[0],
    topRecommended: pick([
      "z6X5oEIg6Ak",
      "aXItOY0sLRY",
      "aEqlQvczMJQ",
      "n6pMbRiSBPs",
      "IlU-zDU6aQ0",
      "ukLnPbIffxE",
      "RVB3PBPxMWg",
      "eVtCO84MDj8",
    ]),
    playlistVideos: pick([
      "Z-zNHHpXoMM",
      "g-jwWYX7Jlo",
      "UNQhuFL6CWg",
      "wnHW6o8WMas",
      "g-jwWYX7Jlo",
      "Z-zNHHpXoMM",
      "UNQhuFL6CWg",
      "wnHW6o8WMas",
    ]),
  };
};
