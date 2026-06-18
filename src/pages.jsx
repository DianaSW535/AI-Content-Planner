import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
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
import { useAppData, usePlan } from "./context/AppDataProvider.jsx";
import { PLAN_CONTENT_TYPES } from "./api/mappers.js";
import {
  validateAuthEmail,
  validateAuthName,
  validateAuthPassword,
  validatePlanFormat,
  validatePlanSchedule,
  validatePlanTitle,
  formatUserError,
} from "./lib/validation.js";

function DataLoading({ className = "", text = "Загрузка..." }) {
  return (
    <p className={`text-sm text-slate-500 dark:text-slate-400 ${className}`}>
      {text}
    </p>
  );
}

function DataError({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-900/50 dark:bg-rose-950/30">
      <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
        {message || "Не удалось загрузить данные"}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          Повторить
        </button>
      )}
    </div>
  );
}

function DataEmpty({ message }) {
  return (
    <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
    </p>
  );
}

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

/** Скелетон таблицы публикаций */
function PublicationsLoading() {
  return (
    <div className="px-5 py-10">
      <DataLoading className="text-center" />
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
    <div className="px-5 py-8">
      <DataError message={message} onRetry={onRetry} />
    </div>
  );
}

function PublicationsEmpty({ filtered }) {
  return (
    <div className="px-5 py-8">
      <DataEmpty
        message={
          filtered
            ? "Нет публикаций этого типа"
            : "Пока нет постов"
        }
      />
    </div>
  );
}

/* ---------- 1. Landing ---------- */

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 dark:bg-slate-950">
      <Logo />
      <h1 className="mt-8 text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        Контент-планы и метрики в одном месте
      </h1>
      <p className="mt-4 max-w-md text-center text-lg text-slate-600 dark:text-slate-300">
        AI Content Planner помогает видеть, что работает, когда публиковать и
        какие идеи дадут рост охвата.
      </p>
      <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
        <Link
          to="/login"
          className="rounded-full bg-sky-600 px-8 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-sky-600/30 hover:bg-sky-500"
        >
          ВОЙТИ
        </Link>
        <Link
          to="/login?mode=register"
          className="rounded-full border border-slate-200 bg-white px-8 py-3 text-center text-sm font-semibold uppercase tracking-wide text-slate-800 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600"
        >
          ЗАРЕГИСТРИРОВАТЬСЯ
        </Link>
        <Link
          to="/preview"
          className="rounded-full bg-slate-900 px-8 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          ПОСМОТРЕТЬ ИНТЕРФЕЙС
        </Link>
      </div>
    </div>
  );
}

/* ---------- 2. Login / Register ---------- */

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(() =>
    searchParams.get("mode") === "register" ? "register" : "login"
  );
  const nav = useNavigate();
  const { signIn, signUp } = useAppData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");

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
    setAuthError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {
      email: validateAuthEmail(email),
      password: validateAuthPassword(password),
    };
    if (mode === "register") {
      next.name = validateAuthName(name);
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    setAuthError("");
    try {
      let newSession = null;
      if (mode === "login") {
        newSession = await signIn(email.trim(), password);
      } else {
        newSession = await signUp(email.trim(), password, name.trim());
      }
      if (!newSession) {
        setAuthError(
          "Аккаунт создан. Подтвердите email по ссылке из письма, затем войдите."
        );
        return;
      }
      nav("/app");
    } catch (err) {
      setAuthError(
        formatUserError(err, "Ошибка входа. Проверьте email и пароль.")
      );
    } finally {
      setSubmitting(false);
    }
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
            {authError && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {authError}
              </p>
            )}
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
            onClick={() => nav("/login")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <span className="text-lg">📸</span>
            Continue with Instagram
          </button>
          <p className="mt-6 text-center text-xs text-slate-500">
            OAuth пока не подключён — войдите через email или зарегистрируйтесь.
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

const navItems = (basePath) => [
  { to: basePath, end: true, label: "Обзор", icon: "◆" },
  { to: `${basePath}/recommendations`, label: "AI советы", icon: "✦" },
  { to: `${basePath}/plan`, label: "Контент-план", icon: "▤" },
  { to: `${basePath}/settings`, label: "Профиль", icon: "◎" },
];

/** Заголовок topbar по текущему URL (вложенные маршруты вроде /app/posts/:id). */
function headerTitle(pathname) {
  const base = pathname.startsWith("/preview") ? "/preview" : "/app";
  if (pathname.startsWith(`${base}/posts`)) return "Пост: детали";
  if (pathname.startsWith(`${base}/recommendations`)) return "AI советы";
  if (pathname.startsWith(`${base}/plan`)) return "Контент-план";
  if (pathname.startsWith(`${base}/settings`)) return "Профиль";
  if (pathname === base || pathname === `${base}/`) return "Обзор";
  return "Обзор";
}

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { previewMode, userProfile, signOut, session, authReady } = useAppData();
  const nav = useNavigate();
  const basePath = previewMode ? "/preview" : "/app";

  const handleSignOut = async () => {
    await signOut();
    nav("/login");
  };

  if (!previewMode && !authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <DataLoading />
      </div>
    );
  }

  if (!previewMode && !session) {
    return <Navigate to="/login" replace />;
  }

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
          <Link to={previewMode ? "/" : basePath}>
            <Logo />
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems(basePath).map((item) => (
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
                {previewMode ? "Режим просмотра" : "Рабочая область"}
              </p>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                {headerTitle(location.pathname)}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {previewMode ? (
              <>
                <Link
                  to="/login"
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Войти
                </Link>
                <Link
                  to="/"
                  className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  На главную
                </Link>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Выйти
              </button>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          {previewMode && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              Режим просмотра: интерфейс без данных, изменения недоступны.{" "}
              <Link to="/login" className="font-semibold underline">
                Войдите
              </Link>
              , чтобы работать с контентом.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ---------- 3. Dashboard + аналитика (единый экран, V2) ---------- */

export function DashboardHome() {
  const [typeFilter, setTypeFilter] = useState("all");
  const {
    previewMode,
    loading,
    error,
    refresh,
    posts,
    recommendations,
    overviewCards,
    reachSeries,
    contentMix,
  } = useAppData();
  const basePath = previewMode ? "/preview" : "/app";

  const filteredRows = useMemo(() => {
    if (typeFilter === "all") return posts;
    return posts.filter((p) => p.type === typeFilter);
  }, [posts, typeFilter]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <DataLoading />
      </div>
    );
  }

  if (error) {
    return <DataError message={error} onRetry={refresh} />;
  }

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
            {posts.length === 0 ? (
              <DataEmpty message="Пока нет постов" />
            ) : (
              posts.slice(0, 2).map((p) => (
              <li key={p.id}>
                <Link
                  to={`${basePath}/posts/${p.id}`}
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
              ))
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50 to-indigo-50 p-5 dark:border-slate-800 dark:from-sky-950/30 dark:to-indigo-950/20">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              AI: кратко
            </h2>
            <Link
              to={`${basePath}/recommendations`}
              className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300"
            >
              Все советы
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {recommendations.length === 0 ? (
              <DataEmpty message="Пока нет AI-рекомендаций" />
            ) : (
              recommendations.slice(0, 2).map((r) => (
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
              ))
            )}
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
          {filteredRows.length === 0 ? (
            <PublicationsEmpty filtered={typeFilter !== "all"} />
          ) : (
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
                        to={`${basePath}/posts/${p.id}`}
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
  const {
    previewMode,
    loading,
    error,
    refresh,
    recommendations,
    postingTimeTips,
    contentIdeas,
    suggestedHashtags,
  } = useAppData();
  const { duplicateIdeaToPlan } = usePlan();
  const [planActionError, setPlanActionError] = useState("");

  const handleAddToPlan = async (r) => {
    setPlanActionError("");
    try {
      await duplicateIdeaToPlan(r);
    } catch (e) {
      setPlanActionError(
        formatUserError(e, "Не удалось добавить в контент-план.")
      );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <DataLoading />
      </div>
    );
  }

  if (error) {
    return <DataError message={error} onRetry={refresh} />;
  }

  return (
    <div className="space-y-8">
      {planActionError && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {planActionError}
        </p>
      )}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          AI-рекомендации
        </h2>
        <p className="text-sm text-slate-500">
          Подсказки на основе аналитики вашего аккаунта.
        </p>
      </div>

      {recommendations.length === 0 ? (
        <DataEmpty message="Пока нет AI-рекомендаций" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((r) => (
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
              onClick={() => handleAddToPlan(r)}
              disabled={previewMode}
              className="mt-4 text-sm font-semibold text-sky-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:text-sky-400 dark:disabled:text-slate-500"
            >
              {previewMode ? "Доступно после входа" : "Добавить в план →"}
            </button>
          </article>
        ))}
        </div>
      )}

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

function PlanCrudButtons({
  onEdit,
  onDelete,
  deleting,
  compact = false,
}) {
  return (
    <div
      className={`flex gap-1 ${compact ? "" : "mt-2"}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onEdit}
        className={`rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 ${
          compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
        }`}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className={`rounded-lg border border-rose-200 font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30 ${
          compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
        }`}
      >
        {deleting ? "..." : "Delete"}
      </button>
    </div>
  );
}

function PlanItemModal({
  slot,
  mode,
  editTitle,
  editFormat,
  editDescription,
  editTitleTouched,
  onTitleBlur,
  saving,
  saveError,
  onClose,
  onStartEdit,
  onCancelEdit,
  onEditTitle,
  onEditFormat,
  onEditDescription,
  onSave,
  onDelete,
  deleting,
  readOnly = false,
}) {
  const titleInvalid = !editTitle.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 dark:bg-black/60"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <h3
            id="plan-modal-title"
            className="pr-2 text-lg font-bold text-slate-900 dark:text-white"
          >
            {mode === "edit" ? "Редактирование" : slot.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Закрыть
          </button>
        </div>

        {mode === "edit" ? (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Тип контента <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={editFormat}
                onChange={(e) => onEditFormat(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {PLAN_CONTENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Тема / заголовок <span className="text-rose-500">*</span>
              </label>
              <input
                required
                value={editTitle}
                onChange={(e) => onEditTitle(e.target.value)}
                onBlur={onTitleBlur}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              {editTitleTouched && titleInvalid && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  Поле не может быть пустым
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                О чём контент
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => onEditDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            {saveError && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {saveError}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={saving || titleInvalid}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Saving..." : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Отмена
              </button>
            </div>
          </form>
        ) : (
          <>
            {slot.thumbnail ? (
              <img
                src={slot.thumbnail}
                alt=""
                className="mt-4 w-full max-h-52 rounded-xl object-cover"
              />
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {slot.format ? <Pill tone="sky">{slot.format}</Pill> : null}
              <Pill tone="neutral">
                {slot.status === "ready"
                  ? "Готово"
                  : slot.status === "draft"
                    ? "Черновик"
                    : "Идея"}
              </Pill>
              <Pill tone="neutral">{slot.day}</Pill>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Описание
              </p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                {slot.description?.trim() || "—"}
              </p>
            </div>
            {!readOnly && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onStartEdit}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/50 dark:text-rose-300"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ContentPlanPage() {
  const [horizon, setHorizon] = useState("week");
  const { previewMode } = useAppData();
  const {
    slots,
    planLoading,
    planError,
    addManualSlot,
    copySlotToCell,
    updatePlanItem,
    deletePlanItem,
    refreshPlan,
  } = usePlan();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newContentType, setNewContentType] = useState("post");
  const [titleTouched, setTitleTouched] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [targetDay, setTargetDay] = useState("Пн");
  const [targetWeek, setTargetWeek] = useState(1);
  const [modalSlot, setModalSlot] = useState(null);
  const [modalMode, setModalMode] = useState("view");
  const [editTitle, setEditTitle] = useState("");
  const [editFormat, setEditFormat] = useState("post");
  const [editDescription, setEditDescription] = useState("");
  const [editTitleTouched, setEditTitleTouched] = useState(false);
  const [dropTargetKey, setDropTargetKey] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);

  const titleInvalid = Boolean(validatePlanTitle(newTitle));
  const formatInvalid = Boolean(validatePlanFormat(newContentType));

  const openModal = (slot, mode = "view") => {
    setModalSlot(slot);
    setModalMode(mode);
    setEditTitle(slot.title);
    setEditFormat(slot.formatKey || "post");
    setEditDescription(slot.description || "");
    setEditTitleTouched(false);
    setSaveError("");
    setActionError("");
  };

  const closeModal = () => {
    setModalSlot(null);
    setModalMode("view");
    setSaveError("");
  };

  useEffect(() => {
    if (!modalSlot) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalSlot]);

  const handleDelete = async (id) => {
    setDeleteLoadingId(id);
    setActionError("");
    try {
      await deletePlanItem(id);
      if (modalSlot?.id === id) closeModal();
    } catch (err) {
      setActionError(
        formatUserError(err, "Не удалось удалить запись. Попробуйте позже.")
      );
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!modalSlot) return;
    setEditTitleTouched(true);
    if (!editTitle.trim()) return;

    setSaving(true);
    setSaveError("");
    try {
      await updatePlanItem(modalSlot.id, {
        title: editTitle,
        format: editFormat,
        description: editDescription,
      });
      const updated = {
        ...modalSlot,
        title: editTitle.trim(),
        formatKey: editFormat,
        format:
          PLAN_CONTENT_TYPES.find((t) => t.value === editFormat)?.label ||
          editFormat,
        description: editDescription.trim(),
      };
      setModalSlot(updated);
      setModalMode("view");
    } catch (err) {
      setSaveError(
        formatUserError(err, "Не удалось сохранить изменения. Попробуйте позже.")
      );
    } finally {
      setSaving(false);
    }
  };

  const submitManual = async (e) => {
    e.preventDefault();
    setTitleTouched(true);
    const titleErr = validatePlanTitle(newTitle);
    const formatErr = validatePlanFormat(newContentType);
    const scheduleErr = validatePlanSchedule({
      horizon,
      day: targetDay,
      week: targetWeek,
    });
    setScheduleError(scheduleErr);
    if (titleErr || formatErr || scheduleErr) return;

    const title = newTitle.trim();
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        title,
        description: newDescription,
        format: newContentType,
        horizon,
      };
      if (horizon === "week") {
        await addManualSlot({ ...payload, day: targetDay, week: 1 });
      } else {
        await addManualSlot({ ...payload, day: "Пн", week: targetWeek });
      }
      setNewTitle("");
      setNewDescription("");
      setNewContentType("post");
      setTitleTouched(false);
      setScheduleError("");
      setShowAddForm(false);
    } catch (err) {
      setSaveError(
        formatUserError(err, "Не удалось сохранить запись. Попробуйте позже.")
      );
    } finally {
      setSaving(false);
    }
  };

  if (planLoading && slots.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <DataLoading text="Loading..." />
      </div>
    );
  }

  if (planError && slots.length === 0) {
    return (
      <DataError message={planError} onRetry={refreshPlan} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Контент-план
          </h2>
          <p className="text-sm text-slate-500">
            Планируйте публикации по дням: Reels, Stories, посты и другой контент.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!previewMode && (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              + Добавить контент
            </button>
          )}
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

      {actionError && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {actionError}
        </p>
      )}

      {planError && slots.length > 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {planError}
        </p>
      )}

      {showAddForm && !previewMode && (
        <form
          onSubmit={submitManual}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Новая единица контента
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Запланируйте публикацию: укажите тип, тему и день выхода.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Тип контента <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={newContentType}
                onChange={(e) => setNewContentType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {PLAN_CONTENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Тема / заголовок <span className="text-rose-500">*</span>
              </label>
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onBlur={() => setTitleTouched(true)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                placeholder="Например: Закулисье съёмки Reels"
              />
              {titleTouched && titleInvalid && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  Поле не может быть пустым
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                О чём контент
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                placeholder="Кратко: идея, ключевой месседж, призыв к действию"
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
          {scheduleError && (
            <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">
              {scheduleError}
            </p>
          )}
          {saveError && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {saveError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || titleInvalid || formatInvalid}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : "Сохранить в план"}
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

      {slots.length === 0 && !planLoading && (
        <DataEmpty message="Контент-план пуст" />
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
              onDragOver={
                previewMode
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                      setDropTargetKey(dropKey);
                    }
              }
              onDragLeave={
                previewMode
                  ? undefined
                  : () => setDropTargetKey((k) => (k === dropKey ? null : k))
              }
              onDrop={
                previewMode
                  ? undefined
                  : async (e) => {
                      e.preventDefault();
                      setDropTargetKey(null);
                      const sourceId = e.dataTransfer.getData("text/plain");
                      if (!sourceId) return;
                      setActionError("");
                      try {
                        await copySlotToCell({
                          sourceId,
                          day: dropDay,
                          week: dropWeek,
                          horizon,
                        });
                      } catch (err) {
                        setActionError(
                          formatUserError(
                            err,
                            "Не удалось скопировать запись. Попробуйте позже."
                          )
                        );
                      }
                    }
              }
              className={`flex min-h-[160px] flex-col rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-2 transition dark:border-slate-700 dark:bg-slate-900/40 ${
                dropTargetKey === dropKey
                  ? "ring-2 ring-sky-500 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950"
                  : ""
              }`}
            >
              <div className="mb-2 text-xs font-semibold text-slate-500">
                <span>{day}</span>
              </div>
              {slotsInCell.map((slot) => (
                <div
                  key={slot.id}
                  className="mb-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex gap-2">
                    {!previewMode && (
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
                    )}
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => openModal(slot)}
                      >
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          {slot.format ? (
                            <Pill tone="sky">{slot.format}</Pill>
                          ) : null}
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
                      {!previewMode && (
                        <PlanCrudButtons
                          compact
                          deleting={deleteLoadingId === slot.id}
                          onEdit={() => openModal(slot, "edit")}
                          onDelete={() => handleDelete(slot.id)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {slotsInCell.length === 0 && (
                <p className="mt-auto text-[11px] text-slate-400">
                  {previewMode ? "Пусто" : "Перетащите карточку сюда"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <details className="group rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900 marker:content-none dark:text-white [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            <span>Сохранённые записи</span>
            <span className="text-xs font-normal text-slate-500">
              {slots.length} записей
            </span>
          </span>
        </summary>
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="mb-3 text-[11px] text-slate-500">
            {previewMode
              ? "Здесь будут все запланированные единицы контента после входа."
              : "Все запланированные единицы контента. Нажмите на запись, чтобы открыть подробности. Перетащите карточку в другой день, чтобы скопировать."}
          </p>
          <ul className="space-y-2">
            {slots.map((slot) => (
              <li
                key={`hist-${slot.id}`}
                className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex gap-2">
                  {!previewMode && (
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
                  )}
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 gap-2 text-left"
                    onClick={() => openModal(slot)}
                  >
                    {slot.thumbnail ? (
                      <img
                        src={slot.thumbnail}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                        {slot.format ? <Pill tone="sky">{slot.format}</Pill> : null}
                        <span>{slot.day}</span>
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
                  </button>
                  {!previewMode && (
                    <PlanCrudButtons
                      compact
                      deleting={deleteLoadingId === slot.id}
                      onEdit={() => openModal(slot, "edit")}
                      onDelete={() => handleDelete(slot.id)}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {modalSlot && (
        <PlanItemModal
          slot={modalSlot}
          mode={previewMode ? "view" : modalMode}
          editTitle={editTitle}
          editFormat={editFormat}
          editDescription={editDescription}
          editTitleTouched={editTitleTouched}
          onTitleBlur={() => setEditTitleTouched(true)}
          saving={saving}
          saveError={saveError}
          onClose={closeModal}
          onStartEdit={() => {
            setModalMode("edit");
            setEditTitle(modalSlot.title);
            setEditFormat(modalSlot.formatKey || "post");
            setEditDescription(modalSlot.description || "");
            setEditTitleTouched(false);
            setSaveError("");
          }}
          onCancelEdit={() => {
            setModalMode("view");
            setSaveError("");
          }}
          onEditTitle={setEditTitle}
          onEditFormat={setEditFormat}
          onEditDescription={setEditDescription}
          onSave={handleSaveEdit}
          onDelete={() => handleDelete(modalSlot.id)}
          deleting={deleteLoadingId === modalSlot.id}
          readOnly={previewMode}
        />
      )}
    </div>
  );
}

/* ---------- 7. Settings ---------- */

export function SettingsPage() {
  const { dark, toggleTheme } = useTheme();
  const { previewMode, userProfile, socialAccounts, loading, error, refresh } =
    useAppData();

  const instagramAccount = socialAccounts.find(
    (a) => a.platform === "instagram"
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <DataLoading />
      </div>
    );
  }

  if (error) {
    return <DataError message={error} onRetry={refresh} />;
  }

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
              readOnly={previewMode}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <input
              defaultValue={userProfile.handle}
              readOnly={previewMode}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={previewMode}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          {previewMode ? "Доступно после входа" : "Сохранить"}
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
                  {i === 0
                    ? instagramAccount
                      ? `Подключено · @${instagramAccount.username || userProfile.handle.replace("@", "")}`
                      : "Не подключено"
                    : "Не подключено"}
                </p>
              </div>
              <button
                type="button"
                disabled={previewMode}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
              >
                {previewMode
                  ? "После входа"
                  : i === 0
                    ? "Настроить"
                    : "Подключить"}
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
              <input
                type="checkbox"
                defaultChecked
                disabled={previewMode}
                className="h-4 w-4 disabled:cursor-not-allowed"
              />
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
  const { previewMode, loading, error, refresh, posts, getPostDetail } =
    useAppData();
  const { duplicateIdeaToPlan, generateFollowUp, followUpsByPost } = usePlan();
  const [toast, setToast] = useState(null);
  const [actionError, setActionError] = useState("");
  const basePath = previewMode ? "/preview" : "/app";

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <DataLoading />
      </div>
    );
  }

  if (error) {
    return <DataError message={error} onRetry={refresh} />;
  }

  const post = posts.find((p) => p.id === postId);
  const detail = getPostDetail(postId);

  if (!post || !detail) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <DataEmpty message="Пост не найден" />
        <Link to={basePath} className="mt-4 inline-block text-sky-600">
          В обзор
        </Link>
      </div>
    );
  }

  const followList = followUpsByPost[post.id] ?? [];

  const handleDuplicate = async () => {
    setActionError("");
    try {
      await duplicateIdeaToPlan(post);
      setToast("plan");
    } catch (e) {
      setActionError(
        formatUserError(e, "Не удалось добавить в контент-план.")
      );
    }
  };

  return (
    <div className="relative space-y-6">
      {actionError && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {actionError}
        </p>
      )}
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
        to={basePath}
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
            {!previewMode && (
              <>
                <button
                  type="button"
                  onClick={handleDuplicate}
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
              </>
            )}
            {previewMode && (
              <p className="mt-3 text-sm text-slate-500">
                Действия доступны после входа в аккаунт.
              </p>
            )}
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
