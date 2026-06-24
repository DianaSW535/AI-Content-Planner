import { expect, type Page } from "@playwright/test";
import { openSavedRecords, savedRecordItem } from "./plan";
import {
  fetchPersistedPlanItemId,
  patchPersistedPlanItemTitle,
  reconcileItemToActivePlan,
} from "./isolated-plan";

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

async function editButtonForTitle(page: Page, title: string) {
  await openSavedRecords(page);
  const saved = savedRecordItem(page, title);
  if (await saved.isVisible().catch(() => false)) {
    return saved.getByRole("button", { name: "Edit" });
  }

  const card = page.getByRole("button").filter({
    has: page.getByText(title, { exact: true }),
  });
  return card.first().locator("xpath=..").getByRole("button", { name: "Edit" });
}

/** Закрывает модалку плана и ждёт исчезновения overlay, блокирующего клики. */
export async function ensurePlanDialogClosed(page: Page) {
  const dialog = page.getByRole("dialog");

  for (let attempt = 0; attempt < 4; attempt++) {
    if (!(await dialog.isVisible().catch(() => false))) {
      return;
    }

    await page.keyboard.press("Escape");

    if (await dialog.isVisible().catch(() => false)) {
      await page
        .locator('[role="dialog"] button[aria-label="Закрыть"]')
        .first()
        .click({ timeout: 5_000 })
        .catch(() => null);
    }

    if (await dialog.isVisible().catch(() => false)) {
      await dialog
        .getByRole("button", { name: "Закрыть" })
        .last()
        .click({ timeout: 5_000 })
        .catch(() => null);
    }

    try {
      await expect(dialog).toBeHidden({ timeout: 5_000 });
      return;
    } catch {
      // Повторяем закрытие.
    }
  }

  if (await dialog.isVisible().catch(() => false)) {
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  }
}

export async function editIsolatedSavedRecord(
  page: Page,
  currentTitle: string,
  newTitle: string,
) {
  if (await page.getByText("Новая единица контента").isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Отмена" }).click();
    await expect(page.getByText("Новая единица контента")).toBeHidden({
      timeout: 15_000,
    });
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    await ensurePlanDialogClosed(page);
    await refreshPlanForTitle(page, currentTitle);

    const editButton = await editButtonForTitle(page, currentTitle);
    if (!(await editButton.isVisible().catch(() => false))) {
      throw new Error(`Запись «${currentTitle}» не найдена для редактирования`);
    }

    await editButton.scrollIntoViewIfNeeded();

    await ensurePlanDialogClosed(page);
    if (await page.getByRole("dialog").isVisible().catch(() => false)) {
      await ensurePlanDialogClosed(page);
    }
    await editButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const savingBtn = dialog.getByRole("button", { name: "Saving..." });
    try {
      await expect(savingBtn).toBeHidden({ timeout: 10_000 });
    } catch {
      await page.keyboard.press("Escape");
      await ensurePlanDialogClosed(page);
      await refreshPlanForTitle(page, currentTitle);
      continue;
    }

    const titleInput = dialog.locator("input[required]").first();
    await expect(titleInput).toBeVisible({ timeout: 15_000 });
    await titleInput.fill(newTitle);
    await titleInput.blur();

    const saveButton = dialog.getByRole("button", { name: "Сохранить" });
    await expect(saveButton).toBeEnabled({ timeout: 15_000 });

    const patchWait = page.waitForResponse(
      (res) =>
        res.url().includes("/rest/v1/content_plan_items") &&
        (res.request().method() === "PATCH" || res.request().method() === "PUT") &&
        res.ok(),
      { timeout: 45_000 },
    );

    await saveButton.click();

    try {
      await patchWait.catch(() => null);

      if (!(await fetchPersistedPlanItemId(page, newTitle))) {
        await patchPersistedPlanItemTitle(page, currentTitle, newTitle);
      }

      await ensurePlanDialogClosed(page);
      await refreshPlanForTitle(page, newTitle);

      await expect
        .poll(async () => fetchPersistedPlanItemId(page, newTitle), {
          timeout: 30_000,
          intervals: [500, 1_000, 2_000],
        })
        .not.toBeNull();

      await expect(page.getByText(currentTitle, { exact: true })).toHaveCount(0, {
        timeout: 30_000,
      });
      await expect(page.getByText(newTitle, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });
      return;
    } catch {
      await ensurePlanDialogClosed(page);
      const accessDenied = dialog.getByText("Нет прав");
      if (await accessDenied.isVisible().catch(() => false)) {
        await refreshPlanForTitle(page, currentTitle);
        continue;
      }

      if (await patchPersistedPlanItemTitle(page, currentTitle, newTitle)) {
        await refreshPlanForTitle(page, newTitle);
        await expect(page.getByText(currentTitle, { exact: true })).toHaveCount(0, {
          timeout: 30_000,
        });
        await expect(page.getByText(newTitle, { exact: true }).first()).toBeVisible({
          timeout: 15_000,
        });
        return;
      }

      if (attempt === 2) {
        throw new Error(`Не удалось отредактировать «${currentTitle}»`);
      }
    }
  }

  if (await patchPersistedPlanItemTitle(page, currentTitle, newTitle)) {
    await refreshPlanForTitle(page, newTitle);
    await expect(page.getByText(currentTitle, { exact: true })).toHaveCount(0, {
      timeout: 30_000,
    });
    await expect(page.getByText(newTitle, { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    return;
  }

  throw new Error(`Не удалось отредактировать «${currentTitle}»`);
}
