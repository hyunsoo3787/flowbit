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
type Auth = import('../src/auth/create-auth.js').Auth;

const SEED_PASSWORD = 'flowbit-dev-password';
const DOMAIN = '@flowbit.dev';
const ACCOUNTS = [
  { key: 'admin', name: 'Alex Admin', role: 'ADMIN' },
  { key: 'member', name: 'Morgan Member', role: 'MEMBER' },
  { key: 'viewer', name: 'Val Viewer', role: 'VIEWER' },
] as const;

const BOARD = {
  name: 'Product roadmap',
  lists: [
    {
      name: 'To do',
      cards: [
        {
          title: 'Write the onboarding guide',
          description: '## Outline\n- Create an account\n- Create a workspace\n- Invite the team',
        },
        { title: 'Pick a color palette for boards', description: '' },
        { title: 'Plan phase 3: members and labels', description: 'See `docs/ROADMAP.md`.' },
      ],
    },
    {
      name: 'In progress',
      cards: [
        {
          title: 'Drag and drop for cards',
          description: 'Mouse, touch and keyboard.\n\n- [x] Within a list\n- [x] Across lists',
        },
        { title: 'Real-time updates', description: '' },
      ],
    },
    {
      name: 'Done',
      cards: [
        { title: 'Sign up and sign in', description: '' },
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
      await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
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
    const listPositions = generateNKeysBetween(null, null, BOARD.lists.length);
    for (const [i, list] of BOARD.lists.entries()) {
      const created = await prisma.list.create({
        data: { boardId: board.id, name: list.name, position: listPositions[i]! },
      });
      const cardPositions = generateNKeysBetween(null, null, list.cards.length);
      await prisma.card.createMany({
        data: list.cards.map((card, j) => ({
          boardId: board.id,
          listId: created.id,
          title: card.title,
          description: card.description,
          position: cardPositions[j]!,
          createdById: users['admin']!,
        })),
      });
    }

    await prisma.board.create({
      data: {
        workspaceId: workspace.id,
        name: 'Admin notes (private)',
        visibility: 'PRIVATE',
        background: '#cbd5e1',
        createdById: users['admin']!,
        members: { create: { userId: users['admin']!, role: 'ADMIN' } },
      },
    });

    console.log('Seeded. Sign in with any of these accounts:');
    for (const account of ACCOUNTS) {
      console.log(
        `  ${`${account.key}${DOMAIN}`.padEnd(22)} workspace ${account.role.toLowerCase()}`,
      );
    }
    console.log(`Password for all of them: ${SEED_PASSWORD}`);
  }
} finally {
  await app.close();
}
