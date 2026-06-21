/** Логирование Supabase Auth (подтверждение email, сброс пароля). */

function maskEmail(email) {
  const v = String(email ?? "").trim();
  if (!v || !v.includes("@")) return undefined;
  const [local, domain] = v.split("@");
  const head = local.length > 1 ? `${local[0]}***` : "***";
  return `${head}@${domain}`;
}

function pickError(err) {
  if (!err) return null;
  return {
    message: err.message,
    code: err.code,
    status: err.status,
  };
}

/** Исходящий auth-запрос. */
export function logAuthRequest(operation, meta = {}) {
  const payload = { ...meta };
  if (payload.email) payload.email = maskEmail(payload.email);
  if (import.meta.env.DEV) {
    console.info(`[auth] → ${operation}`, payload);
  }
}

/** Успешный ответ auth-запроса (без токенов). */
export function logAuthResponse(operation, meta = {}) {
  if (import.meta.env.DEV) {
    console.info(`[auth] ← ${operation}`, meta);
  }
}

/** Ошибка auth-запроса — всегда в консоль. */
export function logAuthError(operation, err, meta = {}) {
  console.error(`[auth] ✗ ${operation}`, {
    ...meta,
    error: pickError(err),
  });
}
