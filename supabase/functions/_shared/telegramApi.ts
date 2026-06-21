import {
  logTelegramError,
  logTelegramRequest,
  logTelegramResponse,
} from "./telegramLogger.ts";

export type TelegramSendResult =
  | { ok: true; messageId?: number }
  | { ok: false; errorCode?: number; description?: string };

export async function sendTelegramMessage(
  chatId: number,
  text: string,
): Promise<TelegramSendResult> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) {
    logTelegramError("sendMessage", { message: "TELEGRAM_BOT_TOKEN is not set" });
    return { ok: false, description: "Bot token is not configured" };
  }

  logTelegramRequest("sendMessage", { chatId });

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      },
    );

    const body = await res.json().catch(() => null);

    if (!res.ok || !body?.ok) {
      logTelegramError("sendMessage", body ?? { status: res.status }, {
        httpStatus: res.status,
      });
      return {
        ok: false,
        errorCode: body?.error_code ?? res.status,
        description: body?.description ?? res.statusText,
      };
    }

    logTelegramResponse("sendMessage", {
      messageId: body.result?.message_id,
    });
    return { ok: true, messageId: body.result?.message_id };
  } catch (err) {
    logTelegramError("sendMessage", err);
    return {
      ok: false,
      description: err instanceof Error ? err.message : "Network error",
    };
  }
}

export function formatReminderMessage(
  scheduledDate: string,
  title: string,
): string {
  const [y, m, d] = scheduledDate.split("-");
  const dateLabel = d && m && y ? `${d}.${m}.${y}` : scheduledDate;
  return (
    `📅 Напоминание о публикации\n\n` +
    `Дата: ${dateLabel}\n` +
    `Тема: ${title}\n\n` +
    `AI Content Planner`
  );
}
