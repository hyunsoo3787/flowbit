import { PASSWORD_MIN_LENGTH } from '@flowbit/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ShieldCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { api, unwrap } from '@/api/client';
import { FormField } from '@/components/form-field';
import { Logo } from '@/components/logo';
import { PreferenceControls } from '@/components/preference-controls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { setupStatusQuery } from '@/features/admin/queries';
import { meQuery, refreshSession, sessionQuery } from '@/features/auth/queries';
import { errorMessage } from '@/lib/errors';
import { signUpFormSchema } from '@/lib/form-schemas';

/** The one-time page that creates the first instance administrator (D-021). */
export const Route = createFileRoute('/setup')({
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search['token'] === 'string' ? { token: search['token'].slice(0, 200) } : {},
  component: SetupPage,
});

function SetupPage() {
  const { t } = useTranslation();
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: status } = useQuery(setupStatusQuery);
  const { data: session } = useQuery(sessionQuery);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof signUpFormSchema>>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const complete = async (account?: z.infer<typeof signUpFormSchema>) => {
    setError(null);
    try {
      await unwrap(
        api.POST('/api/v1/setup', {
          body: { token: token ?? '', ...(account ? { account } : {}) },
        }),
      );
      await refreshSession(queryClient);
      await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
      await navigate({ to: '/admin' });
    } catch (caught) {
      setError(errorMessage(t, caught));
    }
  };
  const onSubmit = form.handleSubmit((values) => complete(values));
  const { errors, isSubmitting } = form.formState;

  let body;
  if (status && !status.required) {
    body = (
      <Card>
        <CardHeader>
          <CardTitle as="h1" className="text-xl">
            {t('setup.doneTitle')}
          </CardTitle>
          <CardDescription>{t('setup.doneBody')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/">{t('notFound.home')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  } else if (!token) {
    body = (
      <Card>
        <CardHeader>
          <CardTitle as="h1" className="text-xl">
            {t('setup.title')}
          </CardTitle>
          <CardDescription>{t('setup.noToken')}</CardDescription>
        </CardHeader>
      </Card>
    );
  } else {
    body = (
      <Card>
        <CardHeader className="justify-items-center text-center">
          <ShieldCheckIcon className="size-10 text-primary" aria-hidden />
          <CardTitle as="h1" className="text-xl">
            {t('setup.title')}
          </CardTitle>
          <CardDescription>{t('setup.body')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {session ? (
            <>
              <Button onClick={() => void complete()}>{t('setup.claim')}</Button>
              <p className="text-center text-xs text-muted-foreground">
                {t('invitations.page.signedInAs', { email: session.user.email })}
              </p>
            </>
          ) : (
            <form className="grid gap-4" onSubmit={onSubmit} noValidate>
              <FormField label={t('auth.fields.name')} error={errors.name}>
                {(field) => <Input autoComplete="name" {...field} {...form.register('name')} />}
              </FormField>
              <FormField label={t('auth.fields.email')} error={errors.email}>
                {(field) => (
                  <Input type="email" autoComplete="email" {...field} {...form.register('email')} />
                )}
              </FormField>
              <FormField
                label={t('auth.fields.password')}
                error={errors.password}
                hint={t('auth.passwordHint', { min: PASSWORD_MIN_LENGTH })}
              >
                {(field) => (
                  <Input
                    type="password"
                    autoComplete="new-password"
                    {...field}
                    {...form.register('password')}
                  />
                )}
              </FormField>
              <Button type="submit" disabled={isSubmitting}>
                {t('setup.create')}
              </Button>
            </form>
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
