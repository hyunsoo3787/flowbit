import { expect, test } from '@playwright/test';
import { PASSWORD, signUp } from './helpers';

test.describe('in English', () => {
  test.use({ locale: 'en-US' });

  test('protected pages redirect to sign-in and come back afterwards', async ({ page }) => {
    const email = await signUp(page);
    await page.getByLabel('Workspace name').fill('Ops');
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Ops' })).toBeVisible();
    const workspaceUrl = new URL(page.url()).pathname;

    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.goto(workspaceUrl);
    await expect(page).toHaveURL(/\/sign-in\?redirect=/);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(new RegExp(`${workspaceUrl}$`));
    await expect(page.getByRole('heading', { name: 'Ops' })).toBeVisible();
  });

  test('shows a clear error for a wrong password', async ({ page }) => {
    const email = await signUp(page);
    await page.context().clearCookies();

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.');
  });

  test('validates the sign-up form before submitting', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('This field is required.')).toHaveCount(2);
    await expect(page.getByText('Use at least 8 characters.')).toBeVisible();
  });
});

test.describe('in Korean', () => {
  test.use({ locale: 'ko-KR' });

  test("follows the browser's language and keeps it on the account", async ({ page }) => {
    await page.goto('/sign-up');
    await expect(page.getByRole('heading', { name: '계정 만들기' })).toBeVisible();

    await page.getByLabel('이름').fill('김현수');
    await page.getByLabel('이메일').fill(`ko-${Date.now()}@example.com`);
    await page.getByLabel('비밀번호').fill(PASSWORD);
    await page.getByRole('button', { name: '계정 만들기' }).click();
    await expect(
      page.getByRole('heading', { name: '첫 워크스페이스를 만들어 보세요' }),
    ).toBeVisible();

    const me = await page.request.get('/api/v1/me');
    expect(await me.json()).toMatchObject({ locale: 'ko' });
  });

  test('can switch to English before signing in', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: '언어' }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in to Flowbit' })).toBeVisible();
  });
});
