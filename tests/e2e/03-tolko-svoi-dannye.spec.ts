import { test, expect } from "@playwright/test";

import {
  cleanup03PlanItems,
  createIsolated03PlanItem,
  goToIsolated03Plan,
  plan03Title,
  returnToAppPlanAfterPreview,
  assertExactTitleOnPlan,
} from "../helpers/isolated-03";
import { waitForIsolatedTitleAfterPreview } from "../helpers/isolated-preview";

test.describe.configure({ timeout: 360_000 });

test.beforeEach(async ({ request }) => {
  await cleanup03PlanItems(request);
});

test.afterEach(async ({ request }) => {
  await cleanup03PlanItems(request);
});

test("Пользователь просматривает список своих публикаций и видит только свои данные", async ({
  page,
}) => {
  const title = plan03Title();

  await goToIsolated03Plan(page);
  await createIsolated03PlanItem(page, { title });

  await assertExactTitleOnPlan(page, title);

  await page.goto("/preview/plan");
  await expect(page.getByText("Режим просмотра", { exact: true })).toBeVisible();
  await expect(page.locator("aside").getByText("Гость")).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  await returnToAppPlanAfterPreview(page);
  await waitForIsolatedTitleAfterPreview(page, title);
});
