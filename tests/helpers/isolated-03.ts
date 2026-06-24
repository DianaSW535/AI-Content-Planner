import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  fetchPersistedPlanItemId,
  isTitleOnActivePlan,
  reconcileItemToActivePlan,
  waitForPlanItemsGet,
} from "./isolated-plan";
import { openSavedRecords, todayWeekdayLabel } from "./plan";
import { stubBootstrapRoutes } from "./routes";

export const PREFIX_03 = "E2E-03";

export function plan03Title(label = "Мои-данные") {
  return `${PREFIX_03}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function supabaseRestUrl() {
  const raw = (process.env.VITE_SUPABASE_URL || "").trim();
  return raw.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
}

function supabaseAnonKey() {
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Задайте VITE_SUPABASE_ANON_KEY в .env");
  }
  return key;
}

function accessTokenFromStorageState() {
  const authPath = resolve("playwright/.auth/user.json");
  const state = JSON.parse(readFileSync(authPath, "utf-8")) as {
    origins?: { localStorage?: { name: string; value: string }[] }[];
  };

  for (const origin of state.origins ?? []) {
    for (const entry of origin.localStorage ?? []) {
      if (!entry.name.includes("auth-token")) continue;
      const parsed = JSON.parse(entry.value) as { access_token?: string };
      if (parsed.access_token) return parsed.access_token;
    }
  }
  return null;
}

async function deleteByTitlePrefix(
  request: APIRequestContext,
  prefix: string,
  headers: { apikey: string; Authorization: string },
  rest: string,
) {
  let listResponse = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      listResponse = await request.get(`${rest}/rest/v1/content_plan_items`, {
        headers,
        params: {
          select: "id",
          title: `ilike.${prefix}%`,
        },
      });
      if (listResponse.ok()) break;
    } catch {
      if (attempt === 2) return;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!listResponse?.ok()) return;

  const rows = (await listResponse.json()) as { id: string }[];
  if (!Array.isArray(rows) || rows.length === 0) return;

  for (const row of rows) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const deleteResponse = await request.delete(
          `${rest}/rest/v1/content_plan_items`,
          {
            headers,
            params: { id: `eq.${row.id}` },
          },
        );
        if (deleteResponse.ok()) break;
      } catch {
        // best-effort
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

/** Удаляет только записи с префиксом E2E-03 (не трогает 06/07 и «Создание-*»). */
export async function cleanup03PlanItems(request: APIRequestContext) {
  try {
    const token = accessTokenFromStorageState();
    if (!token) return;

    const rest = supabaseRestUrl();
    const headers = {
      apikey: supabaseAnonKey(),
      Authorization: `Bearer ${token}`,
    };

    await deleteByTitlePrefix(request, PREFIX_03, headers, rest);
  } catch {
    // best-effort
  }
}

function exactTitleLocator(page: Page, title: string) {
  return page.getByText(title, { exact: true });
}

function savedRecordWithExactTitle(page: Page, title: string) {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByText(title, { exact: true }) })
    .first();
}

async function titleVisibleOnPlan03(page: Page, title: string) {
  if ((await exactTitleLocator(page, title).count()) > 0) return true;
  try {
    await openSavedRecords(page);
    return (await savedRecordWithExactTitle(page, title).count()) > 0;
  } catch {
    return false;
  }
}

async function recoverPlanFetchError(page: Page) {
  const retry = page.getByRole("button", { name: "Повторить" });
  if (!(await retry.isVisible().catch(() => false))) return;

  const planGet = waitForPlanItemsGet(page, 30_000).catch(() => null);
  await retry.click();
  await planGet;
}

async function isPlanShellReady03(page: Page) {
  if (!/\/app\/plan/.test(page.url())) return false;
  if ((await page.locator("aside").getByText("Гость").count()) > 0) return false;

  if (
    await page
      .getByRole("button", { name: "+ Добавить контент" })
      .isVisible()
      .catch(() => false)
  ) {
    return true;
  }

  if (await page.getByText("Пн").first().isVisible().catch(() => false)) {
    return true;
  }

  return page
    .getByRole("heading", { name: "Контент-план" })
    .isVisible()
    .catch(() => false);
}

/** Переход на план без waitForPlanPageReady — устойчив к накоплению «Создание-*» после теста 02. */
export async function goToIsolated03Plan(page: Page) {
  await stubBootstrapRoutes(page);
  const planGet = waitForPlanItemsGet(page, 60_000).catch(() => null);
  await page.goto("/app/plan", { waitUntil: "domcontentloaded" });
  await planGet;

  await expect(page.locator("aside").getByText("Гость")).toHaveCount(0, {
    timeout: 60_000,
  });

  await recoverPlanFetchError(page);

  await expect
    .poll(async () => isPlanShellReady03(page), {
      timeout: 120_000,
      intervals: [1_000, 2_000, 3_000],
    })
    .toBe(true);

  await expect(page.getByRole("button", { name: "+ Добавить контент" })).toBeVisible({
    timeout: 60_000,
  });
}

async function openAddContentForm03(page: Page) {
  const addButton = page.getByRole("button", { name: "+ Добавить контент" });
  if (await addButton.isVisible().catch(() => false)) {
    await addButton.click();
    await expect(page.getByText("Новая единица контента")).toBeVisible();
    return;
  }

  await expect
    .poll(async () => isPlanShellReady03(page), { timeout: 60_000 })
    .toBe(true);
  await recoverPlanFetchError(page);
  await addButton.click();
  await expect(page.getByText("Новая единица контента")).toBeVisible();
}

async function waitFor03ItemPersisted(page: Page, title: string) {
  await expect
    .poll(
      async () => {
        await recoverPlanFetchError(page);

        const id = await fetchPersistedPlanItemId(page, title);
        if (id) await reconcileItemToActivePlan(page, title);

        if (await titleVisibleOnPlan03(page, title)) return "ui";

        if (id) {
          const planGet = waitForPlanItemsGet(page, 12_000).catch(() => null);
          await page.getByRole("link", { name: "Контент-план" }).click().catch(() => null);
          await planGet;
        }

        return "";
      },
      { timeout: 120_000, intervals: [500, 1_000, 2_000, 3_000] },
    )
    .not.toBe("");

  await expect
    .poll(async () => titleVisibleOnPlan03(page, title), {
      timeout: 60_000,
      intervals: [1_000, 2_000, 3_000],
    })
    .toBe(true);
}

export async function createIsolated03PlanItem(
  page: Page,
  {
    title,
    day = todayWeekdayLabel(),
    description = "",
  }: { title: string; day?: string; description?: string },
) {
  if (await page.getByText("Новая единица контента").isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Отмена" }).click();
    await expect(page.getByText("Новая единица контента")).toBeHidden({
      timeout: 15_000,
    });
  }

  const addButton = page.getByRole("button", { name: "+ Добавить контент" });
  if (await addButton.isVisible().catch(() => false)) {
    await addButton.click();
    await expect(page.getByText("Новая единица контента")).toBeVisible();
  } else {
    await openAddContentForm03(page);
  }

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
      res.request().method() === "POST" &&
      res.ok(),
    { timeout: 120_000 },
  );
  const planRefresh = waitForPlanItemsGet(page, 120_000);
  await form.getByRole("button", { name: "Сохранить в план" }).click();

  await Promise.race([
    saveResponse,
    page
      .getByRole("button", { name: "Saving..." })
      .waitFor({ state: "hidden", timeout: 120_000 }),
  ]).catch(() => null);
  await planRefresh.catch(() => null);

  if (await page.getByText("Новая единица контента").isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Отмена" }).click().catch(() => null);
  }
  if (await page.getByText("Новая единица контента").isVisible().catch(() => false)) {
    const planGet = waitForPlanItemsGet(page, 45_000).catch(() => null);
    await page.getByRole("link", { name: "Контент-план" }).click();
    await planGet;
  }

  await waitFor03ItemPersisted(page, title);
}

/** Возврат с /preview/plan на /app/plan — только URL и сессия; UI добирает waitForIsolatedTitleAfterPreview. */
export async function returnToAppPlanAfterPreview(page: Page) {
  await stubBootstrapRoutes(page);
  const planGet = waitForPlanItemsGet(page, 60_000).catch(() => null);
  await page.goto("/app/plan", { waitUntil: "domcontentloaded" });
  await planGet;

  await expect(page.locator("aside").getByText("Гость")).toHaveCount(0, {
    timeout: 60_000,
  });
}

export async function assertExactTitleOnPlan(page: Page, title: string) {
  if ((await exactTitleLocator(page, title).count()) > 0) {
    await expect(exactTitleLocator(page, title).first()).toBeVisible({
      timeout: 15_000,
    });
    return;
  }

  await openSavedRecords(page);
  await expect(savedRecordWithExactTitle(page, title)).toBeVisible({
    timeout: 30_000,
  });
}

export { isTitleOnActivePlan, reconcileItemToActivePlan, fetchPersistedPlanItemId };
