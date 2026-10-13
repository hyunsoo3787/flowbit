import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

test.use({ locale: 'en-US' });

test('a new user creates, renames and deletes a workspace', async ({ page }) => {
  await signUp(page);

  await page.getByLabel('Workspace name').fill('Marketing');
  await page.getByLabel('Description').fill('Campaigns and launches');
  await page.getByRole('button', { name: 'Create workspace' }).click();

  await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible();
  await expect(page.getByText('Campaigns and launches')).toBeVisible();

  await page.getByRole('button', { name: 'Workspace settings' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Workspace name').fill('Growth');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Growth' })).toBeVisible();

  await page.getByRole('button', { name: 'Workspace settings' }).click();
  await dialog.getByRole('button', { name: 'Delete workspace' }).click();
  await expect(dialog.getByText('Delete “Growth”?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete workspace' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Create your first workspace' })).toBeVisible();
});

test('the switcher lists workspaces and opens a new one', async ({ page }) => {
  await signUp(page);
  await page.getByLabel('Workspace name').fill('Alpha');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Alpha' })).toBeVisible();

  await page.getByRole('button', { name: 'Alpha' }).click();
  await page.getByRole('menuitem', { name: 'Create workspace' }).click();
  await page.getByRole('dialog').getByLabel('Workspace name').fill('Beta');
  await page.getByRole('dialog').getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Beta' })).toBeVisible();

  await page.getByRole('button', { name: 'Beta' }).click();
  await page.getByRole('menuitem', { name: 'Alpha' }).click();
  await expect(page.getByRole('heading', { name: 'Alpha' })).toBeVisible();
});

test("another user's workspace is not reachable", async ({ page, browser }) => {
  await signUp(page);
  await page.getByLabel('Workspace name').fill('Private');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Private' })).toBeVisible();
  const url = page.url();

  const other = await browser.newPage({ locale: 'en-US' });
  await signUp(other, 'Bob');
  await other.goto(url);
  await expect(
    other.getByText("This workspace doesn't exist, or you don't have access to it."),
  ).toBeVisible();
  await other.close();
});
