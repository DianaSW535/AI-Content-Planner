import { test, expect } from "@playwright/test";
import { login } from "../helpers/auth";
import { openAddContentForm, waitForPlanPageReady } from "../helpers/plan";
import { goToContentPlan } from "../helpers/auth";

test.use({ storageState: { cookies: [], origins: [] } });

test("Пользователь не может отправить форму с пустыми обязательными полями и получает сообщение об ошибке", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Введите email")).toBeVisible();
  await expect(page.getByText("Введите пароль")).toBeVisible();

  await login(page);
  await goToContentPlan(page);
  await openAddContentForm(page);

  const titleInput = page.getByPlaceholder("Например: Закулисье съёмки Reels");
  await titleInput.focus();
  await titleInput.blur();
  await expect(page.getByText("Поле не может быть пустым")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Сохранить в план" }),
  ).toBeDisabled();
});
