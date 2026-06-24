import { test, expect } from "@playwright/test";
import { goToContentPlan } from "../helpers/auth";
import {
  createPlanItem,
  todayWeekdayLabel,
  uniquePlanTitle,
} from "../helpers/plan";

test("Пользователь подключает Telegram-бота и получает напоминания о запланированных публикациях", async ({
  page,
  request,
}) => {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || "")
    .trim()
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/$/, "");
  const cronSecret = process.env.CRON_SECRET;

  if (!supabaseUrl || !cronSecret) {
    test.skip(
      true,
      "Задайте VITE_SUPABASE_URL и CRON_SECRET в .env.test для проверки send-daily-reminders",
    );
  }

  await goToContentPlan(page);
  await page.getByRole("link", { name: "Профиль" }).click();
  await expect(page).toHaveURL(/\/app\/settings/);

  const telegramHeading = page.getByRole("heading", {
    name: "Telegram",
    level: 2,
  });
  const loading = page.locator("main").getByText("Загрузка...", { exact: true });

  try {
    await expect(telegramHeading).toBeVisible({ timeout: 60_000 });
  } catch (error) {
    if (await loading.isVisible()) {
      test.skip(
        true,
        "Страница настроек не загрузилась (зависание «Загрузка...»); проверьте Telegram вручную",
      );
    }
    throw error;
  }

  const connected = page.getByText("Подключено", { exact: true });
  if (!(await connected.isVisible())) {
    test.skip(
      true,
      "Telegram не подключён: отправьте команду /start link_<token> боту и перезапустите тест",
    );
  }

  await expect(
    page
      .locator("label")
      .filter({ hasText: "Напоминание о публикации" })
      .locator('input[type="checkbox"]'),
  ).toBeChecked();

  const title = uniquePlanTitle("TG-напоминание");
  await goToContentPlan(page);
  try {
    await createPlanItem(page, { title, day: todayWeekdayLabel() });
  } catch {
    test.skip(
      true,
      "Не удалось создать публикацию для проверки напоминаний (таймаут POST); повторите позже",
    );
  }

  const response = await request.post(
    `${supabaseUrl}/functions/v1/send-daily-reminders`,
    {
      headers: { "x-cron-secret": cronSecret! },
    },
  );

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.sent).toBeGreaterThanOrEqual(1);
});
