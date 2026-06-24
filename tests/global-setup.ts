import { chromium, type FullConfig } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

async function stubBootstrapRoutes(page: import("@playwright/test").Page) {
  await page.route("**/rest/v1/post_analytics**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || "http://localhost:5173";
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("Задайте TEST_USER_EMAIL и TEST_USER_PASSWORD в .env.test");
  }

  const authDir = resolve("playwright/.auth");
  if (!existsSync(authDir)) mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await stubBootstrapRoutes(page);

  await page.goto(`${baseURL}/login`);
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

  await Promise.all([
    page.waitForURL(/\/app(\/|$)/, { timeout: 60_000 }),
    page.getByRole("button", { name: "Войти" }).click(),
  ]);
  await authResponse;

  await page.getByRole("heading", { name: "Обзор", level: 1 }).waitFor({
    timeout: 60_000,
  });

  await page.context().storageState({ path: resolve(authDir, "user.json") });
  await browser.close();
}
