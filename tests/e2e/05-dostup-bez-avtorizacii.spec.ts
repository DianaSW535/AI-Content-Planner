import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("Пользователь без авторизации не может получить доступ к защищённым данным приложения", async ({
  page,
}) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/app/plan");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/app/settings");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/preview/plan");
  await expect(page).toHaveURL(/\/preview\/plan/);
  await expect(page.getByText("Режим просмотра", { exact: true })).toBeVisible();
});
