import { expect, type Page } from '@playwright/test';

export function uniqueEmail(prefix = 'user') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export const PASSWORD = 'correct-horse-battery';

export async function signUp(page: Page, name = 'Ann Lee', email = uniqueEmail()) {
  await page.goto('/sign-up');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your first workspace' })).toBeVisible();
  return email;
}

/** Signs up, creates a workspace and a board, and opens the board. */
export async function openNewBoard(page: Page, boardName = 'Roadmap') {
  await signUp(page);
  await page.getByLabel('Workspace name').fill('Team');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.getByRole('button', { name: 'Create board' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Board name').fill(boardName);
  await dialog.getByRole('button', { name: 'Create board' }).click();
  await expect(page).toHaveURL(/\/b\/[0-9a-f-]{36}$/);
}

export async function addLists(page: Page, names: string[]) {
  await page.getByRole('button', { name: /Add (a|another) list/ }).click();
  for (const name of names) {
    await page.getByPlaceholder('List name').fill(name);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name })).toBeVisible();
  }
  await page.keyboard.press('Escape');
}

export async function addCards(page: Page, list: string, titles: string[]) {
  const column = page.getByRole('region', { name: list });
  await column.getByRole('button', { name: 'Add a card' }).click();
  for (const title of titles) {
    await column.getByPlaceholder('Enter a title for this card…').fill(title);
    await page.keyboard.press('Enter');
    await expect(column.getByRole('link', { name: `Open card: ${title}` })).toBeVisible();
  }
  await page.keyboard.press('Escape');
}

/** Card titles in a list, in display order. */
export function cardTitles(page: Page, list: string) {
  return page
    .getByRole('region', { name: list })
    .getByRole('link', { name: /^Open card: / })
    .evaluateAll((links) => links.map((link) => link.textContent?.trim() ?? ''));
}
