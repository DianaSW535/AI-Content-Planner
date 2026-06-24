import { expect, type Page } from "@playwright/test";
import { stubBootstrapRoutes, waitForGetResponse } from "./routes";

export function testCredentials() {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Задайте TEST_USER_EMAIL и TEST_USER_PASSWORD в файле .env.test",
    );
  }
  return { email, password };
}

/** Оболочка приложения после входа (без ожидания загрузки аналитики). */
export async function waitForAuthenticatedApp(page: Page) {
  await expect(page).toHaveURL(/\/app(\/|$)/, { timeout: 60_000 });
  await expect(page.getByText("Рабочая область")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("aside").getByText("Гость")).toHaveCount(0);
}

export async function login(page: Page) {
  const { email, password } = testCredentials();

  await stubBootstrapRoutes(page);
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Мин. 8 символов, буква и цифра").fill(password);

  const authResponse = page
    .waitForResponse(
      (res) =>
        res.url().includes("/auth/v1/token") &&
        res.request().method() === "POST",
      { timeout: 60_000 },
    )
    .catch(() => null);

  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/app(\/|$)/, { timeout: 60_000 });
  await authResponse;

  await waitForAuthenticatedApp(page);
  await expect(page.getByRole("heading", { name: "Обзор", level: 1 })).toBeVisible({
    timeout: 60_000,
  });
}

/** Страница «Контент-план» загружена и готова к действиям. */
export async function waitForPlanPageReady(page: Page) {
  await expect(page).toHaveURL(/\/app\/plan/);
  await expect(
    page.getByRole("heading", { name: "Контент-план", level: 2 }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    page.locator("main").getByText("Loading...", { exact: true }),
  ).toBeHidden({ timeout: 90_000 });
  await expect(
    page.getByRole("button", { name: "+ Добавить контент" }),
  ).toBeVisible();
  await expect(page.getByText(/\d+ записей/)).toBeVisible();
}

/** После /preview/plan сначала скрывается Loading, затем появляется разметка плана. */
export async function waitForContentPlanAfterPreview(page: Page) {
  await expect(page).toHaveURL(/\/app\/plan/);
  await expect(page.locator("aside").getByText("Гость")).toHaveCount(0, {
    timeout: 60_000,
  });
  await expect(
    page.locator("main").getByText("Loading...", { exact: true }),
  ).toBeHidden({ timeout: 120_000 });
  await expect(
    page.getByRole("heading", { name: "Контент-план", level: 2 }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole("button", { name: "+ Добавить контент" }),
  ).toBeVisible();
}

export async function goToContentPlan(page: Page) {
  await stubBootstrapRoutes(page);

  const planItemsResponse = waitForGetResponse(
    page,
    "/rest/v1/content_plan_items",
    20_000,
  ).catch(() => null);

  await page.goto("/app/plan");
  await planItemsResponse;
  await waitForPlanPageReady(page);
}
