import type { SocialProvider } from '@flowbit/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { errorMessage } from '@/lib/errors';
import { authConfigQuery } from './queries';

const PROVIDER_NAMES: Record<SocialProvider, string> = { github: 'GitHub', google: 'Google' };

/** OAuth sign-in buttons, shown only for providers configured on the server. */
export function SocialButtons({ callbackURL = '/' }: { callbackURL?: string }) {
  const { t } = useTranslation();
  const { data: config } = useQuery(authConfigQuery);
  const providers = config?.socialProviders ?? [];
  if (providers.length === 0) return null;

  const signIn = async (provider: SocialProvider) => {
    const { error } = await authClient.signIn.social({ provider, callbackURL });
    if (error) toast.error(errorMessage(t, error));
  };

  return (
    <>
      <div className="grid gap-2">
        {providers.map((provider) => (
          <Button key={provider} variant="outline" type="button" onClick={() => signIn(provider)}>
            {t('auth.continueWith', { provider: PROVIDER_NAMES[provider] })}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        {t('common.or')}
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
