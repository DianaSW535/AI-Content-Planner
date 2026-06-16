/** Подписи форматов для UI (БД хранит enum на английском). */
export const FORMAT_LABELS = {
  reels: "Reels",
  carousel: "Карусель",
  stories: "Stories",
  post: "Пост",
  podcast: "Подкаст",
  other: "Другое",
};

/** Варианты типа контента в форме контент-плана. */
export const PLAN_CONTENT_TYPES = [
  { value: "reels", label: "Reels" },
  { value: "stories", label: "Story" },
  { value: "post", label: "Пост" },
  { value: "carousel", label: "Карусель" },
  { value: "podcast", label: "Подкаст" },
];

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Локальная дата YYYY-MM-DD (без сдвига UTC из toISOString). */
export function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatLabel(format) {
  return FORMAT_LABELS[format] || format || "Пост";
}

export function formatK(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function dateToDayLabel(dateStr) {
  if (!dateStr) return "Пн";
  const d = new Date(`${dateStr}T12:00:00`);
  const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return DAY_LABELS[idx] || "Пн";
}

export function weekOfMonthFromDate(dateStr) {
  if (!dateStr) return 1;
  const d = new Date(`${dateStr}T12:00:00`);
  return Math.min(4, Math.max(1, Math.ceil(d.getDate() / 7)));
}

function startOfWeekMonday(base = new Date()) {
  const date = new Date(base);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(12, 0, 0, 0);
  return date;
}

/** Дата для колонки «Пн»…«Вс» в текущей неделе. */
export function scheduledDateFromWeekday(dayLabel) {
  const idx = DAY_LABELS.indexOf(dayLabel);
  const monday = startOfWeekMonday();
  monday.setDate(monday.getDate() + (idx >= 0 ? idx : 0));
  return toLocalDateString(monday);
}

/** Дата для колонки «Неделя N» в текущем месяце (якорь — понедельник недели). */
export function scheduledDateFromMonthWeek(weekNum, dayLabel = "Пн") {
  const now = new Date();
  const anchor = new Date(now.getFullYear(), now.getMonth(), 1 + (weekNum - 1) * 7);
  const idx = DAY_LABELS.indexOf(dayLabel);
  anchor.setDate(anchor.getDate() + (idx >= 0 ? idx : 0));
  anchor.setHours(12, 0, 0, 0);
  return toLocalDateString(anchor);
}

export function scheduledDateForDrop({ day, week, horizon }) {
  if (horizon === "week") return scheduledDateFromWeekday(day);
  return scheduledDateFromMonthWeek(week, day);
}

export function mapPostRow(post, latestAnalytics) {
  const a = latestAnalytics;
  const dateSrc = post.published_at || post.created_at;
  return {
    id: post.id,
    title: post.title,
    type: formatLabel(post.format),
    format: post.format,
    date: dateSrc ? String(dateSrc).slice(0, 10) : "",
    reach: a?.reach ?? 0,
    saves: a?.saves ?? 0,
    likes: a?.likes ?? 0,
    comments: a?.comments ?? 0,
    er: Number(a?.er ?? 0),
    thumbnail: post.thumbnail_url || "",
    caption: post.caption || "",
    content: post.content || "",
    tags: post.tags || "",
    status: post.status,
  };
}

export function mapRecommendationRow(row) {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    tag: row.tag || "Совет",
    priority: row.priority === "high" ? "high" : "medium",
    source_post_id: row.source_post_id,
  };
}

export function mapPlanItemToSlot(item) {
  const formatKey = item.format || "";
  return {
    id: item.id,
    scheduled_date: item.scheduled_date,
    day: dateToDayLabel(item.scheduled_date),
    week: weekOfMonthFromDate(item.scheduled_date),
    title: item.title,
    description: item.description || "",
    content: item.content || "",
    status: item.status,
    formatKey,
    format: formatKey ? formatLabel(formatKey) : "",
    thumbnail: item.thumbnail || "",
    tags: item.tags || "",
    post_id: item.post_id,
    source_item_id: item.source_item_id,
  };
}

export function buildReachSeries(analyticsRows) {
  const byDate = new Map();
  for (const row of analyticsRows) {
    const key = row.snapshot_date;
    const prev = byDate.get(key) || { reach: 0, engagement: 0 };
    byDate.set(key, {
      reach: prev.reach + (row.reach || 0),
      engagement: prev.engagement + (row.engagement || 0),
    });
  }
  const sorted = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7);
  if (!sorted.length) {
    return DAY_LABELS.map((day) => ({ day, reach: 0, engagement: 0 }));
  }
  return sorted.map(([dateStr, vals]) => ({
    day: dateToDayLabel(dateStr),
    reach: vals.reach,
    engagement: vals.engagement,
  }));
}

export function buildContentMix(posts) {
  const counts = {};
  for (const p of posts) {
    const label = formatLabel(p.format);
    counts[label] = (counts[label] || 0) + 1;
  }
  const entries = Object.entries(counts).map(([name, value]) => ({ name, value }));
  return entries.length
    ? entries
    : [{ name: "Нет данных", value: 1 }];
}

export function buildOverviewCards(posts, analyticsRows) {
  const totalReach = analyticsRows.reduce((s, r) => s + (r.reach || 0), 0);
  const avgEr =
    posts.length > 0
      ? posts.reduce((s, p) => s + (p.er || 0), 0) / posts.length
      : 0;
  return [
    {
      label: "Охват (7 дн.)",
      value: formatK(totalReach) || "0",
      delta: posts.length ? "из БД" : "—",
      positive: true,
    },
    {
      label: "Вовлечённость",
      value: `${avgEr.toFixed(1)}%`,
      delta: "средний ER",
      positive: avgEr >= 3,
    },
    {
      label: "Публикаций",
      value: String(posts.length),
      delta: "в аккаунте",
      positive: true,
    },
    {
      label: "Рекомендаций",
      value: "—",
      delta: "AI",
      positive: true,
    },
  ];
}

export function buildPostingTimeTips(recommendations) {
  const timeRecs = recommendations.filter(
    (r) =>
      r.tag?.toLowerCase().includes("время") ||
      r.title?.toLowerCase().includes("вечер")
  );
  if (!timeRecs.length) {
    return [
      { slot: "Пн–Чт", time: "12:00–14:00", score: 82 },
      { slot: "Пт–Вс", time: "19:00–22:00", score: 94 },
    ];
  }
  return timeRecs.slice(0, 2).map((r, i) => ({
    slot: r.title,
    time: r.detail.slice(0, 40),
    score: 90 - i * 8,
  }));
}

export function buildContentIdeas(recommendations, posts) {
  const fromRecs = recommendations
    .filter((r) => r.tag === "Формат" || r.tag === "SEO")
    .map((r) => r.title);
  const fromPosts = posts
    .filter((p) => p.status === "idea" || p.status === "draft")
    .map((p) => p.title)
    .slice(0, 3);
  const merged = [...fromRecs, ...fromPosts];
  return merged.length
    ? [...new Set(merged)].slice(0, 5)
    : ["Добавьте первую идею в контент-план"];
}

export function buildSuggestedHashtags(posts) {
  const tags = new Set();
  for (const p of posts) {
    if (!p.tags) continue;
    p.tags.split(/[\s,#]+/).forEach((t) => {
      const tag = t.trim();
      if (tag) tags.add(tag.startsWith("#") ? tag : `#${tag}`);
    });
  }
  const list = [...tags].slice(0, 8);
  return list.length
    ? list
    : ["#контентплан", "#instagram", "#reels"];
}

export function buildPostDetail(post, recommendations) {
  const rec = recommendations.find((r) => r.source_post_id === post.id);
  return {
    caption: post.caption || post.content || "",
    aiFeedback:
      rec?.detail ||
      "AI-анализ появится после накопления данных по публикации.",
    commentsSummary:
      "Сводка комментариев будет доступна после синхронизации с Instagram.",
    stats: [
      { label: "Охват", value: formatK(post.reach) },
      { label: "Сохранения", value: String(post.saves) },
      { label: "Переходы по ссылке", value: "—" },
      { label: "ER", value: `${post.er}%` },
    ],
  };
}
