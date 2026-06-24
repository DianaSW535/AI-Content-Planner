import { expect, type Page } from "@playwright/test";
import { openSavedRecords } from "./plan";
import { stubBootstrapRoutes } from "./routes";
import {
  fetchPersistedPlanItemId,
  isTitleOnActivePlan,
  reconcileItemToActivePlan,
  waitForPlanItemsGet,
} from "./isolated-plan";

function isPlanItemsGet(res: {
  url: () => string;
  request: () => { method: () => string };
  ok: () => boolean;
}) {
  return (
    res.url().includes("/rest/v1/content_plan_items") &&
    res.request().method() === "GET" &&
    res.ok()
  );
}

async function planGetIncludesTitle(res: {
  json: () => Promise<unknown>;
}, title: string) {
  try {
    const body = (await res.json()) as { title?: string }[];
    return Array.isArray(body) && body.some((row) => row.title === title);
  } catch {
    return false;
  }
}

function listenForPlanItemsGetWithTitle(page: Page, title: string, timeout = 20_000) {
  return page
    .waitForResponse(
      async (res) => isPlanItemsGet(res) && (await planGetIncludesTitle(res, title)),
      { timeout },
    )
    .catch(() => null);
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

async function isPlanShellReady(page: Page) {
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

async function isPlanLoading(page: Page) {
  return page
    .locator("main")
    .getByText("Loading...", { exact: true })
    .isVisible()
    .catch(() => false);
}

async function recoverFromPlanLoading(page: Page, title: string) {
  if (!(await isPlanLoading(page))) return;

  await stubBootstrapRoutes(page);
  const titledGet = listenForPlanItemsGetWithTitle(page, title, 30_000);
  const anyGet = waitForPlanItemsGet(page, 30_000).catch(() => null);
  await page.getByRole("link", { name: "Контент-план" }).click();
  await Promise.race([titledGet, anyGet]);
}

async function resyncPlanUiAfterReconcile(page: Page, title: string) {
  await reconcileItemToActivePlan(page, title);
  if (!(await isTitleOnActivePlan(page, title))) return false;
  if (await titleVisibleOnPlan(page, title)) return true;

  await stubBootstrapRoutes(page);
  const titledGet = listenForPlanItemsGetWithTitle(page, title, 45_000);
  const anyGet = waitForPlanItemsGet(page, 45_000).catch(() => null);
  await page.goto("/app/plan", { waitUntil: "domcontentloaded" });
  await Promise.race([titledGet, anyGet]);
  await expect(page.locator("aside").getByText("Гость")).toHaveCount(0, {
    timeout: 60_000,
  });

  await recoverFromPlanLoading(page, title);
  return titleVisibleOnPlan(page, title);
}

async function titleVisibleOnPlan(page: Page, title: string) {
  if ((await exactTitleLocator(page, title).count()) > 0) return true;
  try {
    await openSavedRecords(page);
    return (await savedRecordWithExactTitle(page, title).count()) > 0;
  } catch {
    return false;
  }
}

async function assertTitleOnPlan(page: Page, title: string) {
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

async function openContentPlanViaNav(page: Page, title: string) {
  await stubBootstrapRoutes(page);
  const planGet = listenForPlanItemsGetWithTitle(page, title);
  const anyPlanGet = waitForPlanItemsGet(page, 15_000).catch(() => null);
  await page.getByRole("link", { name: "Контент-план" }).click();
  await Promise.race([planGet, anyPlanGet]);
}

/** После /preview/plan ждём запись по API/UI, не привязываясь к скрытию Loading. */
export async function waitForIsolatedTitleAfterPreview(page: Page, title: string) {
  await expect(page).toHaveURL(/\/app\/plan/);
  await expect(page.locator("aside").getByText("Гость")).toHaveCount(0, {
    timeout: 60_000,
  });

  await expect
    .poll(async () => fetchPersistedPlanItemId(page, title), { timeout: 60_000 })
    .not.toBeNull();

  await reconcileItemToActivePlan(page, title);

  await expect
    .poll(
      async () => {
        if (await resyncPlanUiAfterReconcile(page, title)) return true;

        await recoverFromPlanLoading(page, title);

        if (await titleVisibleOnPlan(page, title)) return true;

        const onActivePlan = await isTitleOnActivePlan(page, title);
        if (onActivePlan || (await isPlanShellReady(page)) || (await isPlanLoading(page))) {
          await openContentPlanViaNav(page, title);
        }

        if (await titleVisibleOnPlan(page, title)) return true;

        if (onActivePlan) {
          if (await resyncPlanUiAfterReconcile(page, title)) return true;
          const got = await listenForPlanItemsGetWithTitle(page, title, 15_000);
          if (got && (await titleVisibleOnPlan(page, title))) return true;
        }

        return false;
      },
      { timeout: 120_000, intervals: [800, 1_500, 2_500, 4_000] },
    )
    .toBe(true);

  await assertTitleOnPlan(page, title);
}
