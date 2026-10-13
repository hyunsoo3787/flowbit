import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useEffect } from 'react';
import { meQuery, sessionQuery, useMe } from '@/features/auth/queries';
import { VerifyEmailBanner } from '@/features/auth/verify-email-banner';
import { AppHeader } from '@/features/layout/app-header';
import { useNotificationsRealtime } from '@/features/notifications/use-notifications-realtime';
import i18n from '@/i18n';

/** Layout for signed-in pages. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);
    if (!session) {
      throw redirect({
        to: '/sign-in',
        search: location.href === '/' ? {} : { redirect: location.href },
      });
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: AppLayout,
});

function AppLayout() {
  const { data: me } = useMe();
  useNotificationsRealtime();

  // The account's language wins over the browser's, so it follows the user across devices.
  useEffect(() => {
    if (me && i18n.resolvedLanguage !== me.locale) void i18n.changeLanguage(me.locale);
  }, [me]);

  return (
    <div className="flex h-svh flex-col">
      <AppHeader />
      <VerifyEmailBanner />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
