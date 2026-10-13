// Server-side administration commands (D-021). In the Docker image:
//
//   docker compose exec flowbit flowbit admin grant you@example.com
//   docker compose exec flowbit flowbit admin revoke someone@example.com
//   docker compose exec flowbit flowbit admin list
//   docker compose exec flowbit flowbit admin setup-url
//
// Anyone who can run these has access to the server, so they need no sign-in.
// They also recover access when every administrator account is lost.

const USAGE = `Usage: flowbit admin <command>

Commands:
  grant <email>    Make an account an instance administrator
  revoke <email>   Remove the administrator role from an account
  list             List instance administrators
  setup-url        Print the one-time setup URL, while there is no administrator`;

const [scope, command, argument] = process.argv.slice(2);
if (scope !== 'admin' || !command) {
  console.log(USAGE);
  process.exit(scope === undefined || scope === '--help' ? 0 : 1);
}

const { createApp } = await import('../src/app.factory.js');
const { AdminService } = await import('../src/admin/admin.service.js');
const { SetupService } = await import('../src/admin/setup.service.js');
const { ENV } = await import('../src/config/env.js');
const { PrismaService } = await import('../src/prisma/prisma.service.js');
const { isInstanceAdmin } = await import('../src/admin/admin-policy.js');
type Env = import('../src/config/env.js').Env;

const app = await createApp({ logger: ['fatal', 'error'] });
const prisma = app.get(PrismaService);
const admin = app.get(AdminService);
const env = app.get<Env>(ENV);
let exitCode = 0;

try {
  switch (command) {
    case 'grant':
    case 'revoke': {
      if (!argument) throw new Error(`Missing email.\n\n${USAGE}`);
      const user = await prisma.user.findFirst({
        where: { email: { equals: argument, mode: 'insensitive' } },
      });
      if (!user) throw new Error(`No account with the email ${argument}.`);
      if (command === 'grant') {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: user.id }, data: { isAdmin: true } });
          await admin.log(tx, null, user.id, 'admin.granted', { via: 'cli' });
        });
        await app.get(SetupService).ensureToken();
        console.log(`${user.email} is now an instance administrator.`);
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: user.id }, data: { isAdmin: false } });
          await admin.log(tx, null, user.id, 'admin.revoked', { via: 'cli' });
        });
        console.log(`${user.email} is no longer an instance administrator.`);
        if (env.ADMIN_EMAILS.includes(user.email.toLowerCase())) {
          console.log('Note: the address is still listed in ADMIN_EMAILS.');
        }
      }
      break;
    }
    case 'list': {
      const users = await prisma.user.findMany({ orderBy: { email: 'asc' } });
      const admins = users.filter((user) => isInstanceAdmin(user, env));
      if (admins.length === 0) console.log('No instance administrators.');
      for (const user of admins) console.log(`${user.email}\t${user.name}`);
      break;
    }
    case 'setup-url': {
      const token = await app.get(SetupService).ensureToken();
      console.log(
        token
          ? `${env.PUBLIC_URL}/setup?token=${token}`
          : 'An administrator already exists; use `flowbit admin grant <email>` instead.',
      );
      break;
    }
    default:
      console.error(USAGE);
      exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  await app.close();
}
process.exit(exitCode);
