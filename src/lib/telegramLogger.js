/** Логирование Telegram UI-операций (без chat_id и токенов). */

export function logTelegramRequest(operation, meta = {}) {
  if (import.meta.env.DEV) {
    console.info(`[telegram-ui] → ${operation}`, meta);
  }
}

export function logTelegramResponse(operation, meta = {}) {
  if (import.meta.env.DEV) {
    console.info(`[telegram-ui] ← ${operation}`, meta);
  }
}

export function logTelegramError(operation, err, meta = {}) {
  const message =
    err?.message ?? (typeof err === "string" ? err : "Unknown error");
  console.error(`[telegram-ui] ✗ ${operation}`, {
    ...meta,
    error: message,
  });
}
