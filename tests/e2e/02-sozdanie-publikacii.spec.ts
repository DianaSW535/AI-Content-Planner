import { test, expect } from "@playwright/test";
import { goToContentPlan } from "../helpers/auth";
import {
  createPlanItem,
  openSavedRecords,
  savedRecordItem,
  uniquePlanTitle,
} from "../helpers/plan";

test("Пользователь создаёт новую публикацию, и она появляется на странице «Контент-план»", async ({
  page,
}) => {
  const title = uniquePlanTitle("Создание");

  await goToContentPlan(page);
  await createPlanItem(page, { title });

  await openSavedRecords(page);
  await expect(savedRecordItem(page, title)).toBeVisible();
});
