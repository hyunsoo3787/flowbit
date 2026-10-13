import { PASSWORD_MIN_LENGTH } from '@flowbit/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { MailCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { authConfigQuery, refreshSession } from '@/features/auth/queries';
import { SocialButtons } from '@/features/auth/social-buttons';
import { currentLocale } from '@/i18n';
import { authClient } from '@/lib/auth-client';
import { errorMessage } from '@/lib/errors';
import { signUpFormSchema } from '@/lib/form-schemas';
import { safeRedirect } from '@/lib/redirect';

export const Route = createFileRoute('/_auth/sign-up')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; email?: string } => {
    const redirect = safeRedirect(search['redirect']);
    const email = typeof search['email'] === 'string' ? search['email'].slice(0, 254) : undefined;
    return { ...(redirect ? { redirect } : {}), ...(email ? { email } : {}) };
  },
  component: SignUpPage,
});

function SignUpPage() {
  const { t } = useTranslation();
  const { redirect, email } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: config } = useQuery(authConfigQuery);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<z.infer<typeof signUpFormSchema>>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { name: '', email: email ?? '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const result = await authClient.signUp.email({
      ...values,
      // Extra user field (see apps/api/src/auth/create-auth.ts): the language of this UI.
      locale: currentLocale(),
      callbackURL: redirect ?? '/',
    } as Parameters<typeof authClient.signUp.email>[0]);
    if (result.error) {
      setError(errorMessage(t, result.error));
      return;
    }
    if (!result.data?.token) {
      // Email verification is required before the first sign-in.
      setSentTo(values.email);
      return;
    }
    await refreshSession(queryClient);
    await navigate({ href: redirect ?? '/' });
  });

  if (sentTo) {
    return (
      <Card>
        <CardHeader className="justify-items-center text-center">
          <MailCheckIcon className="size-10 text-primary" aria-hidden />
          <CardTitle as="h1" className="text-xl">
            {t('auth.checkEmail.title')}
          </CardTitle>
          <CardDescription>{t('auth.checkEmail.body', { email: sentTo })}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link to="/sign-in" className="text-sm text-primary hover:underline">
            {t('auth.backToSignIn')}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { errors, isSubmitting } = form.formState;
  // Invited people may sign up even when sign-up is closed; the server checks.
  const invited = redirect?.startsWith('/invite/') ?? false;
  const disabled = config?.signUpEnabled === false && !invited;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">
          {t('auth.signUp.title')}
        </CardTitle>
        <CardDescription>{t('auth.signUp.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {disabled ? (
          <Alert>
            <AlertDescription>{t('auth.signUp.disabled')}</AlertDescription>
          </Alert>
        ) : (
          <>
            <SocialButtons callbackURL={redirect ?? '/'} />
            <form className="grid gap-4" onSubmit={onSubmit} noValidate>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
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
                {t('auth.signUp.submit')}
              </Button>
            </form>
          </>
        )}
        <p className="text-center text-sm text-muted-foreground">
          {t('auth.signUp.haveAccount')}{' '}
          <Link
            to="/sign-in"
            search={redirect ? { redirect } : {}}
            className="text-primary hover:underline"
          >
            {t('auth.signUp.signInLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
