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
