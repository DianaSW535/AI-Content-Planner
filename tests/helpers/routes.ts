import type { Page } from "@playwright/test";

const stubbedPages = new WeakSet<Page>();

/** Ускоряет bootstrap: loadAll не блокируется на post_analytics. */
export async function stubBootstrapRoutes(page: Page) {
  if (stubbedPages.has(page)) return;
  stubbedPages.add(page);

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

export async function waitForGetResponse(
  page: Page,
  urlPart: string,
  timeout = 90_000,
) {
  return page.waitForResponse(
    (res) =>
      res.url().includes(urlPart) &&
      res.request().method() === "GET" &&
      res.ok(),
    { timeout },
  );
}
