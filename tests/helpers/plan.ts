import { expect, type Page } from "@playwright/test";
import { waitForPlanPageReady } from "./auth";

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function uniquePlanTitle(prefix = "E2E") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function todayWeekdayLabel() {
  const d = new Date();
  const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return DAY_LABELS[idx];
}

export { waitForPlanPageReady };

async function recoverFromFetchError(page: Page) {
  const retry = page.getByRole("button", { name: "Повторить" });
  if (!(await retry.isVisible().catch(() => false))) return false;

  const planGet = page
    .waitForResponse(
      (res) =>
        res.url().includes("/rest/v1/content_plan_items") &&
        res.request().method() === "GET" &&
        res.ok(),
      { timeout: 30_000 },
    )
    .catch(() => null);
  await retry.click();
  await planGet;
  return true;
}

export async function openAddContentForm(page: Page) {
  await waitForPlanPageReady(page);
  await page.getByRole("button", { name: "+ Добавить контент" }).click();
  await expect(page.getByText("Новая единица контента")).toBeVisible();
}

export async function createPlanItem(
  page: Page,
  {
    title,
    day = todayWeekdayLabel(),
    description = "",
  }: { title: string; day?: string; description?: string },
) {
  await openAddContentForm(page);
  await recoverFromFetchError(page);
  const form = page.locator("form").filter({ hasText: "Новая единица контента" });
  await form
    .getByPlaceholder("Например: Закулисье съёмки Reels")
    .fill(title);
  if (description) {
    await form
      .getByPlaceholder(
        "Кратко: идея, ключевой месседж, призыв к действию",
      )
      .fill(description);
  }
  await form.locator("select").nth(1).selectOption(day);

  const saveResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/rest/v1/content_plan_items") &&
      res.request().method() === "POST",
    { timeout: 120_000 },
  );
  const planRefresh = page
    .waitForResponse(
      (res) =>
        res.url().includes("/rest/v1/content_plan_items") &&
        res.request().method() === "GET" &&
        res.ok(),
      { timeout: 120_000 },
    )
    .catch(() => null);

  await form.getByRole("button", { name: "Сохранить в план" }).click();

  const response = await saveResponse.catch(() => null);
  if (response) {
    expect(
      response.ok(),
      `POST content_plan_items завершился с ${response.status()}`,
    ).toBeTruthy();
  }

  await planRefresh;

  await expect
    .poll(
      async () => {
        await recoverFromFetchError(page);
        if ((await page.getByText(title).count()) > 0) return true;
        try {
          await openSavedRecords(page);
          return (await page.getByRole("listitem").filter({ hasText: title }).count()) > 0;
        } catch {
          return false;
        }
      },
      { timeout: 90_000, intervals: [1_000, 2_000, 3_000] },
    )
    .toBe(true);

  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
}

export async function openSavedRecords(page: Page) {
  const details = page.locator("details").filter({ hasText: "Сохранённые записи" });
  const isOpen = await details.evaluate((el) => el.hasAttribute("open"));
  if (!isOpen) {
    await details.locator("summary").click();
  }
  await expect(details).toHaveAttribute("open", "");
}

export function savedRecordItem(page: Page, title: string) {
  return page.getByRole("listitem").filter({ hasText: title }).first();
}
