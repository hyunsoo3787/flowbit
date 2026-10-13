import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { KanbanSquareIcon, SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { workspaceQuery } from '@/features/workspaces/queries';
import { WorkspaceSettingsDialog } from '@/features/workspaces/workspace-settings-dialog';
import { errorMessage } from '@/lib/errors';

export const Route = createFileRoute('/_app/w/$workspaceId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(workspaceQuery(params.workspaceId)),
  component: WorkspacePage,
  errorComponent: WorkspaceError,
});

function WorkspacePage() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQuery(workspaceId));

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="truncate text-2xl font-semibold">{workspace.name}</h1>
          {workspace.description ? (
            <p className="max-w-prose text-muted-foreground">{workspace.description}</p>
          ) : null}
        </div>
        {workspace.role === 'ADMIN' ? (
          <WorkspaceSettingsDialog
            workspace={workspace}
            trigger={
              <Button variant="outline">
                <SettingsIcon />
                {t('workspaces.settings.open')}
              </Button>
            }
          />
        ) : null}
      </div>

      <section className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t('workspaces.page.boards')}</h2>
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
          <KanbanSquareIcon className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">{t('workspaces.page.boardsSoonTitle')}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t('workspaces.page.boardsSoonBody')}
          </p>
        </div>
      </section>
    </div>
  );
}

function WorkspaceError({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <div className="grid justify-items-center gap-3 pt-12 text-center">
      <p className="max-w-sm text-muted-foreground">
        {notFound ? t('errors.WORKSPACE_NOT_FOUND') : errorMessage(t, error)}
      </p>
      <Button asChild variant="outline">
        <Link to="/">{t('notFound.home')}</Link>
      </Button>
    </div>
  );
}
