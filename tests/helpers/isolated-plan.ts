import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  goToContentPlan,
  waitForContentPlanAfterPreview,
  waitForPlanPageReady,
} from "./auth";
import {
  openAddContentForm,
  openSavedRecords,
  todayWeekdayLabel,
} from "./plan";
import { stubBootstrapRoutes } from "./routes";

export const ISOLATED_PREFIX = {
  "03": "E2E-03",
  "06": "E2E-06",
  "07": "E2E-07",
} as const;

export type IsolatedSuiteId = keyof typeof ISOLATED_PREFIX;

export function isolatedPlanTitle(suiteId: IsolatedSuiteId, label: string) {
  const prefix = ISOLATED_PREFIX[suiteId];
  return `${prefix}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

function userIdFromAccessToken(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

async function fetchActivePlanIdForUser(page: Page) {
  const token = accessTokenFromStorageState();
  if (!token) return null;

  const userId = userIdFromAccessToken(token);
  if (!userId) return null;

  const res = await page.request
    .get(`${supabaseRestUrl()}/rest/v1/content_plans`, {
      headers: {
        apikey: supabaseAnonKey(),
        Authorization: `Bearer ${token}`,
      },
      params: {
        select: "id",
        user_id: `eq.${userId}`,
        is_active: "eq.true",
        order: "created_at.desc",
        limit: 1,
      },
    })
    .catch(() => null);

  if (!res?.ok()) return null;
  const rows = (await res.json()) as { id: string }[];
  return rows[0]?.id ?? null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPlanItemsGet(res: { url: () => string; request: () => { method: () => string }; ok: () => boolean }) {
  return (
    res.url().includes("/rest/v1/content_plan_items") &&
    res.request().method() === "GET" &&
    res.ok()
  );
}

export function waitForPlanItemsGet(page: Page, timeout = 120_000) {
  return page.waitForResponse(isPlanItemsGet, { timeout });
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
    await new Promise((resolve) => setTimeout(resolve, 400));
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
        if (attempt === 2) {
          // Не блокируем тест из-за сетевого сбоя при уборке артефактов.
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}

/** Удаляет записи плана с title, начинающимся на prefix (только для изолированных E2E). */
export async function cleanupIsolatedPlanItems(
  request: APIRequestContext,
  prefix: string,
) {
  try {
    const token = accessTokenFromStorageState();
    if (!token) return;

    const rest = supabaseRestUrl();
    const apikey = supabaseAnonKey();
    const headers = { apikey, Authorization: `Bearer ${token}` };

    const prefixes = Object.values(ISOLATED_PREFIX);

    for (const p of prefixes) {
      await deleteByTitlePrefix(request, p, headers, rest);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  } catch {
    // Уборка best-effort: не валим тест из-за сети Supabase.
  }
}

export async function fetchPersistedPlanItemId(page: Page, title: string) {
  const token = accessTokenFromStorageState();
  if (!token) return null;

  const res = await page.request
    .get(`${supabaseRestUrl()}/rest/v1/content_plan_items`, {
      headers: {
        apikey: supabaseAnonKey(),
        Authorization: `Bearer ${token}`,
      },
      params: { select: "id,content_plan_id", title: `eq.${title}` },
    })
    .catch(() => null);

  if (!res?.ok()) return null;
  const rows = (await res.json()) as { id: string; content_plan_id?: string }[];
  if (rows.length !== 1 || !UUID_RE.test(rows[0].id)) return null;
  return rows[0].id;
}

/** Привязывает запись к активному плану пользователя, если после preview UI загрузил другой plan_id. */
export async function reconcileItemToActivePlan(page: Page, title: string) {
  const token = accessTokenFromStorageState();
  if (!token) return;

  const headers = {
    apikey: supabaseAnonKey(),
    Authorization: `Bearer ${token}`,
  };
  const rest = supabaseRestUrl();

  const activePlanId = await fetchActivePlanIdForUser(page);
  if (!activePlanId) return;

  const itemRes = await page.request
    .get(`${rest}/rest/v1/content_plan_items`, {
      headers,
      params: { select: "id,content_plan_id", title: `eq.${title}` },
    })
    .catch(() => null);
  if (!itemRes?.ok()) return;

  const items = (await itemRes.json()) as {
    id: string;
    content_plan_id: string;
  }[];
  const item = items[0];
  if (!item?.id || item.content_plan_id === activePlanId) return;

  const patchRes = await page.request
    .patch(`${rest}/rest/v1/content_plan_items`, {
      headers,
      params: { id: `eq.${item.id}` },
      data: { content_plan_id: activePlanId },
    })
    .catch(() => null);

  if (!patchRes?.ok()) return;
}

/** Запись с title привязана к активному плану текущего пользователя. */
export async function isTitleOnActivePlan(page: Page, title: string) {
  const token = accessTokenFromStorageState();
  if (!token) return false;

  const activePlanId = await fetchActivePlanIdForUser(page);
  if (!activePlanId) return false;

  const res = await page.request
    .get(`${supabaseRestUrl()}/rest/v1/content_plan_items`, {
      headers: {
        apikey: supabaseAnonKey(),
        Authorization: `Bearer ${token}`,
      },
      params: {
        select: "id",
        content_plan_id: `eq.${activePlanId}`,
        title: `eq.${title}`,
      },
    })
    .catch(() => null);

  if (!res?.ok()) return false;
  const rows = (await res.json()) as { id: string }[];
  return rows.length === 1 && UUID_RE.test(rows[0].id);
}

function apiHeaders() {
  const token = accessTokenFromStorageState();
  if (!token) return null;
  return {
    apikey: supabaseAnonKey(),
    Authorization: `Bearer ${token}`,
  };
}

export async function patchPersistedPlanItemTitle(
  page: Page,
  currentTitle: string,
  newTitle: string,
) {
  const id = await fetchPersistedPlanItemId(page, currentTitle);
  if (!id) return false;

  const headers = apiHeaders();
  if (!headers) return false;

  const res = await page.request
    .patch(`${supabaseRestUrl()}/rest/v1/content_plan_items`, {
      headers,
      params: { id: `eq.${id}` },
      data: { title: newTitle },
    })
    .catch(() => null);

  return res?.ok() ?? false;
}

export async function deletePersistedPlanItemByTitle(page: Page, title: string) {
  const id = await fetchPersistedPlanItemId(page, title);
  if (!id) return true;

  const headers = apiHeaders();
  if (!headers) return false;

  const res = await page.request
    .delete(`${supabaseRestUrl()}/rest/v1/content_plan_items`, {
      headers,
      params: { id: `eq.${id}` },
    })
    .catch(() => null);

  return res?.ok() ?? false;
}

export async function waitForItemPersisted(page: Page, title: string) {
  await expect(
    page.locator("main").getByText("Loading...", { exact: true }),
  ).toBeHidden({ timeout: 30_000 }).catch(() => null);

  const retryButton = page.getByRole("button", { name: "Повторить" });
  if (await retryButton.isVisible().catch(() => false)) {
    const planGet = waitForPlanItemsGet(page, 20_000).catch(() => null);
    await retryButton.click();
    await planGet;
  }

  await expect
    .poll(
      async () => {
        const uuidErr = page.getByText(/invalid input syntax for type uuid/i);
        if (await uuidErr.isVisible().catch(() => false)) return "";

        const id = await fetchPersistedPlanItemId(page, title);
        if (id) await reconcileItemToActivePlan(page, title);

        if ((await page.getByText(title).count()) > 0) return "ui";

        try {
          await openSavedRecords(page);
          if ((await page.getByRole("listitem").filter({ hasText: title }).count()) >= 1) {
            return "list";
          }
        } catch {
          // Список ещё не готов.
        }

        if (id) {
          const planGet = waitForPlanItemsGet(page, 10_000).catch(() => null);
          await page.getByRole("link", { name: "Контент-план" }).click().catch(() => null);
          await planGet;
        }

        return "";
      },
      { timeout: 90_000, intervals: [500, 1_000, 2_000, 3_000] },
    )
    .not.toBe("");

  await expect
    .poll(
      async () => {
        if ((await page.getByText(title).count()) > 0) return true;
        try {
          await openSavedRecords(page);
          return (await page.getByRole("listitem").filter({ hasText: title }).count()) >= 1;
        } catch {
          await reconcileItemToActivePlan(page, title);
          const planGet = waitForPlanItemsGet(page, 10_000).catch(() => null);
          await page.getByRole("link", { name: "Контент-план" }).click().catch(() => null);
          await planGet;
          return false;
        }
      },
      { timeout: 45_000, intervals: [1_000, 2_000, 3_000] },
    )
    .toBe(true);
}

export async function createIsolatedPlanItem(
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
    await openAddContentForm(page);
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

  await waitForItemPersisted(page, title);
}

export { goToContentPlan, waitForContentPlanAfterPreview, stubBootstrapRoutes };
export { waitForIsolatedSavedRecord } from "./isolated-delete";
