import { expect, type Page, test } from '@playwright/test';
import { addCards, addLists, openNewBoard, signUp } from './helpers';

test.use({ locale: 'en-US' });

/** Signs up Bob in a second browser and adds him to Ann's board through an invite link. */
async function bobJoins(page: Page, bob: Page) {
  const boardId = page.url().split('/b/')[1]!.split(/[/?]/)[0]!;
  const link = await (
    await page.request.post(`/api/v1/boards/${boardId}/invitation-link`, {
      data: { role: 'MEMBER' },
    })
  ).json();
  await signUp(bob, 'Bob Builder');
  const token = String(link.url).split('/invite/')[1];
  const accepted = await bob.request.post(`/api/v1/invitations/${token}/accept`);
  expect(accepted.ok()).toBe(true);
  await bob.goto(`/b/${boardId}`);
  await page.reload();
}

test('notifies an assignee instantly and shows who is on the board', async ({ page, browser }) => {
  await openNewBoard(page, 'Team board');
  await addLists(page, ['To do']);
  await addCards(page, 'To do', ['Fix the bug']);
  const context = await browser.newContext({ locale: 'en-US' });
  const bob = await context.newPage();
  await bobJoins(page, bob);

  // Presence: Ann sees that Bob has the board open, too.
  await expect(page.getByText('Viewing now: Ann Lee, Bob Builder')).toBeAttached();

  // Ann assigns the card to Bob; Bob gets a notification right away.
  await page.getByRole('link', { name: 'Open card: Fix the bug' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Members' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Bob Builder' }).click();
  await expect(bob.getByText('Ann Lee assigned you to Fix the bug').first()).toBeVisible();
  await expect(bob.getByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible();

  // Bob starts writing a comment; Ann sees that he is editing.
  await bob.getByRole('link', { name: 'Open card: Fix the bug' }).click();
  await bob.getByRole('textbox', { name: 'Write a comment' }).fill('On it');
  await expect(
    page.getByRole('dialog').getByText('Bob Builder is editing this card'),
  ).toBeVisible();
  await bob.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await bob.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  // Bob opens his notifications and goes to the card; it's marked read.
  await bob.getByRole('button', { name: 'Notifications, 1 unread' }).click();
  await bob.getByRole('button', { name: /Ann Lee assigned you to Fix the bug/ }).click();
  await expect(bob).toHaveURL(/\/c\/[0-9a-f-]{36}/);
  await bob.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(bob.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
  await context.close();
});

test('watches a card and lists board activity', async ({ page }) => {
  await openNewBoard(page);
  await addLists(page, ['To do', 'Done']);
  await addCards(page, 'To do', ['Write docs']);

  await page.getByRole('link', { name: 'Open card: Write docs' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Watch', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Watching' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByRole('button', { name: 'Show details' }).click();
  await expect(dialog.getByText('Ann Lee added this card to To do')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(
    page
      .getByRole('link', { name: 'Open card: Write docs' })
      .getByLabel('You are watching this card'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Board menu' }).click();
  await page.getByRole('menuitem', { name: 'Activity' }).click();
  const activity = page.getByRole('dialog');
  await expect(activity.getByText('Ann Lee added Write docs to To do')).toBeVisible();
  await expect(activity.getByText('Ann Lee added the list Done')).toBeVisible();
});

test('chooses which notifications arrive by email', async ({ page }) => {
  await signUp(page);
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Notifications' }).click();
  const dialog = page.getByRole('dialog');
  const mentions = dialog.getByRole('checkbox', { name: /Mentions/ });
  await expect(mentions).toBeChecked();
  await mentions.click();
  await expect(mentions).not.toBeChecked();
  await page.reload();
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Notifications' }).click();
  await expect(
    page.getByRole('dialog').getByRole('checkbox', { name: /Mentions/ }),
  ).not.toBeChecked();
});
