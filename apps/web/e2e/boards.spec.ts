import { expect, test } from '@playwright/test';
import { addCards, addLists, cardTitles, openNewBoard } from './helpers';

test.use({ locale: 'en-US' });

test('builds a board with lists and cards that survive a reload', async ({ page }) => {
  await openNewBoard(page, 'Launch plan');
  await addLists(page, ['To do', 'Doing', 'Done']);
  await addCards(page, 'To do', ['Write copy', 'Record demo']);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Launch plan' })).toBeVisible();
  await expect.poll(() => cardTitles(page, 'To do')).toEqual(['Write copy', 'Record demo']);
  await expect(page.getByRole('region', { name: /^(To do|Doing|Done)$/ })).toHaveCount(3);
});

test('moves a card to another list by dragging with the mouse', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse drag is covered on desktop; touch uses the same code path.');
  await openNewBoard(page);
  await addLists(page, ['To do', 'Done']);
  await addCards(page, 'To do', ['Ship it', 'Keep me']);

  const card = page.getByRole('link', { name: 'Open card: Ship it' });
  const target = page.getByRole('region', { name: 'Done' });
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 15 });
  await page.mouse.up();

  await expect.poll(() => cardTitles(page, 'Done')).toEqual(['Ship it']);
  await page.reload();
  await expect.poll(() => cardTitles(page, 'Done')).toEqual(['Ship it']);
  await expect.poll(() => cardTitles(page, 'To do')).toEqual(['Keep me']);
});

test('reorders cards with the keyboard', async ({ page }) => {
  await openNewBoard(page);
  await addLists(page, ['To do']);
  await addCards(page, 'To do', ['First', 'Second', 'Third']);

  await page.getByRole('link', { name: 'Open card: First' }).focus();
  // Drive the drag by its screen-reader announcements rather than fixed
  // delays: the keyboard sensor only listens from the tick after pick-up, and
  // under heavy load a key press can land before it does.
  const announcement = page.locator('[id^="DndLiveRegion"]');
  await page.keyboard.press('Space');
  await expect(announcement).toHaveText('Picked up First.');
  for (let attempt = 0; attempt < 6; attempt++) {
    if ((await announcement.textContent()) === 'First is over Third.') break;
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(250);
  }
  await expect(announcement).toHaveText('First is over Third.');
  await page.keyboard.press('Space');
  await expect(announcement).toHaveText('Dropped First.');

  await expect.poll(() => cardTitles(page, 'To do')).toEqual(['Second', 'Third', 'First']);
  await page.reload();
  await expect.poll(() => cardTitles(page, 'To do')).toEqual(['Second', 'Third', 'First']);
});

test('opens card details at their own URL and renders Markdown', async ({ page }) => {
  await openNewBoard(page);
  await addLists(page, ['Ideas']);
  await addCards(page, 'Ideas', ['Dark mode']);
  const boardUrl = page.url();

  await page.getByRole('link', { name: 'Open card: Dark mode' }).click();
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('in list Ideas')).toBeVisible();

  await dialog.getByRole('button', { name: 'Edit description' }).click();
  await dialog
    .getByRole('textbox', { name: 'Description' })
    .fill('## Why\n- **contrast**\n\n<b>raw html</b>');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByRole('heading', { name: 'Why' })).toBeVisible();
  await expect(dialog.locator('strong', { hasText: 'contrast' })).toBeVisible();
  await expect(dialog.locator('b', { hasText: 'raw html' })).toHaveCount(0);

  // The URL can be shared: opening it directly shows the same card.
  const cardUrl = page.url();
  await page.goto(cardUrl);
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Why' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(boardUrl);
});

test('shows changes from another window without reloading', async ({ page, context }) => {
  await openNewBoard(page);
  await addLists(page, ['Inbox']);

  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByRole('region', { name: 'Inbox' })).toBeVisible();

  await addCards(page, 'Inbox', ['Hello from the first window']);
  await expect(
    other.getByRole('link', { name: 'Open card: Hello from the first window' }),
  ).toBeVisible();

  await other.getByRole('button', { name: 'Inbox', exact: true }).click();
  await other.getByRole('textbox', { name: 'Rename list' }).fill('Triage');
  await other.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Triage' })).toBeVisible();
  await other.close();
});

test('lists boards on the workspace page and deletes a board', async ({ page }) => {
  await openNewBoard(page, 'Temporary');
  await page.getByRole('button', { name: 'Board menu' }).click();
  await page.getByRole('menuitem', { name: 'Delete board' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete board' }).click();

  await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('link', { name: 'Temporary' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create board' })).toBeVisible();
});
