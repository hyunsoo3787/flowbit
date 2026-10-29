import type { AdminUser, PasswordResetLink } from '@flowbit/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { CopyIcon, MoreHorizontalIcon, SearchIcon } from 'lucide-react';
import { type ReactNode, useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { useMe } from '@/features/auth/queries';
import { useUserActions, usersQuery } from './queries';

function Badge({ children, tone }: { children: ReactNode; tone: 'admin' | 'warn' | 'muted' }) {
  const tones = {
    admin: 'bg-primary/10 text-primary',
    warn: 'bg-destructive/10 text-destructive',
    muted: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function AdminUsers() {
  const { t, i18n } = useTranslation();
  const { data: me } = useMe();
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim());
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(
    usersQuery(query),
  );
  const actions = useUserActions();
  const [resetLink, setResetLink] = useState<{ user: AdminUser; link: PasswordResetLink } | null>(
    null,
  );
  const users = data?.pages.flatMap((page) => page.items) ?? [];
  const date = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso))
      : '—';

  return (
    <div className="grid gap-4">
      <div className="relative max-w-sm">
        <SearchIcon
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('admin.users.search')}
          aria-label={t('admin.users.search')}
          className="pl-9"
        />
      </div>

      <ul className="grid divide-y rounded-lg border bg-card">
        {users.map((user) => (
          <li key={user.id} className="flex flex-wrap items-center gap-3 p-3">
            <Avatar user={{ id: user.id, name: user.name, image: null }} size="md" />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <p className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{user.name}</span>
                {user.isAdmin ? <Badge tone="admin">{t('admin.users.admin')}</Badge> : null}
                {user.suspendedAt ? <Badge tone="warn">{t('admin.users.suspended')}</Badge> : null}
                {!user.emailVerified ? (
                  <Badge tone="muted">{t('admin.users.unverified')}</Badge>
                ) : null}
              </p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">
                {t('admin.users.details', {
                  methods:
                    user.signInMethods
                      .map((method) => t(`admin.users.methods.${method}`, { defaultValue: method }))
                      .join(', ') || '—',
                  workspaces: user.workspaces,
                  created: date(user.createdAt),
                  active: date(user.lastActiveAt),
                })}
              </p>
            </div>
            {user.id !== me?.id ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('admin.users.actionsFor', { name: user.name })}
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onSelect={() =>
                      actions.resetLink.mutate(user.id, {
                        onSuccess: (link) => setResetLink({ user, link }),
                      })
                    }
                  >
                    {t('admin.users.resetLink')}
                  </DropdownMenuItem>
                  {user.isAdmin && !user.adminFromConfig ? (
                    <DropdownMenuItem
                      onSelect={() => actions.setAdmin.mutate({ user, admin: false })}
                    >
                      {t('admin.users.revokeAdmin')}
                    </DropdownMenuItem>
                  ) : null}
                  {!user.isAdmin && !user.suspendedAt ? (
                    <DropdownMenuItem
                      onSelect={() => actions.setAdmin.mutate({ user, admin: true })}
                    >
                      {t('admin.users.grantAdmin')}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  {user.suspendedAt ? (
                    <DropdownMenuItem onSelect={() => actions.reactivate.mutate(user.id)}>
                      {t('admin.users.reactivate')}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onSelect={() => {
                        if (window.confirm(t('admin.users.suspendConfirm', { name: user.name }))) {
                          actions.suspend.mutate(user.id);
                        }
                      }}
                    >
                      {t('admin.users.suspend')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      if (
                        window.confirm(
                          t('admin.users.deleteConfirm', { name: user.name, email: user.email }),
                        )
                      ) {
                        actions.remove.mutate(user.id, {
                          onSuccess: () => toast.success(t('admin.users.deleted')),
                        });
                      }
                    }}
                  >
                    {t('admin.users.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </li>
        ))}
        {users.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">{t('admin.users.none')}</li>
        ) : null}
      </ul>
      {hasNextPage ? (
        <Button
          variant="outline"
          className="justify-self-start"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {t('admin.loadMore')}
        </Button>
      ) : null}

      <Dialog open={resetLink !== null} onOpenChange={(open) => !open && setResetLink(null)}>
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader>
            <DialogTitle>
              {t('admin.users.resetLinkTitle', { name: resetLink?.user.name })}
            </DialogTitle>
            <DialogDescription>{t('admin.users.resetLinkBody')}</DialogDescription>
          </DialogHeader>
          <Input
            readOnly
            value={resetLink?.link.url ?? ''}
            aria-label={t('admin.users.resetLink')}
            onFocus={(event) => event.target.select()}
            className="font-mono text-xs"
          />
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!resetLink) return;
                try {
                  await navigator.clipboard.writeText(resetLink.link.url);
                  toast.success(t('invitations.linkCopied'));
                } catch {
                  window.prompt(t('invitations.copyManually'), resetLink.link.url);
                }
              }}
            >
              <CopyIcon />
              {t('invitations.copy')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
