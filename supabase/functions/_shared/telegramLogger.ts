/** Логирование Telegram Bot API (Edge Functions). */

function maskChatId(chatId: number | string | null | undefined) {
  if (chatId == null) return undefined;
  const s = String(chatId);
  if (s.length <= 4) return "***";
  return `***${s.slice(-4)}`;
}

function pickTelegramError(body: Record<string, unknown> | null) {
  if (!body) return null;
  return {
    ok: body.ok,
    error_code: body.error_code,
    description: body.description,
  };
}

export function logTelegramRequest(
  operation: string,
  meta: Record<string, unknown> = {},
) {
  const payload = { ...meta };
  if ("chatId" in payload) payload.chatId = maskChatId(payload.chatId as number);
  console.info(`[telegram] → ${operation}`, payload);
}

export function logTelegramResponse(
  operation: string,
  meta: Record<string, unknown> = {},
) {
  console.info(`[telegram] ← ${operation}`, meta);
}

export function logTelegramError(
  operation: string,
  err: unknown,
  meta: Record<string, unknown> = {},
) {
  const error =
    err && typeof err === "object"
      ? pickTelegramError(err as Record<string, unknown>)
      : { message: String(err) };
  console.error(`[telegram] ✗ ${operation}`, { ...meta, error });
}
