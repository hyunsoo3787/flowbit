import { expect, test } from '@playwright/test';
import { addCards, addLists, openNewBoard, signUp, uniqueEmail } from './helpers';

test.use({ locale: 'en-US' });

test('adds labels, dates, a checklist and a comment to a card', async ({ page }) => {
  await openNewBoard(page);
  await addLists(page, ['To do']);
  await addCards(page, 'To do', ['Write docs']);
  await page.getByRole('link', { name: 'Open card: Write docs' }).click();
  const dialog = page.getByRole('dialog');

  // A label, renamed on the way.
  await dialog.getByRole('button', { name: 'Labels' }).click();
  const labels = page.locator('[data-slot="popover-content"]');
  await labels.getByRole('button', { name: 'Edit label Red' }).click();
  await labels.getByLabel('Title').fill('Urgent');
  await labels.getByRole('button', { name: 'Save changes' }).click();
  await labels.getByRole('menuitemcheckbox', { name: 'Urgent' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog.getByTitle('Urgent')).toBeVisible();

  // A due date, then marked complete.
  await dialog.getByRole('button', { name: 'Dates' }).click();
  await page.getByLabel('Due date').fill('2030-01-15T10:00');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog.getByText('Jan 15, 2030')).toBeVisible();
  await dialog.getByRole('checkbox', { name: 'Mark the due date complete' }).click();
  await expect(dialog.getByText('Complete', { exact: true })).toBeVisible();

  // A checklist with two items, one done.
  await dialog.getByRole('button', { name: 'Checklist' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add an item' }).click();
  for (const item of ['Outline', 'Draft']) {
    await dialog.getByPlaceholder('Add an item').fill(item);
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('checkbox', { name: item })).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await dialog.getByRole('checkbox', { name: 'Outline' }).click();
  await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');

  // A comment that mentions someone, picked from the suggestions.
  const comment = dialog.getByRole('textbox', { name: 'Write a comment' });
  await comment.fill('Thanks @An');
  await page.getByRole('option', { name: 'Ann Lee' }).click();
  await comment.press('End');
  await comment.pressSequentially('for the **outline**');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    dialog.locator('li').filter({ hasText: 'Thanks @Ann Lee for the outline' }),
  ).toBeVisible();
  await expect(dialog.locator('strong', { hasText: 'outline' })).toBeVisible();

  // The board shows it all as badges.
  await dialog.getByRole('button', { name: 'Close' }).click();
  const tile = page.getByRole('link', { name: 'Open card: Write docs' });
  await expect(tile.getByText('Urgent')).toBeVisible();
  await expect(tile.getByText('1/2')).toBeVisible();
  await expect(tile.getByText('1 comment')).toBeAttached();
});

test('filters cards by keyword and label, kept in the URL', async ({ page }) => {
  await openNewBoard(page);
  await addLists(page, ['To do']);
  await addCards(page, 'To do', ['Fix login', 'Write docs', 'Plan launch']);

  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByLabel('Keyword').fill('docs');
  await expect(page.getByRole('link', { name: /^Open card: / })).toHaveCount(1);
  await expect(page.getByText('2 cards hidden by the filter')).toBeVisible();
  await expect(page).toHaveURL(/q=docs/);

  // The filter survives a reload and opening a card.
  await page.reload();
  await expect(page.getByRole('link', { name: /^Open card: / })).toHaveCount(1);
  await page.getByRole('link', { name: 'Open card: Write docs' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(/q=docs/);

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('link', { name: /^Open card: / })).toHaveCount(3);
});

test('invites a new person to a board with a link', async ({ page, browser }) => {
  await openNewBoard(page, 'Shared plan');
  const boardUrl = page.url();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page.getByRole('tab', { name: 'Invite' }).click();
  await page.getByRole('button', { name: 'Create link' }).click();
  const link = await page.getByRole('textbox', { name: 'Invite with a link' }).inputValue();
  expect(link).toMatch(/\/invite\//);

  const context = await browser.newContext({ locale: 'en-US' });
  const guest = await context.newPage();
  await guest.goto(link);
  await expect(
    guest.getByRole('heading', { name: 'Ann Lee invited you to Shared plan' }),
  ).toBeVisible();
  await guest.getByRole('link', { name: 'Create an account to accept' }).click();
  await guest.getByLabel('Name').fill('Bob Guest');
  await guest.getByLabel('Email').fill(uniqueEmail('guest'));
  await guest.getByLabel('Password').fill('correct-horse-battery');
  await guest.getByRole('button', { name: 'Create account' }).click();
  await guest.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(guest).toHaveURL(boardUrl);
  await expect(guest.getByRole('heading', { name: 'Shared plan' })).toBeVisible();
  await context.close();

  // The owner sees the new member.
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Bob Guest')).toBeVisible();
});

test('shows the workspace members', async ({ page }) => {
  await signUp(page);
  await page.getByLabel('Workspace name').fill('Team');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.getByRole('button', { name: 'Members' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Members of Team' })).toBeVisible();
  await expect(dialog.getByText('Ann Lee')).toBeVisible();
  await dialog.getByRole('tab', { name: 'Invite' }).click();
  await dialog.getByLabel('Invite by email').fill('friend@example.com');
  await dialog.getByRole('button', { name: 'Invite', exact: true }).click();
  await expect(dialog.getByText('friend@example.com')).toBeVisible();
});
