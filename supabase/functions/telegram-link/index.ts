import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { logTelegramError, logTelegramRequest, logTelegramResponse } from "../_shared/telegramLogger.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";

const LINK_TTL_MINUTES = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Требуется авторизация" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  const botUsername = Deno.env.get("TELEGRAM_BOT_USERNAME");

  if (!supabaseUrl || !supabaseAnon) {
    logTelegramError("telegram-link", { message: "Supabase env missing" });
    return jsonResponse({ error: "Сервис временно недоступен" }, 500);
  }

  if (!botUsername) {
    logTelegramError("telegram-link", { message: "TELEGRAM_BOT_USERNAME missing" });
    return jsonResponse({ error: "Telegram-бот не настроен" }, 500);
  }

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    logTelegramError("telegram-link/getUser", userErr);
    return jsonResponse({ error: "Требуется авторизация" }, 401);
  }

  const userId = userData.user.id;
  const linkToken = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000).toISOString();

  logTelegramRequest("telegram-link", { userId });

  try {
    const admin = createAdminClient();
    const { error: upsertErr } = await admin.from("user_telegram").upsert(
      {
        user_id: userId,
        link_token: linkToken,
        link_token_expires_at: expiresAt,
      },
      { onConflict: "user_id" },
    );

    if (upsertErr) {
      logTelegramError("telegram-link/upsert", upsertErr);
      return jsonResponse({ error: "Не удалось подготовить привязку" }, 500);
    }

    const deepLink = `https://t.me/${botUsername}?start=link_${linkToken}`;
    logTelegramResponse("telegram-link", { userId, hasDeepLink: true });
    return jsonResponse({ deepLink, expiresAt });
  } catch (err) {
    logTelegramError("telegram-link", err);
    return jsonResponse({ error: "Не удалось подготовить привязку" }, 500);
  }
});
