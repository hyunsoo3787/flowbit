import type { Workspace } from '@flowbit/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { LayoutGridIcon, PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  return workspaces.length === 0 ? <FirstWorkspace /> : <WorkspaceGrid workspaces={workspaces} />;
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
