import { sendTelegramMessage } from "../_shared/telegramApi.ts";
import { logTelegramError, logTelegramRequest, logTelegramResponse } from "../_shared/telegramLogger.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";

const LINK_PREFIX = "link_";

function extractStartPayload(update: Record<string, unknown>): {
  chatId: number | null;
  token: string | null;
  text: string;
} {
  const message = update.message as Record<string, unknown> | undefined;
  if (!message) return { chatId: null, token: null, text: "" };

  const chat = message.chat as { id?: number } | undefined;
  const chatId = chat?.id ?? null;
  const text = String(message.text ?? "").trim();
  if (!text.startsWith("/start")) return { chatId, token: null, text };

  const parts = text.split(/\s+/);
  const payload = parts.slice(1).find((part) => part.startsWith(LINK_PREFIX)) ?? "";
  if (!payload.startsWith(LINK_PREFIX)) {
    return { chatId, token: null, text };
  }

  return { chatId, token: payload.slice(LINK_PREFIX.length), text };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return new Response("ok", { status: 200 });
  }

  const { chatId, token, text } = extractStartPayload(update);
  if (!chatId) {
    return new Response("ok", { status: 200 });
  }

  if (!token) {
    if (text.startsWith("/start")) {
      logTelegramRequest("telegram-webhook", { chatId, text, hasToken: false });
      await sendTelegramMessage(
        chatId,
        "Чтобы подключить уведомления, нажмите «Подключить» в настройках приложения и откройте ссылку на бота.",
      );
    }
    return new Response("ok", { status: 200 });
  }

  logTelegramRequest("telegram-webhook", { hasToken: true, chatId, text });

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: row, error: findErr } = await admin
      .from("user_telegram")
      .select("user_id, link_token_expires_at, is_connected")
      .eq("link_token", token)
      .maybeSingle();

    if (findErr) {
      logTelegramError("telegram-webhook/find", findErr);
      await sendTelegramMessage(
        chatId,
        "Не удалось подключить Telegram. Попробуйте снова из настроек приложения.",
      );
      return new Response("ok", { status: 200 });
    }

    if (!row || row.link_token_expires_at < now) {
      logTelegramError("telegram-webhook", { message: "Invalid or expired token" });
      await sendTelegramMessage(
        chatId,
        "Ссылка устарела. Откройте настройки в приложении и подключите Telegram заново.",
      );
      return new Response("ok", { status: 200 });
    }

    const { error: updateErr } = await admin
      .from("user_telegram")
      .update({
        telegram_chat_id: chatId,
        is_connected: true,
        reminders_enabled: true,
        linked_at: now,
        link_token: null,
        link_token_expires_at: null,
      })
      .eq("user_id", row.user_id);

    if (updateErr) {
      logTelegramError("telegram-webhook/update", updateErr);
      await sendTelegramMessage(chatId, "Не удалось сохранить привязку. Попробуйте позже.");
      return new Response("ok", { status: 200 });
    }

    await sendTelegramMessage(
      chatId,
      "✅ Telegram подключён.\n\nВы будете получать напоминания о публикациях из контент-плана.",
    );

    logTelegramResponse("telegram-webhook", { userId: row.user_id, connected: true });
  } catch (err) {
    logTelegramError("telegram-webhook", err);
  }

  return new Response("ok", { status: 200 });
});
