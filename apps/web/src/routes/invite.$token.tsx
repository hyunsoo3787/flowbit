import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { MailIcon, UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, ApiError, unwrap } from '@/api/client';
import { Logo } from '@/components/logo';
import { PreferenceControls } from '@/components/preference-controls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { sessionQuery } from '@/features/auth/queries';
import { invitationPreviewQuery } from '@/features/members/queries';
import { errorMessage } from '@/lib/errors';

/** Accepting an invitation; works signed in and signed out. */
export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
});

function InvitePage() {
  const { t } = useTranslation();
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = useQuery(sessionQuery);
  const { data: preview, error, isPending } = useQuery(invitationPreviewQuery(token));
  const accept = useMutation({
    mutationFn: () =>
      unwrap(api.POST('/api/v1/invitations/{token}/accept', { params: { path: { token } } })),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      await queryClient.invalidateQueries({ queryKey: ['shared-boards'] });
      if (result.boardId) {
        await navigate({ to: '/b/$boardId', params: { boardId: result.boardId } });
      } else if (result.workspaceId) {
        await navigate({ to: '/w/$workspaceId', params: { workspaceId: result.workspaceId } });
      }
    },
  });
  const here = `/invite/${token}`;

  let body;
  if (isPending || sessionPending) {
    body = <p className="text-center text-sm text-muted-foreground">{t('common.loading')}</p>;
  } else if (error || !preview) {
    const missing = error instanceof ApiError && error.status === 404;
    body = (
      <Card>
        <CardHeader>
          <CardTitle as="h1" className="text-xl">
            {t('invitations.page.invalidTitle')}
          </CardTitle>
          <CardDescription>
            {missing ? t('invitations.page.invalidBody') : errorMessage(t, error)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/">{t('notFound.home')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  } else {
    const target = preview.boardName ?? preview.workspaceName;
    body = (
      <Card>
        <CardHeader className="justify-items-center text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-accent text-primary">
            <UsersIcon className="size-6" aria-hidden />
          </span>
          <CardTitle as="h1" className="text-xl">
            {preview.invitedByName
              ? t('invitations.page.titleFrom', { name: preview.invitedByName, target })
              : t('invitations.page.title', { target })}
          </CardTitle>
          <CardDescription>
            {preview.kind === 'board'
              ? t('invitations.page.boardIn', { workspace: preview.workspaceName })
              : t('invitations.page.workspace')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {preview.email ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <MailIcon className="size-4" aria-hidden />
              {t('invitations.page.forEmail', { email: preview.email })}
            </p>
          ) : null}
          {accept.error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(t, accept.error)}</AlertDescription>
            </Alert>
          ) : null}
          {session ? (
            <>
              <Button onClick={() => accept.mutate()} disabled={accept.isPending}>
                {t('invitations.page.accept')}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {t('invitations.page.signedInAs', { email: session.user.email })}
              </p>
            </>
          ) : (
            <>
              <Button asChild>
                <Link
                  to="/sign-up"
                  search={{ redirect: here, ...(preview.email ? { email: preview.email } : {}) }}
                >
                  {t('invitations.page.signUp')}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/sign-in" search={{ redirect: here }}>
                  {t('invitations.page.signIn')}
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Logo />
        <PreferenceControls />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">{body}</div>
      </main>
    </div>
  );
}
