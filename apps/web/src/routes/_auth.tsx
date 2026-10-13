import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/logo';
import { PreferenceControls } from '@/components/preference-controls';
import { sessionQuery } from '@/features/auth/queries';

/** Layout for signed-out pages. Signed-in users go straight to the app. */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);
    if (session) throw redirect({ to: '/' });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Logo />
        <PreferenceControls />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
        <p className="mb-6 text-center text-sm text-muted-foreground">{t('app.tagline')}</p>
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
