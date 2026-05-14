/**
 * Централизованные mock-данные для демо без backend.
 * В продакшене заменить на запросы к API.
 */

export const userProfile = {
  name: "Анна К.",
  handle: "@anna_content",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anna",
  plan: "Pro",
};

/** Серия для графиков: охваты по дням */
export const reachSeries = [
  { day: "Пн", reach: 4200, engagement: 312 },
  { day: "Вт", reach: 5100, engagement: 401 },
  { day: "Ср", reach: 3800, engagement: 289 },
  { day: "Чт", reach: 6200, engagement: 512 },
  { day: "Пт", reach: 7100, engagement: 598 },
  { day: "Сб", reach: 8900, engagement: 720 },
  { day: "Вс", reach: 5400, engagement: 410 },
];

/** Распределение типов контента */
export const contentMix = [
  { name: "Reels", value: 42 },
  { name: "Карусели", value: 28 },
  { name: "Stories", value: 22 },
  { name: "Посты", value: 8 },
];

/** Таблица публикаций / лучшие посты */
export const posts = [
  {
    id: "p1",
    title: "5 ошибок в контент-плане",
    type: "Карусель",
    date: "2026-05-10",
    reach: 12400,
    saves: 890,
    likes: 1200,
    comments: 64,
    er: 4.8,
    thumbnail:
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200&h=200&fit=crop",
  },
  {
    id: "p2",
    title: "Закулисье съёмки",
    type: "Reels",
    date: "2026-05-08",
    reach: 22100,
    saves: 1200,
    likes: 3400,
    comments: 210,
    er: 6.2,
    thumbnail:
      "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=200&h=200&fit=crop",
  },
  {
    id: "p3",
    title: "Чек-лист запуска",
    type: "Stories",
    date: "2026-05-05",
    reach: 5600,
    saves: 120,
    likes: 430,
    comments: 18,
    er: 3.1,
    thumbnail:
      "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=200&h=200&fit=crop",
  },
  {
    id: "p4",
    title: "Тренды май 2026",
    type: "Пост",
    date: "2026-05-02",
    reach: 9800,
    saves: 340,
    likes: 780,
    comments: 45,
    er: 4.1,
    thumbnail:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=200&h=200&fit=crop",
  },
];

export const overviewCards = [
  { label: "Охват (7 дн.)", value: "48.2K", delta: "+12%", positive: true },
  { label: "Вовлечённость", value: "5.4%", delta: "+0.6%", positive: true },
  { label: "Новые подписчики", value: "328", delta: "-4%", positive: false },
  { label: "Публикаций", value: "14", delta: "план", positive: true },
];

export const aiRecommendations = [
  {
    id: "r1",
    title: "Сместите Reels на вечер",
    detail:
      "Аудитория активнее 19:00–22:00 — потенциал +18% к охвату.",
    tag: "Время",
    priority: "high",
  },
  {
    id: "r2",
    title: "Серия «до/после»",
    detail:
      "3 карусели подряд дали пик сохранений — повторите формат на следующей неделе.",
    tag: "Формат",
    priority: "medium",
  },
  {
    id: "r3",
    title: "Хэштеги: меньше, но точнее",
    detail:
      "5–7 релевантных тегов лучше 25 общих — меньше спама в выдаче.",
    tag: "SEO",
    priority: "medium",
  },
];

export const postingTimeTips = [
  { slot: "Пн–Чт", time: "12:00–14:00", score: 82 },
  { slot: "Пт–Вс", time: "19:00–22:00", score: 94 },
];

export const contentIdeas = [
  "Разбор кейса клиента (без имён)",
  "Мифы ниши за 60 секунд",
  "FAQ из комментариев за неделю",
];

export const suggestedHashtags = [
  "#контентмаркетинг",
  "#малыйбизнес",
  "#instagramtips",
  "#reels",
  "#контентплан",
];

/** Слоты контент-плана (визуал «как календарь») */
export const planSlots = [
  {
    id: "c1",
    day: "Пн",
    title: "Reels: тренд",
    status: "ready",
    week: 1,
    format: "Reels",
    tags: "#reels #тренды #охват",
    thumbnail:
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=240&fit=crop",
    description: "Трендовый звук + хук в первые 2 секунды.",
    content:
      "Полный сценарий Reels:\n\n1) Хук: вопрос «Знали ли вы…»\n2) Три быстрых кадра с примерами\n3) Призыв сохранить и написать в комментариях, какой формат снять следующим.\n\nОбложка: крупный текст, контраст. Длительность 25–35 сек.",
  },
  {
    id: "c2",
    day: "Вт",
    title: "Карусель чек-лист",
    status: "draft",
    week: 1,
    format: "Карусель",
    tags: "#чеклист #полезное",
    thumbnail:
      "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=240&fit=crop",
    description: "5 слайдов: проблема → шаги → итог.",
    content:
      "Слайд 1 — заголовок и боль аудитории.\nСлайды 2–4 — по одному шагу чек-листа, иконки + короткий текст.\nСлайд 5 — CTA: ссылка в шапке + «сохраните в подборку».\n\nТон: дружелюбный, без воды.",
  },
  {
    id: "c3",
    day: "Ср",
    title: "Stories опрос",
    status: "idea",
    week: 1,
    format: "Stories",
    tags: "#stories #опрос",
    thumbnail:
      "https://images.unsplash.com/photo-1611262588024-d12430b98920?w=400&h=240&fit=crop",
    description: "Два стикера: опрос + викторина.",
    content:
      "Первая серия — опрос «что важнее: охват или конверсия?»\nВторая — викторина на 3 вопроса с разбором в следующей серии.\n\nОтветы использовать как идеи для поста в ленту.",
  },
  {
    id: "c4",
    day: "Чт",
    title: "Пост + CTA",
    status: "draft",
    week: 2,
    format: "Пост",
    tags: "#cta #лента",
    thumbnail:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=240&fit=crop",
    description: "Текст 900 знаков, одна ссылка.",
    content:
      "Структура поста: крючок в первой строке, история из практики, вывод в 3 пункта, в конце — чёткий CTA (комментарий / переход по ссылке).\n\nХэштеги: 5–7 релевантных.",
  },
  {
    id: "c5",
    day: "Пт",
    title: "Reels закулисье",
    status: "ready",
    week: 2,
    format: "Reels",
    tags: "#закулисье #bts",
    thumbnail:
      "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&h=240&fit=crop",
    description: "Монтаж jump-cut, субтитры.",
    content:
      "Показать рабочее место, подготовку реквизита, одну забавную ошибку дубля и финальный кадр «готово».\n\nМузыка из библиотеки Instagram, громкость речи 100%.",
  },
];

export const singlePostDetail = {
  p1: {
    caption:
      "Разбираем типичные ошибки при планировании контента — сохраняйте чек-лист в карусели.",
    aiFeedback:
      "Сильная первая обложка и чёткий CTA. Добавьте вопрос в конце для роста комментариев.",
    commentsSummary:
      "Топ-темы: просьба о шаблоне плана, вопросы про частоту постов, положительный отклик на структуру слайдов.",
    stats: [
      { label: "Охват", value: "12.4K" },
      { label: "Сохранения", value: "890" },
      { label: "Переходы по ссылке", value: "124" },
      { label: "ER", value: "4.8%" },
    ],
  },
  p2: {
    caption:
      "Как мы снимаем один Reels за 2 часа — весь процесс в кадре.",
    aiFeedback:
      "Динамика отличная; попробуйте субтитры крупнее для удержания на мобильных.",
    commentsSummary:
      "Много вопросов про оборудование и музыку; запрос на вторую часть.",
    stats: [
      { label: "Охват", value: "22.1K" },
      { label: "Сохранения", value: "1.2K" },
      { label: "Переходы по ссылке", value: "340" },
      { label: "ER", value: "6.2%" },
    ],
  },
};
