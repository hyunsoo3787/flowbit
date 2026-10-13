import { type Locale, SUPPORTED_LOCALES } from '@flowbit/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
  CheckIcon,
  ChevronsUpDownIcon,
  LanguagesIcon,
  LogOutIcon,
  BellIcon,
  PlusIcon,
  ShieldIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo, LogoMark } from '@/components/logo';
import { THEME_ICONS, THEMES, themeLabelKey } from '@/components/preference-controls';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChangeLanguage, useMe, useSignOut } from '@/features/auth/queries';
import { boardQuery } from '@/features/boards/queries';
import { NotificationsButton } from '@/features/notifications/notifications-button';
import { NotificationPreferencesDialog } from '@/features/notifications/preferences-dialog';
import { CreateWorkspaceDialog } from '@/features/workspaces/create-workspace-dialog';
import { workspacesQuery } from '@/features/workspaces/queries';
import { currentLocale } from '@/i18n';
import { type Theme, useTheme } from '@/lib/theme';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

function WorkspaceSwitcher() {
  const { t } = useTranslation();
  const { data: workspaces = [] } = useQuery(workspacesQuery);
  const params = useParams({ strict: false });
  const [creating, setCreating] = useState(false);
  // On a board page, the current workspace is the board's.
  const { data: board } = useQuery({
    ...boardQuery(params.boardId ?? ''),
    enabled: false,
  });
  const currentId = params.workspaceId ?? (params.boardId ? board?.workspaceId : undefined);
  const current = workspaces.find((workspace) => workspace.id === currentId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="max-w-48 min-w-0 sm:max-w-64">
            <span className="truncate">{current?.name ?? t('nav.workspaces')}</span>
            <ChevronsUpDownIcon className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {t('nav.workspaces')}
          </DropdownMenuLabel>
          {workspaces.map((workspace) => (
            <DropdownMenuItem key={workspace.id} asChild>
              <Link to="/w/$workspaceId" params={{ workspaceId: workspace.id }}>
                <span className="flex-1 truncate">{workspace.name}</span>
                {workspace.id === current?.id ? <CheckIcon /> : null}
              </Link>
            </DropdownMenuItem>
          ))}
          {workspaces.length > 0 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem onSelect={() => setCreating(true)}>
            <PlusIcon />
            {t('nav.createWorkspace')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateWorkspaceDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { theme, setTheme } = useTheme();
  const changeLanguage = useChangeLanguage();
  const signOut = useSignOut();
  const ThemeIcon = THEME_ICONS[theme];
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  return (
    <>
      <NotificationPreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={t('nav.account')}
          >
            <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {me ? initials(me.name) : null}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {me ? (
            <DropdownMenuLabel className="grid gap-0.5">
              <span className="truncate">{me.name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{me.email}</span>
            </DropdownMenuLabel>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <LanguagesIcon />
              {t('nav.language')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={currentLocale()}
                onValueChange={(value) => changeLanguage(value as Locale, true)}
              >
                {SUPPORTED_LOCALES.map((locale) => (
                  <DropdownMenuRadioItem key={locale} value={locale}>
                    {t(`languages.${locale}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ThemeIcon />
              {t('nav.theme')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value) => setTheme(value as Theme)}
              >
                {THEMES.map((option) => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    {t(themeLabelKey[option])}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={() => setPreferencesOpen(true)}>
            <BellIcon />
            {t('nav.notifications')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {me?.isAdmin ? (
            <DropdownMenuItem asChild>
              <Link to="/admin">
                <ShieldIcon />
                {t('nav.admin')}
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={async () => {
              await signOut();
              await navigate({ to: '/sign-in' });
            }}
          >
            <LogOutIcon />
            {t('nav.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function AppHeader() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
        <Link to="/" aria-label={t('nav.home')} className="shrink-0">
          <LogoMark className="sm:hidden" />
          <Logo className="hidden sm:inline-flex" />
        </Link>
        <span className="text-muted-foreground/50" aria-hidden>
          /
        </span>
        <WorkspaceSwitcher />
        <div className="ml-auto flex items-center gap-1">
          <NotificationsButton />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
