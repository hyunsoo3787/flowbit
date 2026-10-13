import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  const { theme } = useTheme();
  return (
    <>
      <Outlet />
      <Toaster theme={theme} position="bottom-right" richColors closeButton />
    </>
  );
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-svh place-items-center px-4">
      <div className="grid max-w-sm gap-3 text-center">
        <h1 className="text-2xl font-semibold">{t('notFound.title')}</h1>
        <p className="text-muted-foreground">{t('notFound.body')}</p>
        <Button asChild className="justify-self-center">
          <Link to="/">{t('notFound.home')}</Link>
        </Button>
      </div>
    </main>
  );
}
