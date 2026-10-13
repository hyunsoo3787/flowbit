import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';
import { errorMessage } from '@/lib/errors';
import { forgotPasswordFormSchema } from '@/lib/form-schemas';

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<z.infer<typeof forgotPasswordFormSchema>>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null);
    const result = await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' });
    if (result.error) {
      setError(errorMessage(t, result.error));
      return;
    }
    setSentTo(email);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">
          {t('auth.forgotPassword.title')}
        </CardTitle>
        <CardDescription>{t('auth.forgotPassword.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {sentTo ? (
          <Alert>
            <AlertDescription>{t('auth.forgotPassword.sent', { email: sentTo })}</AlertDescription>
          </Alert>
        ) : (
          <form className="grid gap-4" onSubmit={onSubmit} noValidate>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <FormField label={t('auth.fields.email')} error={form.formState.errors.email}>
              {(field) => (
                <Input type="email" autoComplete="email" {...field} {...form.register('email')} />
              )}
            </FormField>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t('auth.forgotPassword.submit')}
            </Button>
          </form>
        )}
        <Link to="/sign-in" className="text-center text-sm text-primary hover:underline">
          {t('auth.backToSignIn')}
        </Link>
      </CardContent>
    </Card>
  );
}
