import { test, expect } from "@playwright/test";
import { login } from "../helpers/auth";

test.use({ storageState: { cookies: [], origins: [] } });

test("Пользователь входит в аккаунт и попадает на главную страницу приложения", async ({
  page,
}) => {
  await login(page);

  await expect(page.getByText("Рабочая область")).toBeVisible();
  await expect(page.locator("aside").getByText("Гость")).toHaveCount(0);
});
