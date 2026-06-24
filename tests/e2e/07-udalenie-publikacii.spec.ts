import { test, expect } from "@playwright/test";

import {

  ISOLATED_PREFIX,

  cleanupIsolatedPlanItems,

  createIsolatedPlanItem,

  goToContentPlan,

  isolatedPlanTitle,

} from "../helpers/isolated-plan";

import {
  deleteIsolatedSavedRecord,
  assertTitleAbsentInSavedRecords,
  waitForIsolatedSavedRecord,
} from "../helpers/isolated-delete";



const PREFIX = ISOLATED_PREFIX["07"];



test.describe.configure({ timeout: 360_000 });



test.beforeEach(async ({ request }) => {

  await cleanupIsolatedPlanItems(request, PREFIX);

});



test.afterEach(async ({ request }) => {

  await cleanupIsolatedPlanItems(request, PREFIX);

});



test("Пользователь удаляет публикацию, и она исчезает из списка на странице «Контент-план»", async ({

  page,

}) => {

  const title = isolatedPlanTitle("07", "Удаление");



  await goToContentPlan(page);

  await createIsolatedPlanItem(page, { title });

  await waitForIsolatedSavedRecord(page, title);

  await deleteIsolatedSavedRecord(page, title);

  await assertTitleAbsentInSavedRecords(page, title);

});


