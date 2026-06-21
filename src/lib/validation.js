/** Общие правила валидации для auth и контент-плана. */

const PLAN_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const PLAN_FORMATS = ["reels", "stories", "post", "carousel", "podcast", "other"];

export function validateAuthEmail(value) {
  const v = String(value ?? "").trim();
  if (!v) return "Введите email";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Некорректный email";
  return "";
}

export function validateAuthPassword(value) {
  if (!value) return "Введите пароль";
  if (value.length < 8) return "Минимум 8 символов";
  if (!/[A-Za-zА-Яа-яЁё]/.test(value) || !/\d/.test(value)) {
    return "Нужны хотя бы одна буква и одна цифра";
  }
  return "";
}

export function validateAuthName(value) {
  if (!String(value ?? "").trim()) return "Введите имя";
  return "";
}

export function validatePasswordConfirm(password, confirm) {
  if (!confirm) return "Подтвердите пароль";
  if (password !== confirm) return "Пароли не совпадают";
  return "";
}

export function validatePlanTitle(title) {
  if (!String(title ?? "").trim()) return "Поле не может быть пустым";
  return "";
}

export function validatePlanFormat(format) {
  if (!format || !PLAN_FORMATS.includes(format)) return "Выберите тип контента";
  return "";
}

export function validatePlanSchedule({ horizon, day, week }) {
  if (horizon === "week") {
    if (!day || !PLAN_DAYS.includes(day)) return "Укажите день публикации";
  } else if (!week || week < 1 || week > 4) {
    return "Укажите неделю публикации";
  }
  return "";
}

export function trimText(value) {
  return String(value ?? "").trim();
}

/** Единая проверка перед insert в content_plan_items. */
export function validatePlanItemInsert({
  title,
  format,
  horizon,
  day,
  week,
  scheduled_date,
}) {
  const titleErr = validatePlanTitle(title);
  if (titleErr) return titleErr;
  const formatErr = validatePlanFormat(format);
  if (formatErr) return formatErr;
  const scheduleErr = validatePlanSchedule({ horizon, day, week });
  if (scheduleErr) return scheduleErr;
  if (!scheduled_date) return "Укажите дату публикации";
  return "";
}

/** Сообщение при отказе RLS / HTTP 403 (требование задания). */
export const ACCESS_DENIED_MESSAGE = "Нет прав";

function isAccessDeniedError(err) {
  if (!err || typeof err !== "object") return false;
  if (err.code === "42501") return true;
  if (err.status === 403) return true;

  const msg = String(err.message ?? "").toLowerCase();
  if (!msg) return false;

  return (
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("violates row-level security") ||
    msg.includes("insufficient privilege") ||
    msg.includes("нет доступа к этой записи")
  );
}

/** Понятное сообщение для UI из Error или ответа Supabase. */
export function formatUserError(err, fallback = "Произошла ошибка. Попробуйте позже.") {
  if (!err) return fallback;
  if (typeof err === "string") {
    const s = err.trim();
    if (!s) return fallback;
    if (isAccessDeniedError({ message: s })) return ACCESS_DENIED_MESSAGE;
    return s;
  }

  if (isAccessDeniedError(err)) return ACCESS_DENIED_MESSAGE;

  const msg = String(err.message ?? "").trim();
  if (!msg) return fallback;

  if (isAccessDeniedError({ message: msg })) return ACCESS_DENIED_MESSAGE;

  const lower = msg.toLowerCase();

  if (
    err.code === "email_not_confirmed" ||
    lower.includes("email not confirmed")
  ) {
    return "Подтвердите email по ссылке из письма";
  }

  if (
    err.code === "over_email_send_rate_limit" ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  ) {
    return "Слишком много попыток. Попробуйте позже";
  }

  if (
    err.code === "user_already_registered" ||
    lower.includes("already registered") ||
    lower.includes("already been registered")
  ) {
    return "Этот email уже используется";
  }

  if (
    err.code === "otp_expired" ||
    (lower.includes("expired") &&
      (lower.includes("token") || lower.includes("link"))) ||
    lower.includes("invalid flow state") ||
    lower.includes("auth session missing")
  ) {
    return "Ссылка недействительна или устарела. Запросите новую";
  }

  if (
    lower.includes("content_plan_items_title_not_blank") ||
    (lower.includes("check constraint") && lower.includes("title"))
  ) {
    return "Заголовок не может быть пустым.";
  }

  if (
    lower.includes("invalid input value for enum") ||
    lower.includes("post_format")
  ) {
    return "Выберите корректный тип контента.";
  }

  if (lower.includes("null value") && lower.includes("scheduled_date")) {
    return "Укажите дату публикации.";
  }

  if (lower.includes("null value") && lower.includes("title")) {
    return "Поле не может быть пустым";
  }

  if (lower.includes("display_name is required")) {
    return "Введите имя";
  }

  if (lower.includes("jwt") || lower.includes("not authenticated")) {
    return "Войдите в аккаунт, чтобы продолжить.";
  }

  if (
    lower.includes("telegram") &&
    (lower.includes("not configured") || lower.includes("не настроен"))
  ) {
    return "Telegram-бот не настроен. Обратитесь к администратору.";
  }

  // Сообщения валидации приложения и Supabase Auth — показываем как есть
  return msg;
}
