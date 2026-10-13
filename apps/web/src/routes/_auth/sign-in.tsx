import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { refreshSession } from '@/features/auth/queries';
import { SocialButtons } from '@/features/auth/social-buttons';
import { authClient } from '@/lib/auth-client';
import { errorMessage } from '@/lib/errors';
import { signInFormSchema } from '@/lib/form-schemas';
import { safeRedirect } from '@/lib/redirect';

export const Route = createFileRoute('/_auth/sign-in')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = safeRedirect(search['redirect']);
    return redirect ? { redirect } : {};
  },
  component: SignInPage,
});

function SignInPage() {
  const { t } = useTranslation();
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof signInFormSchema>>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const result = await authClient.signIn.email(values);
    if (result.error) {
      setError(errorMessage(t, result.error));
      return;
    }
    await refreshSession(queryClient);
    await navigate({ href: redirect ?? '/' });
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">
          {t('auth.signIn.title')}
        </CardTitle>
        <CardDescription>{t('auth.signIn.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <SocialButtons callbackURL={redirect ?? '/'} />
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <FormField label={t('auth.fields.email')} error={errors.email}>
            {(field) => (
              <Input type="email" autoComplete="email" {...field} {...form.register('email')} />
            )}
          </FormField>
          <FormField
            label={t('auth.fields.password')}
            error={errors.password}
            aside={
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                {t('auth.signIn.forgotPassword')}
              </Link>
            }
          >
            {(field) => (
              <Input
                type="password"
                autoComplete="current-password"
                {...field}
                {...form.register('password')}
              />
            )}
          </FormField>
          <Button type="submit" disabled={isSubmitting}>
            {t('auth.signIn.submit')}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          {t('auth.signIn.noAccount')}{' '}
          <Link to="/sign-up" className="text-primary hover:underline">
            {t('auth.signIn.signUpLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
