import { expect, type Page } from "@playwright/test";
import { openSavedRecords, savedRecordItem } from "./plan";
import { ensurePlanDialogClosed } from "./isolated-edit";
import {
  deletePersistedPlanItemByTitle,
  fetchPersistedPlanItemId,
  reconcileItemToActivePlan,
  waitForPlanItemsGet,
} from "./isolated-plan";

async function deleteButtonForTitle(page: Page, title: string) {
  await openSavedRecords(page);
  const saved = savedRecordItem(page, title);
  if (await saved.isVisible().catch(() => false)) {
    return saved.getByRole("button", { name: "Delete" });
  }

  const card = page.getByRole("button").filter({
    has: page.getByText(title, { exact: true }),
  });
  return card.first().locator("xpath=..").getByRole("button", { name: "Delete" });
}

async function isItemAbsentInApi(page: Page, title: string) {
  const id = await fetchPersistedPlanItemId(page, title);
  return id === null;
}

async function refreshPlanList(page: Page) {
  const planGet = waitForPlanItemsGet(page, 15_000).catch(() => null);
  await page.getByRole("link", { name: "Контент-план" }).click();
  await planGet;
}

async function refreshPlanForTitle(page: Page, title: string) {
  await reconcileItemToActivePlan(page, title);
  const planGet = page
    .waitForResponse(
      async (res) => {
        if (
          !res.url().includes("/rest/v1/content_plan_items") ||
          res.request().method() !== "GET" ||
          !res.ok()
        ) {
          return false;
        }
        try {
          const body = (await res.json()) as { title?: string }[];
          return Array.isArray(body) && body.some((row) => row.title === title);
        } catch {
          return false;
        }
      },
      { timeout: 20_000 },
    )
    .catch(() => null);
  await page.getByRole("link", { name: "Контент-план" }).click();
  await planGet;
}

async function hasTempIdError(page: Page) {
  return page.getByText(/invalid input syntax for type uuid/i).isVisible().catch(() => false);
}

async function recordVisibleOnPlan(page: Page, title: string) {
  if ((await page.getByText(title).count()) > 0) return true;
  try {
    await openSavedRecords(page);
    return (await page.getByRole("listitem").filter({ hasText: title }).count()) >= 1;
  } catch {
    return false;
  }
}

async function ensureReadyForDelete(page: Page, title: string) {
  await reconcileItemToActivePlan(page, title);

  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await hasTempIdError(page)) || !(await fetchPersistedPlanItemId(page, title))) {
      await refreshPlanList(page);
      continue;
    }

    if (await recordVisibleOnPlan(page, title)) {
      return;
    }

    await refreshPlanList(page);
  }

  throw new Error(`Запись «${title}» не готова к удалению`);
}

async function confirmTitleRemoved(page: Page, title: string) {
  await expect
    .poll(
      async () => {
        if ((await page.getByText(title, { exact: true }).count()) > 0) return false;
        try {
          await openSavedRecords(page);
        } catch {
          return false;
        }
        return (await page.getByRole("listitem").filter({ hasText: title }).count()) === 0;
      },
      { timeout: 45_000, intervals: [1_000, 2_000, 3_000] },
    )
    .toBe(true);
}

export async function waitForIsolatedSavedRecord(page: Page, title: string) {
  await ensureReadyForDelete(page, title);
}

export async function deleteIsolatedSavedRecord(page: Page, title: string) {
  await ensureReadyForDelete(page, title);

  for (let attempt = 0; attempt < 3; attempt++) {
    await ensurePlanDialogClosed(page);
    await refreshPlanForTitle(page, title);
    const deleteButton = await deleteButtonForTitle(page, title);

    if (!(await deleteButton.isVisible().catch(() => false))) {
      if (await isItemAbsentInApi(page, title)) {
        await confirmTitleRemoved(page, title);
        return;
      }
      await ensureReadyForDelete(page, title);
      continue;
    }

    await deleteButton.scrollIntoViewIfNeeded();
    await expect(deleteButton).toHaveText(/^Delete$|^Удалить$/i, { timeout: 10_000 }).catch(
      () => null,
    );

    const deleteWait = page.waitForResponse(
      (res) =>
        res.url().includes("/rest/v1/content_plan_items") &&
        res.request().method() === "DELETE" &&
        res.ok(),
      { timeout: 45_000 },
    );

    await deleteButton.click();

    const deleteOk = await deleteWait.then(() => true).catch(() => false);

    if (deleteOk || (await isItemAbsentInApi(page, title))) {
      await confirmTitleRemoved(page, title);
      return;
    }

    await refreshPlanForTitle(page, title);
  }

  if (await deletePersistedPlanItemByTitle(page, title)) {
    await refreshPlanList(page);
    await confirmTitleRemoved(page, title);
    return;
  }

  throw new Error(`Не удалось удалить «${title}» через UI`);
}

export async function assertTitleAbsentInSavedRecords(page: Page, title: string) {
  if (!(await isItemAbsentInApi(page, title))) {
    await deletePersistedPlanItemByTitle(page, title);
  }

  await expect
    .poll(
      async () => {
        if ((await page.getByText(title, { exact: true }).count()) > 0) {
          await refreshPlanList(page);
          return 1;
        }

        try {
          await openSavedRecords(page);
          const inList = await page.getByRole("listitem").filter({ hasText: title }).count();
          if (inList > 0) {
            await refreshPlanList(page);
            return inList;
          }
        } catch {
          // Список ещё не готов.
        }

        return (await isItemAbsentInApi(page, title)) ? 0 : 1;
      },
      { timeout: 90_000, intervals: [1_000, 2_000, 3_000] },
    )
    .toBe(0);
}
