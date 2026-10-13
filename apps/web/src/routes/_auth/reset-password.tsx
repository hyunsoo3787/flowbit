import { PASSWORD_MIN_LENGTH } from '@flowbit/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { z } from 'zod';
import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';
import { errorMessage } from '@/lib/errors';
import { resetPasswordFormSchema } from '@/lib/form-schemas';

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search['token'] === 'string' ? { token: search['token'] } : {},
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetPasswordFormSchema>>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: '' },
  });

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    const result = await authClient.resetPassword({ newPassword: password, token: token ?? '' });
    if (result.error) {
      setError(errorMessage(t, result.error));
      return;
    }
    toast.success(t('auth.resetPassword.done'));
    await navigate({ to: '/sign-in' });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">
          {t('auth.resetPassword.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {token ? (
          <form className="grid gap-4" onSubmit={onSubmit} noValidate>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <FormField
              label={t('auth.fields.newPassword')}
              error={form.formState.errors.password}
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
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t('auth.resetPassword.submit')}
            </Button>
          </form>
        ) : (
          <Alert variant="destructive">
            <AlertDescription>{t('auth.resetPassword.invalidLink')}</AlertDescription>
          </Alert>
        )}
        <Link to="/sign-in" className="text-center text-sm text-primary hover:underline">
          {t('auth.backToSignIn')}
        </Link>
      </CardContent>
    </Card>
  );
}
