import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  aiRecommendations,
  contentIdeas,
  contentMix,
  overviewCards,
  planSlots,
  postingTimeTips,
  posts,
  reachSeries,
  singlePostDetail,
  suggestedHashtags,
  userProfile,
} from "./mockData.js";

/* ---------- Тема (без циклического импорта с App) ---------- */

const ThemeContext = createContext({
  dark: false,
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/** Оборачивает маршруты в App.jsx */
export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("acp-theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("acp-theme", dark ? "dark" : "light");
  }, [dark]);

  const value = useMemo(
    () => ({
      dark,
      toggleTheme: () => setDark((d) => !d),
    }),
    [dark]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/* ---------- Контент-план: живое mock-состояние (V2, без backend) ---------- */

const PlanContext = createContext(null);

export function usePlan() {
  return useContext(PlanContext);
}

/**
 * Хранит копию слотов плана + сгенерированные follow-up по postId.
 * Кнопки на странице поста обновляют slots / followUpsByPost.
 */
export function PlanProvider({ children }) {
  const [slots, setSlots] = useState(() =>
    planSlots.map((s) => ({
      ...s,
      description: s.description ?? "",
      content: s.content ?? "",
      thumbnail: s.thumbnail ?? "",
      format: s.format ?? "",
      tags: s.tags ?? "",
    }))
  );
  const [followUpsByPost, setFollowUpsByPost] = useState({});

  const duplicateIdeaToPlan = useCallback((post) => {
    const id = `slot-${Date.now()}`;
    setSlots((prev) => [
      ...prev,
      {
        id,
        day: "Сб",
        title: `Идея: ${post.title}`,
        status: "idea",
        week: 1,
        description: "",
        content: post.detail ?? post.title ?? "",
        thumbnail: post.thumbnail ?? "",
        format: post.tag || post.type || "Идея",
        tags: "",
      },
    ]);
  }, []);

  const generateFollowUp = useCallback((post) => {
    const line = `Часть 2: «${post.title}» — ответы на топ-комментарии + опрос`;
    setFollowUpsByPost((prev) => ({
      ...prev,
      [post.id]: [...(prev[post.id] || []), line],
    }));
  }, []);

  /** Ручная карточка в план: день (неделя) или номер недели (месяц) + mock-поля. */
  const addManualSlot = useCallback(
    ({ title, description, day, week }) => {
      const id = `slot-${Date.now()}`;
      setSlots((prev) => [
        ...prev,
        {
          id,
          day,
          title: title.trim(),
          description: (description || "").trim(),
          content:
            (description || "").trim() ||
            "Текст поста будет добавлен позже.",
          status: "draft",
          week: week ?? 1,
          thumbnail: "",
          format: "Пост",
          tags: "",
        },
      ]);
    },
    []
  );

  const copySlotToCell = useCallback(({ sourceId, day, week }) => {
    setSlots((prev) => {
      const src = prev.find((s) => s.id === sourceId);
      if (!src) return prev;
      const id = `slot-${Date.now()}`;
      const titleBase = String(src.title).replace(/\s+\(копия\)$/, "").trim();
      return [
        ...prev,
        {
          ...src,
          id,
          day,
          week: week ?? 1,
          title: `${titleBase} (копия)`,
        },
      ];
    });
  }, []);

  const value = useMemo(
    () => ({
      slots,
      duplicateIdeaToPlan,
      generateFollowUp,
      followUpsByPost,
      addManualSlot,
      copySlotToCell,
    }),
    [
      slots,
      followUpsByPost,
      duplicateIdeaToPlan,
      generateFollowUp,
      addManualSlot,
      copySlotToCell,
    ]
  );

  return (
    <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
  );
}

/* ---------- Общие UI-атомы ---------- */

function Logo({ compact }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/25">
        <span className="text-sm font-bold">AI</span>
      </div>
      {!compact && (
        <span className="font-semibold tracking-tight text-slate-900 dark:text-white">
          Content Planner
        </span>
      )}
    </div>
  );
}

function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    emerald:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    amber:
      "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const COLORS = ["#0ea5e9", "#6366f1", "#a855f7", "#14b8a6"];

/** Client-side правила для формы входа / регистрации */
function validateAuthEmail(value) {
  const v = value.trim();
  if (!v) return "Введите email";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Некорректный email";
  return "";
}

function validateAuthPassword(value) {
  if (!value) return "Введите пароль";
  if (value.length < 8) return "Минимум 8 символов";
  if (!/[A-Za-zА-Яа-яЁё]/.test(value) || !/\d/.test(value)) {
    return "Нужны хотя бы одна буква и одна цифра";
  }
  return "";
}

/** Скелетон таблицы публикаций (mock loading) */
function PublicationsLoading() {
  return (
    <div className="px-5 py-10">
      <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-sky-600 border-t-transparent dark:border-sky-400"
          aria-hidden
        />
        Загрузка публикаций…
      </div>
      <div className="mt-6 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
          />
        ))}
      </div>
    </div>
  );
}

function PublicationsError({ message, onRetry }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
        {message}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Демо: первый запрос имитирует сбой, повтор — успех.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
      >
        Повторить
      </button>
    </div>
  );
}

function PublicationsEmpty() {
  return (
    <div className="px-5 py-14 text-center">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Нет публикаций этого типа
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Смените фильтр или добавьте контент в план.
      </p>
    </div>
  );
}

/* ---------- 1. Landing ---------- */

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 lg:px-8">
        <Logo />
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            Войти
          </Link>
          <Link
            to="/app"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Открыть дашборд
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-8 lg:grid-cols-2 lg:items-center lg:px-8 lg:pt-16">
        <div>
          <Pill tone="sky">Аналитика + AI-план для Instagram</Pill>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
            Контент-планы и метрики в одном месте
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">
            AI Content Planner помогает блогерам и малому бизнесу видеть, что
            работает, когда публиковать и какие идеи дадут рост охвата.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 hover:bg-sky-500"
            >
              Начать бесплатно
            </Link>
            <a
              href="#preview"
              className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600"
            >
              Посмотреть интерфейс
            </a>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              "Единый дашборд по охвату и ER",
              "AI-рекомендации по формату и времени",
              "Календарь публикаций с недельным планом",
            ].map((t) => (
              <li
                key={t}
                className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
              >
                <span className="mt-0.5 text-emerald-500">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div
          id="preview"
          className="relative rounded-3xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-4 shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950"
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-sky-400/30 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-indigo-400/20 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500">
                Превью дашборда
              </span>
              <Pill tone="emerald">Live mock</Pill>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {overviewCards.slice(0, 2).map((c) => (
                <div
                  key={c.label}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/50"
                >
                  <p className="text-xs text-slate-500">{c.label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {c.value}
                  </p>
                  <p className="text-xs text-emerald-600">{c.delta}</p>
                </div>
              ))}
            </div>
            <div className="h-40 px-2 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reachSeries}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="reach"
                    stroke="#0284c7"
                    fill="url(#g)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Почему команды выбирают нас
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                t: "Скорость решений",
                d: "Сводка метрик и AI-подсказки без ручных таблиц.",
              },
              {
                t: "Понятная аналитика",
                d: "Графики охвата, ER и микса форматов из коробки.",
              },
              {
                t: "План, который живёт",
                d: "Календарь недели/месяца и карточки идей в одном потоке.",
              },
            ].map((x) => (
              <div
                key={x.t}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {x.t}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {x.d}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link
              to="/login"
              className="rounded-full bg-slate-900 px-8 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              Создать аккаунт
            </Link>
            <Link
              to="/app"
              className="rounded-full border border-slate-300 px-8 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              Демо-дашборд
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- 2. Login / Register ---------- */

export function AuthPage() {
  const [mode, setMode] = useState("login");
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const clearFieldError = (key) => {
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const switchMode = (m) => {
    setMode(m);
    setErrors({});
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const next = {
      email: validateAuthEmail(email),
      password: validateAuthPassword(password),
    };
    if (mode === "register") {
      next.name = name.trim() ? "" : "Введите имя";
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      nav("/app");
    }, 750);
  };

  const inputError = (key) =>
    errors[key]
      ? "border-rose-400 ring-rose-200 focus:ring-rose-300 dark:border-rose-500 dark:ring-rose-900/40"
      : "border-slate-200 dark:border-slate-700";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 lg:flex-row">
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-16">
        <Link to="/" className="mb-10 inline-flex w-fit">
          <Logo />
        </Link>
        <div className="mx-auto w-full max-w-md">
          <div className="flex rounded-full bg-slate-200/70 p-1 dark:bg-slate-800">
            {["login", "register"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                  mode === m
                    ? "bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {m === "login" ? "Вход" : "Регистрация"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            {mode === "register" && (
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Имя
                </label>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError("name");
                  }}
                  className={`mt-1 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none ring-sky-500/30 focus:ring-4 dark:bg-slate-900 ${inputError("name")}`}
                  placeholder="Как к вам обращаться"
                  autoComplete="name"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    {errors.name}
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("email");
                }}
                onBlur={() =>
                  setErrors((e) => ({
                    ...e,
                    email: validateAuthEmail(email),
                  }))
                }
                className={`mt-1 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none ring-sky-500/30 focus:ring-4 dark:bg-slate-900 ${inputError("email")}`}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {errors.email}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError("password");
                }}
                onBlur={() =>
                  setErrors((e) => ({
                    ...e,
                    password: validateAuthPassword(password),
                  }))
                }
                className={`mt-1 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none ring-sky-500/30 focus:ring-4 dark:bg-slate-900 ${inputError("password")}`}
                placeholder="Мин. 8 символов, буква и цифра"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {errors.password}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/25 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden
                />
              )}
              {submitting
                ? "Входим…"
                : mode === "login"
                  ? "Войти"
                  : "Создать аккаунт"}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide text-slate-500">
              <span className="bg-slate-50 px-2 dark:bg-slate-950">или</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => nav("/app")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <span className="text-lg">📸</span>
            Continue with Instagram
          </button>
          <p className="mt-6 text-center text-xs text-slate-500">
            Демо: OAuth не подключён — кнопка ведёт в макет дашборда.
          </p>
        </div>
      </div>
      <div className="hidden flex-1 bg-gradient-to-br from-sky-600 via-indigo-600 to-violet-700 lg:flex lg:flex-col lg:justify-end lg:p-12">
        <blockquote className="max-w-md text-white">
          <p className="text-lg font-medium leading-relaxed">
            «Наконец-то один экран вместо пяти вкладок и таблиц. Планирование
            стало быстрее в два раза.»
          </p>
          <footer className="mt-4 text-sm text-sky-100">
            Мария, основательница студии контента
          </footer>
        </blockquote>
      </div>
    </div>
  );
}

/* ---------- Layout: sidebar + topbar ---------- */

const navItems = [
  { to: "/app", end: true, label: "Обзор", icon: "◆" },
  { to: "/app/recommendations", label: "AI советы", icon: "✦" },
  { to: "/app/plan", label: "Контент-план", icon: "▤" },
  { to: "/app/settings", label: "Профиль", icon: "◎" },
];

/** Заголовок topbar по текущему URL (вложенные маршруты вроде /app/posts/:id). */
function headerTitle(pathname) {
  if (pathname.startsWith("/app/posts")) return "Пост: детали";
  if (pathname.startsWith("/app/recommendations")) return "AI советы";
  if (pathname.startsWith("/app/plan")) return "Контент-план";
  if (pathname.startsWith("/app/settings")) return "Профиль";
  if (pathname === "/app" || pathname === "/app/") return "Обзор";
  return "Обзор";
}

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Мобильный оверлей сайдбара */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed z-50 flex h-full w-64 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5">
          <Logo />
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <span className="opacity-70">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4 dark:border-slate-800">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/80">
            <img
              src={userProfile.avatar}
              alt=""
              className="h-10 w-10 rounded-full border border-white shadow dark:border-slate-700"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {userProfile.name}
              </p>
              <p className="truncate text-xs text-slate-500">{userProfile.plan}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col lg:pl-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Рабочая область
              </p>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                {headerTitle(location.pathname)}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 sm:inline dark:bg-emerald-950/40 dark:text-emerald-200">
              Демо-данные
            </span>
            <Link
              to="/login"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Выйти
            </Link>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ---------- 3. Dashboard + аналитика (единый экран, V2) ---------- */

export function DashboardHome() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [pubFetch, setPubFetch] = useState({
    status: "loading",
    items: null,
    error: null,
  });
  const simFailOnceRef = useRef(true);

  /** Имитация запроса: первый вызов — error, повтор — данные из mock. */
  const loadPublications = useCallback(() => {
    setPubFetch((s) => ({
      ...s,
      status: "loading",
      error: null,
    }));
    const tid = window.setTimeout(() => {
      if (simFailOnceRef.current) {
        simFailOnceRef.current = false;
        setPubFetch({
          status: "error",
          items: null,
          error: "Не удалось получить публикации (mock-сбой).",
        });
      } else {
        setPubFetch({ status: "ready", items: posts, error: null });
      }
    }, 650);
    return () => window.clearTimeout(tid);
  }, []);

  useEffect(() => {
    const cancel = loadPublications();
    return cancel;
  }, [loadPublications]);

  const filteredRows = useMemo(() => {
    if (pubFetch.status !== "ready" || !pubFetch.items) return [];
    if (typeFilter === "all") return pubFetch.items;
    return pubFetch.items.filter((p) => p.type === typeFilter);
  }, [pubFetch.status, pubFetch.items, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm text-slate-500">{c.label}</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {c.value}
              </p>
              <span
                className={`text-xs font-semibold ${
                  c.positive ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {c.delta}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Охват и вовлечённость
            </h2>
            <Pill tone="sky">7 дней</Pill>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={reachSeries}>
                <defs>
                  <linearGradient id="fillReach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="reach"
                  name="Охват"
                  stroke="#0284c7"
                  fill="url(#fillReach)"
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  name="Действия"
                  stroke="#6366f1"
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Микс контента
          </h2>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={contentMix}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {contentMix.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Лучшие посты
          </h2>
          <ul className="mt-4 space-y-3">
            {posts.slice(0, 2).map((p) => (
              <li key={p.id}>
                <Link
                  to={`/app/posts/${p.id}`}
                  className="flex gap-3 rounded-xl border border-transparent p-2 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                >
                  <img
                    src={p.thumbnail}
                    alt=""
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-white">
                      {p.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      ER {p.er}% · Охват {(p.reach / 1000).toFixed(1)}K
                    </p>
                  </div>
                  <span className="text-slate-400">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50 to-indigo-50 p-5 dark:border-slate-800 dark:from-sky-950/30 dark:to-indigo-950/20">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              AI: кратко
            </h2>
            <Link
              to="/app/recommendations"
              className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300"
            >
              Все советы
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {aiRecommendations.slice(0, 2).map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60"
              >
                <div className="flex items-center gap-2">
                  <Pill tone="sky">{r.tag}</Pill>
                  {r.priority === "high" && (
                    <Pill tone="amber">Приоритет</Pill>
                  )}
                </div>
                <p className="mt-2 font-medium text-slate-900 dark:text-white">
                  {r.title}
                </p>
                <p className="mt-1 line-clamp-2 text-slate-600 dark:text-slate-300">
                  {r.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Публикации
          </h3>
          <div className="flex flex-wrap gap-2">
            {["all", "Reels", "Карусель", "Stories", "Пост", "Подкаст"].map(
              (f) => (
                <button
                key={f}
                type="button"
                onClick={() => setTypeFilter(f === "all" ? "all" : f)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  (f === "all" && typeFilter === "all") || typeFilter === f
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                }`}
              >
                {f === "all" ? "Все" : f}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          {pubFetch.status === "loading" && <PublicationsLoading />}
          {pubFetch.status === "error" && (
            <PublicationsError
              message={pubFetch.error}
              onRetry={loadPublications}
            />
          )}
          {pubFetch.status === "ready" && filteredRows.length === 0 && (
            <PublicationsEmpty />
          )}
          {pubFetch.status === "ready" && filteredRows.length > 0 && (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/80">
                <tr>
                  <th className="px-5 py-3">Пост</th>
                  <th className="px-5 py-3">Тип</th>
                  <th className="px-5 py-3">Дата</th>
                  <th className="px-5 py-3">Охват</th>
                  <th className="px-5 py-3">ER</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                      {p.title}
                    </td>
                    <td className="px-5 py-3">
                      <Pill>{p.type}</Pill>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{p.date}</td>
                    <td className="px-5 py-3">
                      {p.reach.toLocaleString("ru-RU")}
                    </td>
                    <td className="px-5 py-3">{p.er}%</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/app/posts/${p.id}`}
                        className="font-semibold text-sky-600 hover:underline dark:text-sky-400"
                      >
                        Детали
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- 4. AI Recommendations ---------- */

export function RecommendationsPage() {
  const { duplicateIdeaToPlan } = usePlan();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          AI-рекомендации
        </h2>
        <p className="text-sm text-slate-500">
          Подсказки на основе mock-трендов вашего аккаунта.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {aiRecommendations.map((r) => (
          <article
            key={r.id}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2">
              <Pill tone="sky">{r.tag}</Pill>
              {r.priority === "high" && <Pill tone="amber">Важно</Pill>}
            </div>
            <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
              {r.title}
            </h3>
            <p className="mt-2 flex-1 text-sm text-slate-600 dark:text-slate-300">
              {r.detail}
            </p>
            <button
              type="button"
              onClick={() => duplicateIdeaToPlan(r)}
              className="mt-4 text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
            >
              Добавить в план →
            </button>
          </article>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Лучшее время публикации
          </h3>
          <ul className="mt-4 space-y-4">
            {postingTimeTips.map((row) => (
              <li
                key={row.slot}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {row.slot}
                  </p>
                  <p className="text-sm text-slate-500">{row.time}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">скоринг</p>
                  <p className="text-lg font-bold text-sky-600 dark:text-sky-400">
                    {row.score}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Идеи контента
          </h3>
          <ul className="mt-4 space-y-2">
            {contentIdeas.map((idea) => (
              <li
                key={idea}
                className="rounded-xl border border-slate-100 px-4 py-3 text-sm dark:border-slate-800"
              >
                {idea}
              </li>
            ))}
          </ul>
          <h3 className="mt-8 font-semibold text-slate-900 dark:text-white">
            Suggested hashtags
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestedHashtags.map((h) => (
              <button
                key={h}
                type="button"
                className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-200"
              >
                {h}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------- 6. Content plan (календарный / DnD-стиль) ---------- */

export function ContentPlanPage() {
  const [horizon, setHorizon] = useState("week");
  const { slots, addManualSlot, copySlotToCell } = usePlan();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [targetDay, setTargetDay] = useState("Пн");
  const [targetWeek, setTargetWeek] = useState(1);
  const [historyModalSlot, setHistoryModalSlot] = useState(null);
  const [dropTargetKey, setDropTargetKey] = useState(null);

  useEffect(() => {
    if (!historyModalSlot) return;
    const onKey = (e) => {
      if (e.key === "Escape") setHistoryModalSlot(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyModalSlot]);

  const submitManual = (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    if (horizon === "week") {
      addManualSlot({
        title,
        description: newDescription,
        day: targetDay,
        week: 1,
      });
    } else {
      addManualSlot({
        title,
        description: newDescription,
        day: "Пн",
        week: targetWeek,
      });
    }
    setNewTitle("");
    setNewDescription("");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Контент-план
          </h2>
          <p className="text-sm text-slate-500">
            Карточки в сетке имитируют перетаскивание между днями.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            + Добавить пост
          </button>
          <div className="flex rounded-full bg-slate-200/70 p-1 dark:bg-slate-800">
            {[
              { id: "week", label: "Неделя" },
              { id: "month", label: "Месяц" },
            ].map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setHorizon(x.id)}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  horizon === x.id
                    ? "bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showAddForm && (
        <form
          onSubmit={submitManual}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Новый пост в плане
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Название
              </label>
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                placeholder="Например: Reels про запуск"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Описание
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                placeholder="Кратко, о чём пост"
              />
            </div>
            {horizon === "week" ? (
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  День
                </label>
                <select
                  value={targetDay}
                  onChange={(e) => setTargetDay(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Неделя
                </label>
                <select
                  value={targetWeek}
                  onChange={(e) => setTargetWeek(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {[1, 2, 3, 4].map((w) => (
                    <option key={w} value={w}>
                      Неделя {w}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Сохранить в план
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Сетка календаря: неделя — 7 колонок по дням; месяц — 4 недели */}
      <div
        className={`grid gap-3 ${
          horizon === "week"
            ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {(horizon === "week"
          ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
          : ["Неделя 1", "Неделя 2", "Неделя 3", "Неделя 4"]
        ).map((day, idx) => {
          const slotsInCell =
            horizon === "week"
              ? slots.filter((s) => s.day === day)
              : slots.filter((s) => s.week === idx + 1);
          const dropKey = `${horizon}-${day}-${idx}`;
          const dropWeek = horizon === "week" ? 1 : idx + 1;
          const dropDay = horizon === "week" ? day : "Пн";

          return (
            <div
              key={day}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setDropTargetKey(dropKey);
              }}
              onDragLeave={() => setDropTargetKey((k) => (k === dropKey ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                setDropTargetKey(null);
                const sourceId = e.dataTransfer.getData("text/plain");
                if (!sourceId) return;
                copySlotToCell({
                  sourceId,
                  day: dropDay,
                  week: dropWeek,
                });
              }}
              className={`flex min-h-[160px] flex-col rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-2 transition dark:border-slate-700 dark:bg-slate-900/40 ${
                dropTargetKey === dropKey
                  ? "ring-2 ring-sky-500 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950"
                  : ""
              }`}
            >
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>{day}</span>
                <span className="text-[10px] text-slate-400">колонка</span>
              </div>
              {slotsInCell.map((slot) => (
                <div
                  key={slot.id}
                  className="mb-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex gap-2">
                    <span
                      data-acp-drag
                      draggable
                      onClick={(e) => e.stopPropagation()}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", slot.id);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onDragEnd={() => setDropTargetKey(null)}
                      className="shrink-0 cursor-grab select-none rounded border border-slate-200 bg-slate-50 px-1 py-1.5 text-xs text-slate-400 active:cursor-grabbing dark:border-slate-600 dark:bg-slate-800"
                      title="Перетащить в другой день или неделю"
                    >
                      ⠿
                    </span>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setHistoryModalSlot(slot)}
                    >
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <span className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                          ⋮⋮
                        </span>
                        просмотр
                      </div>
                      {slot.thumbnail ? (
                        <img
                          src={slot.thumbnail}
                          alt=""
                          className="mt-1 h-10 w-full rounded-lg object-cover"
                        />
                      ) : null}
                      <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                        {slot.title}
                      </p>
                      {slot.description ? (
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">
                          {slot.description}
                        </p>
                      ) : null}
                      <div className="mt-1">
                        <Pill tone="neutral">
                          {slot.status === "ready"
                            ? "Готово"
                            : slot.status === "draft"
                              ? "Черновик"
                              : "Идея"}
                        </Pill>
                      </div>
                    </button>
                  </div>
                </div>
              ))}
              {slotsInCell.length === 0 && (
                <p className="mt-auto text-[11px] text-slate-400">
                  Перетащите карточку сюда
                </p>
              )}
            </div>
          );
        })}
      </div>

      <details className="group rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900 marker:content-none dark:text-white [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            <span>История постов</span>
            <span className="text-xs font-normal text-slate-500">
              {slots.length} записей
            </span>
          </span>
        </summary>
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="mb-3 text-[11px] text-slate-500">
            Клик по карточке — полный просмотр. Значок «⠿»: перетащите в другой
            день или колонку недели — создаётся копия; исходная карточка
            остаётся. То же из календаря: тяните между днями и неделями.
          </p>
          <ul className="space-y-2">
            {slots.map((slot) => (
              <li
                key={`hist-${slot.id}`}
                onClick={(e) => {
                  if (e.target.closest("[data-acp-drag]")) return;
                  setHistoryModalSlot(slot);
                }}
                className="cursor-pointer rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex gap-2">
                  <span
                    data-acp-drag
                    draggable
                    role="button"
                    tabIndex={0}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") e.stopPropagation();
                    }}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", slot.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDragEnd={() => setDropTargetKey(null)}
                    className="shrink-0 cursor-grab select-none rounded border border-slate-200 bg-white px-1.5 py-2 text-sm text-slate-400 active:cursor-grabbing dark:border-slate-600 dark:bg-slate-900"
                    title="Перетащить в календарь"
                  >
                    ⠿
                  </span>
                  {slot.thumbnail ? (
                    <img
                      src={slot.thumbnail}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {slot.day}
                      </span>
                      <span>·</span>
                      <span>нед. {slot.week ?? 1}</span>
                      <Pill tone="neutral">
                        {slot.status === "ready"
                          ? "Готово"
                          : slot.status === "draft"
                            ? "Черновик"
                            : "Идея"}
                      </Pill>
                    </div>
                    <p className="mt-1 font-medium text-slate-900 dark:text-white">
                      {slot.title}
                    </p>
                    {slot.description ? (
                      <p className="mt-0.5 line-clamp-2 text-slate-600 dark:text-slate-300">
                        {slot.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {historyModalSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 dark:bg-black/60"
            aria-label="Закрыть просмотр"
            onClick={() => setHistoryModalSlot(null)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <h3
                id="history-modal-title"
                className="pr-2 text-lg font-bold text-slate-900 dark:text-white"
              >
                {historyModalSlot.title}
              </h3>
              <button
                type="button"
                onClick={() => setHistoryModalSlot(null)}
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Закрыть
              </button>
            </div>
            {historyModalSlot.thumbnail ? (
              <img
                src={historyModalSlot.thumbnail}
                alt=""
                className="mt-4 w-full max-h-52 rounded-xl object-cover"
              />
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone="neutral">
                {historyModalSlot.status === "ready"
                  ? "Готово"
                  : historyModalSlot.status === "draft"
                    ? "Черновик"
                    : "Идея"}
              </Pill>
              {historyModalSlot.format ? (
                <Pill tone="sky">{historyModalSlot.format}</Pill>
              ) : null}
            </div>
            <dl className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex gap-2">
                <dt className="text-slate-500">День</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-100">
                  {historyModalSlot.day}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-500">Неделя</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-100">
                  {historyModalSlot.week ?? 1}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-500">Идентификатор</dt>
                <dd className="font-mono text-[11px] text-slate-700 dark:text-slate-200">
                  {historyModalSlot.id}
                </dd>
              </div>
            </dl>
            {historyModalSlot.tags ? (
              <p className="mt-2 text-xs text-sky-800 dark:text-sky-200">
                {historyModalSlot.tags}
              </p>
            ) : null}
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Описание
              </p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                {historyModalSlot.description?.trim() || "—"}
              </p>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Содержание
              </p>
              <div className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-100">
                <pre className="whitespace-pre-wrap font-sans">
                  {historyModalSlot.content?.trim() ||
                    "Расширенный текст не задан."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 7. Settings ---------- */

export function SettingsPage() {
  const { dark, toggleTheme } = useTheme();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Профиль
        </h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <img
            src={userProfile.avatar}
            alt=""
            className="h-20 w-20 rounded-2xl border border-slate-200 dark:border-slate-700"
          />
          <div className="flex-1 space-y-2">
            <input
              defaultValue={userProfile.name}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <input
              defaultValue={userProfile.handle}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>
        <button
          type="button"
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          Сохранить
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Подключённые соцсети
        </h2>
        <ul className="mt-4 space-y-3">
          {["Instagram", "Threads", "Facebook Page"].map((net, i) => (
            <li
              key={net}
              className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800"
            >
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  {net}
                </p>
                <p className="text-xs text-slate-500">
                  {i === 0 ? "Подключено · @anna_content" : "Не подключено"}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold dark:border-slate-600"
              >
                {i === 0 ? "Настроить" : "Подключить"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Уведомления
        </h2>
        <div className="mt-4 space-y-3">
          {[
            "Email: еженедельный отчёт",
            "Push: пиковые провалы ER",
            "Telegram: напоминание о публикации",
          ].map((label) => (
            <label
              key={label}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50"
            >
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {label}
              </span>
              <input type="checkbox" defaultChecked className="h-4 w-4" />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Тема оформления
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Переключение добавляет класс <code className="text-xs">dark</code> на{" "}
          <code className="text-xs">html</code>.
        </p>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
            Тёмный режим
          </span>
          <button
            type="button"
            onClick={toggleTheme}
            className={`relative h-7 w-12 rounded-full transition ${
              dark ? "bg-sky-600" : "bg-slate-300"
            }`}
            aria-pressed={dark}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                dark ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 8. Single post ---------- */

export function SinglePostPage() {
  const { postId } = useParams();
  const post = posts.find((p) => p.id === postId);
  const detail = singlePostDetail[postId] ?? singlePostDetail.p1;
  const { duplicateIdeaToPlan, generateFollowUp, followUpsByPost } = usePlan();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!post) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-slate-600">Пост не найден в mock-данных.</p>
        <Link to="/app" className="mt-4 inline-block text-sky-600">
          В обзор
        </Link>
      </div>
    );
  }

  const followList = followUpsByPost[post.id] ?? [];

  return (
    <div className="relative space-y-6">
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-[100] max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          {toast === "plan"
            ? "Added to content plan"
            : "Follow-up generated"}
        </div>
      )}
      <Link
        to="/app"
        className="text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
      >
        ← Назад в обзор
      </Link>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <img
              src={post.thumbnail}
              alt=""
              className="h-56 w-full object-cover sm:h-72"
            />
            <div className="p-5">
              <div className="flex flex-wrap gap-2">
                <Pill>{post.type}</Pill>
                <Pill tone="sky">{post.date}</Pill>
              </div>
              <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
                {post.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {detail.caption}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-50 to-sky-50 p-5 dark:border-slate-800 dark:from-indigo-950/30 dark:to-sky-950/20">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              AI feedback
            </h3>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              {detail.aiFeedback}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Сводка комментариев
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {detail.commentsSummary}
            </p>
          </div>
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Статистика
            </h3>
            <dl className="mt-4 space-y-3">
              {detail.stats.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
                >
                  <dt className="text-xs text-slate-500">{s.label}</dt>
                  <dd className="text-sm font-bold text-slate-900 dark:text-white">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Быстрые действия
            </h3>
            <button
              type="button"
              onClick={() => {
                duplicateIdeaToPlan(post);
                setToast("plan");
              }}
              className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold dark:border-slate-700"
            >
              Дублировать идею в контент-план
            </button>
            <button
              type="button"
              onClick={() => {
                generateFollowUp(post);
                setToast("followup");
              }}
              className="mt-2 w-full rounded-xl bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Generate follow-up post
            </button>
            {followList.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Идеи follow-up
                </p>
                <ul className="mt-2 space-y-2 text-xs text-slate-700 dark:text-slate-200">
                  {followList.map((text, i) => (
                    <li key={`${post.id}-fu-${i}`}>{text}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
