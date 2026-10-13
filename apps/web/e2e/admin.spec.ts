import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { PASSWORD, signUp, uniqueEmail } from './helpers';

test.use({ locale: 'en-US' });

/** Runs `flowbit admin …` against the e2e database, as an operator would on the server. */
function flowbit(...args: string[]) {
  return execFileSync('node', ['../api/dist/scripts/cli.js', ...args], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env['E2E_DATABASE_URL'] ??
        'postgresql://flowbit:flowbit@localhost:5432/flowbit_test',
      AUTH_SECRET: 'e2e-test-secret-e2e-test-secret-e2e-test',
      PUBLIC_URL: 'http://localhost:3100',
    },
    encoding: 'utf8',
  });
}

test('an administrator suspends an account and creates a reset link', async ({ page, browser }) => {
  const adminEmail = await signUp(page, 'Ada Admin', uniqueEmail('admin'));
  expect(flowbit('admin', 'grant', adminEmail)).toContain('is now an instance administrator');

  const context = await browser.newContext({ locale: 'en-US' });
  const user = await context.newPage();
  const userEmail = await signUp(user, 'Sam Suspended', uniqueEmail('sam'));

  await page.goto('/');
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Administration' }).click();
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  await expect(page.getByText('Accounts', { exact: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Accounts' }).click();
  await page.getByLabel('Search by name or email').fill(userEmail);
  const row = page.getByRole('listitem').filter({ hasText: userEmail });
  await expect(row).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await row.getByRole('button', { name: 'Actions for Sam Suspended' }).click();
  await page.getByRole('menuitem', { name: 'Suspend' }).click();
  await expect(row.getByText('Suspended', { exact: true })).toBeVisible();

  // The suspended person is signed out and can't sign back in.
  await user.reload();
  await expect(user).toHaveURL(/\/sign-in/);
  await user.getByLabel('Email').fill(userEmail);
  await user.getByLabel('Password').fill(PASSWORD);
  await user.getByRole('button', { name: 'Sign in' }).click();
  await expect(user.getByText('This account is suspended')).toBeVisible();
  await context.close();

  await row.getByRole('button', { name: 'Actions for Sam Suspended' }).click();
  await page.getByRole('menuitem', { name: 'Create password reset link' }).click();
  const link = page.getByRole('textbox', { name: 'Create password reset link' });
  await expect(link).toHaveValue(/\/reset-password\?token=/);
  await page.keyboard.press('Escape');

  await page.getByRole('tab', { name: 'Activity log' }).click();
  // The e2e database is shared between runs, so earlier entries can be listed too.
  await expect(page.getByText(`Ada Admin suspended Sam Suspended`).first()).toBeVisible();
});

test('non-administrators are sent away from the admin page', async ({ page }) => {
  await signUp(page);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/$/);
});
