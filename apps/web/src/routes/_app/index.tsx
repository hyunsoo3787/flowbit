import type { Workspace } from '@flowbit/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { LayoutGridIcon, LockIcon, PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Page } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { boardSurface } from '@/features/boards/backgrounds';
import { sharedBoardsQuery } from '@/features/boards/queries';
import { cn } from '@/lib/utils';
import {
  CreateWorkspaceDialog,
  useCreateWorkspaceAndOpen,
} from '@/features/workspaces/create-workspace-dialog';
import { workspacesQuery } from '@/features/workspaces/queries';
import { WorkspaceForm } from '@/features/workspaces/workspace-form';

export const Route = createFileRoute('/_app/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(workspacesQuery),
  component: HomePage,
});

function HomePage() {
  const { data: workspaces } = useSuspenseQuery(workspacesQuery);
  return (
    <Page>
      <div className="grid gap-10">
        {workspaces.length === 0 ? <FirstWorkspace /> : <WorkspaceGrid workspaces={workspaces} />}
        <SharedBoards />
      </div>
    </Page>
  );
}

/** Boards the user was invited to without joining their workspace. */
function SharedBoards() {
  const { t } = useTranslation();
  const { data: boards = [] } = useQuery(sharedBoardsQuery);
  if (boards.length === 0) return null;
  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">{t('boards.sharedWithYou')}</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {boards.map((board) => {
          const surface = boardSurface(board.background);
          return (
            <li key={board.id}>
              <Link
                to="/b/$boardId"
                params={{ boardId: board.id }}
                className={cn(
                  'flex h-24 items-start justify-between rounded-lg p-3 font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  surface.className,
                )}
                style={surface.style}
              >
                <span className="line-clamp-2 break-words">{board.name}</span>
                {board.visibility === 'PRIVATE' ? (
                  <LockIcon
                    className="size-4 shrink-0 opacity-80"
                    aria-label={t('boards.visibilityPRIVATE')}
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FirstWorkspace() {
  const { t } = useTranslation();
  const createAndOpen = useCreateWorkspaceAndOpen();

  return (
    <div className="mx-auto grid max-w-md gap-6 pt-4 sm:pt-12">
      <div className="grid justify-items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-accent text-primary">
          <LayoutGridIcon className="size-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold">{t('workspaces.empty.title')}</h1>
        <p className="text-muted-foreground">{t('workspaces.empty.body')}</p>
      </div>
      <Card>
        <CardContent>
          <WorkspaceForm
            onSubmit={async (values) => {
              await createAndOpen(values);
            }}
            actions={(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting}>
                {t('workspaces.create.submit')}
              </Button>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspaceGrid({ workspaces }: { workspaces: Workspace[] }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">{t('workspaces.home.title')}</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            {t('workspaces.home.subtitle')}
          </p>
        </div>
        <CreateWorkspaceDialog
          trigger={
            <Button>
              <PlusIcon />
              {t('nav.createWorkspace')}
            </Button>
          }
        />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workspaces.map((workspace) => (
          <li key={workspace.id}>
            <Link
              to="/w/$workspaceId"
              params={{ workspaceId: workspace.id }}
              className="block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
                <CardHeader>
                  <CardTitle as="h2" className="truncate">
                    {workspace.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 min-h-10">
                    {workspace.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    {t(`workspaces.roles.${workspace.role}`)}
                  </span>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
