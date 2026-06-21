import { formatReminderMessage, sendTelegramMessage } from "../_shared/telegramApi.ts";
import { logTelegramError, logTelegramRequest, logTelegramResponse } from "../_shared/telegramLogger.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";

type ReminderRow = {
  item_id: string;
  title: string;
  scheduled_date: string;
  telegram_chat_id: number;
};

function verifyCronSecret(req: Request): boolean {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) return true;
  const header = req.headers.get("x-cron-secret");
  return header === expected;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!verifyCronSecret(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  logTelegramRequest("send-daily-reminders", {});

  let sent = 0;
  let failed = 0;

  try {
    const admin = createAdminClient();

    const { data: rows, error: queryErr } = await admin.rpc(
      "get_telegram_reminders_for_today",
    );

    if (queryErr) {
      logTelegramError("send-daily-reminders/query", queryErr);
      return new Response(JSON.stringify({ error: "Query failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const items = (rows ?? []) as ReminderRow[];

    for (const item of items) {
      const text = formatReminderMessage(item.scheduled_date, item.title);
      const result = await sendTelegramMessage(item.telegram_chat_id, text);

      if (!result.ok) {
        failed += 1;
        continue;
      }

      const { error: markErr } = await admin.from("telegram_reminders_sent").insert({
        content_plan_item_id: item.item_id,
        scheduled_date: item.scheduled_date,
      });

      if (markErr) {
        logTelegramError("send-daily-reminders/markSent", markErr, {
          itemId: item.item_id,
        });
        failed += 1;
        continue;
      }

      sent += 1;
    }

    logTelegramResponse("send-daily-reminders", {
      total: items.length,
      sent,
      failed,
    });

    return new Response(
      JSON.stringify({ total: items.length, sent, failed }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    logTelegramError("send-daily-reminders", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
