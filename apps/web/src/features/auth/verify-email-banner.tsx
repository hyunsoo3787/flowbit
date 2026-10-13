import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { errorMessage } from '@/lib/errors';
import { useMe } from './queries';

/** Reminds users who signed up without mandatory verification to verify their email. */
export function VerifyEmailBanner() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const [sending, setSending] = useState(false);
  if (!me || me.emailVerified) return null;

  const resend = async () => {
    setSending(true);
    const { error } = await authClient.sendVerificationEmail({ email: me.email, callbackURL: '/' });
    setSending(false);
    if (error) toast.error(errorMessage(t, error));
    else toast.success(t('auth.verifyBanner.sent'));
  };

  return (
    <div className="border-b bg-accent/60 text-accent-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm sm:px-6">
        <span>{t('auth.verifyBanner.message')}</span>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={resend} disabled={sending}>
          {t('auth.verifyBanner.resend')}
        </Button>
      </div>
    </div>
  );
}
