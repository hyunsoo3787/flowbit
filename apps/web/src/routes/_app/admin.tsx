import type { AdminActionType } from '@flowbit/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { ActivityIcon, LayoutDashboardIcon, UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Page } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminUsers } from '@/features/admin/admin-users';
import {
  actionsQuery,
  settingsQuery,
  statsQuery,
  useUpdateSettings,
} from '@/features/admin/queries';
import { meQuery } from '@/features/auth/queries';

const TABS = ['overview', 'users', 'log'] as const;

/** Instance administration (D-021): accounts and server settings, never content. */
export const Route = createFileRoute('/_app/admin')({
  validateSearch: z.object({ tab: z.enum(TABS).optional().catch(undefined) }),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me.isAdmin) throw redirect({ to: '/' });
  },
  component: AdminPage,
});

function AdminPage() {
  const { t } = useTranslation();
  const { tab = 'overview' } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <Page>
      <div className="grid gap-6">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">{t('admin.title')}</h1>
          <p className="max-w-prose text-sm text-muted-foreground">{t('admin.subtitle')}</p>
        </div>
        <Tabs
          value={tab}
          onValueChange={(value) =>
            void navigate({ search: { tab: value as (typeof TABS)[number] } })
          }
        >
          <TabsList>
            <TabsTrigger value="overview">
              <LayoutDashboardIcon />
              {t('admin.tabs.overview')}
            </TabsTrigger>
            <TabsTrigger value="users">
              <UsersIcon />
              {t('admin.tabs.users')}
            </TabsTrigger>
            <TabsTrigger value="log">
              <ActivityIcon />
              {t('admin.tabs.log')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Overview />
          </TabsContent>
          <TabsContent value="users">
            <AdminUsers />
          </TabsContent>
          <TabsContent value="log">
            <ActionLog />
          </TabsContent>
        </Tabs>
      </div>
    </Page>
  );
}

function Overview() {
  const { t } = useTranslation();
  const { data: stats } = useQuery(statsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const update = useUpdateSettings();
  const items = stats
    ? ([
        ['users', stats.users],
        ['suspendedUsers', stats.suspendedUsers],
        ['admins', stats.admins],
        ['organizations', stats.organizations],
        ['workspaces', stats.workspaces],
        ['boards', stats.boards],
        ['cards', stats.cards],
      ] as const)
    : [];

  return (
    <div className="grid gap-8">
      <section className="grid gap-3" aria-labelledby="admin-stats">
        <h2 id="admin-stats" className="text-sm font-medium text-muted-foreground">
          {t('admin.stats.title')}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map(([key, value]) => (
            <div key={key} className="rounded-lg border bg-card p-4">
              <dt className="text-xs text-muted-foreground">{t(`admin.stats.${key}`)}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {settings ? (
        <section className="grid gap-3" aria-labelledby="admin-settings">
          <h2 id="admin-settings" className="text-sm font-medium text-muted-foreground">
            {t('admin.settings.title')}
          </h2>
          <div className="grid gap-4 rounded-lg border bg-card p-4">
            <label className="flex items-start gap-3">
              <Checkbox
                className="mt-0.5"
                checked={settings.signUpEnabled}
                onCheckedChange={(checked) => update.mutate({ signUpEnabled: checked === true })}
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{t('admin.settings.signUp')}</span>
                <span className="text-xs text-muted-foreground">
                  {t('admin.settings.signUpHint')}
                </span>
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              {settings.mailConfigured ? t('admin.settings.mailOn') : t('admin.settings.mailOff')}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ActionLog() {
  const { t, i18n } = useTranslation();
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(actionsQuery);
  const actions = data?.pages.flatMap((page) => page.items) ?? [];
  const format = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="grid gap-4">
      <ol className="grid divide-y rounded-lg border bg-card">
        {actions.map((action) => (
          <li key={action.id} className="grid gap-0.5 p-3 text-sm">
            <p>
              {t(`admin.log.types.${action.type as AdminActionType}`, {
                actor: action.actor?.name ?? t('admin.log.server'),
                target: action.target?.name ?? action.targetEmail ?? '—',
              })}
              {typeof action.details['signUpEnabled'] === 'boolean'
                ? ` (${action.details['signUpEnabled'] ? t('admin.log.on') : t('admin.log.off')})`
                : null}
            </p>
            <time dateTime={action.createdAt} className="text-xs text-muted-foreground">
              {format.format(new Date(action.createdAt))}
            </time>
          </li>
        ))}
        {actions.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">{t('admin.log.none')}</li>
        ) : null}
      </ol>
      {hasNextPage ? (
        <Button
          variant="outline"
          className="justify-self-start"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {t('admin.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
