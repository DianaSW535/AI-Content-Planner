import { test, expect } from "@playwright/test";

import {

  ISOLATED_PREFIX,

  cleanupIsolatedPlanItems,

  createIsolatedPlanItem,

  goToContentPlan,

  isolatedPlanTitle,

  waitForIsolatedSavedRecord,

} from "../helpers/isolated-plan";

import { editIsolatedSavedRecord } from "../helpers/isolated-edit";



const PREFIX = ISOLATED_PREFIX["06"];



test.describe.configure({ timeout: 300_000 });



test.beforeEach(async ({ request }) => {

  await cleanupIsolatedPlanItems(request, PREFIX);

});



test.afterEach(async ({ request }) => {

  await cleanupIsolatedPlanItems(request, PREFIX);

});



test("Пользователь редактирует существующую публикацию, и изменения сохраняются на странице «Контент-план»", async ({

  page,

}) => {

  const originalTitle = isolatedPlanTitle("06", "До-редакт");

  const updatedTitle = isolatedPlanTitle("06", "После-редакт");



  await goToContentPlan(page);

  await createIsolatedPlanItem(page, { title: originalTitle });

  await waitForIsolatedSavedRecord(page, originalTitle);

  await editIsolatedSavedRecord(page, originalTitle, updatedTitle);



  await expect(page.getByText(originalTitle)).toHaveCount(0);

});


