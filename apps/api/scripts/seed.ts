// Fills a development database with test accounts and sample boards.
//
//   pnpm --filter @flowbit/api db:seed            # skip if already seeded
//   pnpm --filter @flowbit/api db:seed --reset    # delete the seed data first
//
// Refuses to run when NODE_ENV=production.
import { generateNKeysBetween } from 'fractional-indexing';

if (process.env['NODE_ENV'] === 'production') {
  console.error('Refusing to seed: NODE_ENV is "production".');
  process.exit(1);
}

const { createApp } = await import('../src/app.factory.js');
const { AUTH } = await import('../src/auth/auth.constants.js');
const { PrismaService } = await import('../src/prisma/prisma.service.js');
const { refreshCardCounters } = await import('../src/boards/card-content.js');
const { DEFAULT_LABEL_COLORS } = await import('@flowbit/shared');
type Auth = import('../src/auth/create-auth.js').Auth;

const DAY_MS = 24 * 60 * 60 * 1000;

interface SeedCard {
  title: string;
  description: string;
  labels?: string[];
  /** Days from now; negative is overdue. */
  dueInDays?: number;
  done?: boolean;
  assignees?: (typeof ACCOUNTS)[number]['key'][];
  checklist?: { title: string; items: [string, boolean][] };
  comments?: [(typeof ACCOUNTS)[number]['key'], string][];
}

/** Names for the default labels, in DEFAULT_LABEL_COLORS order. */
const LABEL_NAMES = ['Docs', 'Design', '', 'Bug', 'Feature', ''];

const SEED_PASSWORD = 'flowbit-dev-password';
const DOMAIN = '@flowbit.dev';
const ACCOUNTS = [
  { key: 'admin', name: 'Alex Admin', role: 'ADMIN' },
  { key: 'member', name: 'Morgan Member', role: 'MEMBER' },
  { key: 'viewer', name: 'Val Viewer', role: 'VIEWER' },
] as const;

const BOARD: { name: string; lists: { name: string; cards: SeedCard[] }[] } = {
  name: 'Product roadmap',
  lists: [
    {
      name: 'To do',
      cards: [
        {
          title: 'Write the onboarding guide',
          description: '## Outline\n- Create an account\n- Create a workspace\n- Invite the team',
          labels: ['Docs'],
          dueInDays: 3,
          assignees: ['member'],
          checklist: {
            title: 'Sections',
            items: [
              ['Accounts', true],
              ['Workspaces', true],
              ['Invitations', false],
            ],
          },
          comments: [
            ['admin', 'Could you add screenshots too?'],
            ['member', 'Sure, once the UI settles.'],
          ],
        },
        {
          title: 'Pick a color palette for boards',
          description: '',
          labels: ['Design'],
          dueInDays: -1,
        },
        {
          title: 'Plan phase 4: notifications',
          description: 'See `docs/ROADMAP.md`.',
          labels: ['Feature'],
        },
      ],
    },
    {
      name: 'In progress',
      cards: [
        {
          title: 'Drag and drop for cards',
          description: 'Mouse, touch and keyboard.\n\n- [x] Within a list\n- [x] Across lists',
          labels: ['Feature'],
          assignees: ['admin', 'member'],
        },
        { title: 'Login fails with a long email', description: '', labels: ['Bug'], dueInDays: 1 },
      ],
    },
    {
      name: 'Done',
      cards: [
        { title: 'Sign up and sign in', description: '', dueInDays: -5, done: true },
        { title: 'Workspaces', description: '' },
      ],
    },
  ],
};

const app = await createApp({ logger: ['error'] });
const prisma = app.get(PrismaService);
const auth = app.get<Auth>(AUTH);

try {
  const seeded = await prisma.user.findUnique({ where: { email: `admin${DOMAIN}` } });
  if (seeded && !process.argv.includes('--reset')) {
    console.log('Already seeded. Run with --reset to recreate the seed data.');
  } else {
    if (seeded) {
      // Personal organizations, and everything in them, are deleted with their owner.
      await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    }

    const users: Record<string, string> = {};
    for (const account of ACCOUNTS) {
      const { user } = await auth.api.signUpEmail({
        body: { name: account.name, email: `${account.key}${DOMAIN}`, password: SEED_PASSWORD },
      });
      await prisma.user.update({
        where: { id: user.id },
        // The admin account also manages this server (D-021), to try the admin pages.
        data: { emailVerified: true, isAdmin: account.key === 'admin' },
      });
      users[account.key] = user.id;
    }

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { personalOwnerId: users['admin']! },
    });
    const workspace = await prisma.workspace.create({
      data: {
        organizationId: organization.id,
        name: 'Flowbit team',
        description: 'Sample workspace with one account per role.',
        createdById: users['admin']!,
        members: {
          create: ACCOUNTS.map((account) => ({ userId: users[account.key]!, role: account.role })),
        },
      },
    });

    const board = await prisma.board.create({
      data: {
        workspaceId: workspace.id,
        name: BOARD.name,
        background: '#93c5fd',
        createdById: users['admin']!,
        members: { create: { userId: users['admin']!, role: 'ADMIN' } },
      },
    });
    const labels = new Map<string, string>();
    for (const [i, color] of DEFAULT_LABEL_COLORS.entries()) {
      const label = await prisma.label.create({
        data: {
          boardId: board.id,
          color,
          name: LABEL_NAMES[i] ?? '',
          createdAt: new Date(Date.now() + i),
        },
      });
      if (label.name) labels.set(label.name, label.id);
    }

    const listPositions = generateNKeysBetween(null, null, BOARD.lists.length);
    for (const [i, list] of BOARD.lists.entries()) {
      const created = await prisma.list.create({
        data: { boardId: board.id, name: list.name, position: listPositions[i]! },
      });
      const cardPositions = generateNKeysBetween(null, null, list.cards.length);
      for (const [j, card] of list.cards.entries()) {
        const dueAt =
          card.dueInDays === undefined ? null : new Date(Date.now() + card.dueInDays * DAY_MS);
        const { id: cardId } = await prisma.card.create({
          data: {
            boardId: board.id,
            listId: created.id,
            title: card.title,
            description: card.description,
            position: cardPositions[j]!,
            dueAt,
            dueCompletedAt: card.done && dueAt ? dueAt : null,
            createdById: users['admin']!,
            labels: { create: (card.labels ?? []).map((name) => ({ labelId: labels.get(name)! })) },
            assignees: { create: (card.assignees ?? []).map((key) => ({ userId: users[key]! })) },
          },
        });
        if (card.checklist) {
          const itemPositions = generateNKeysBetween(null, null, card.checklist.items.length);
          await prisma.checklist.create({
            data: {
              cardId,
              title: card.checklist.title,
              position: 'a0',
              items: {
                create: card.checklist.items.map(([text, done], k) => ({
                  text,
                  position: itemPositions[k]!,
                  completedAt: done ? new Date() : null,
                })),
              },
            },
          });
        }
        for (const [k, [author, body]] of (card.comments ?? []).entries()) {
          await prisma.comment.create({
            data: { cardId, authorId: users[author]!, body, createdAt: new Date(Date.now() + k) },
          });
        }
        await refreshCardCounters(prisma, cardId);
      }
    }

    await prisma.board.create({
      data: {
        workspaceId: workspace.id,
        name: 'Admin notes (private)',
        visibility: 'PRIVATE',
        background: '#cbd5e1',
        createdById: users['admin']!,
        members: { create: { userId: users['admin']!, role: 'ADMIN' } },
        labels: {
          create: DEFAULT_LABEL_COLORS.map((color, i) => ({
            color,
            createdAt: new Date(Date.now() + i),
          })),
        },
      },
    });

    console.log('Seeded. Sign in with any of these accounts:');
    for (const account of ACCOUNTS) {
      console.log(
        `  ${`${account.key}${DOMAIN}`.padEnd(22)} workspace ${account.role.toLowerCase()}${
          account.key === 'admin' ? ', instance administrator' : ''
        }`,
      );
    }
    console.log(`Password for all of them: ${SEED_PASSWORD}`);
  }
} finally {
  await app.close();
}
