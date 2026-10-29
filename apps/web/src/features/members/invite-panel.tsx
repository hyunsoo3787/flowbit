import {
  BOARD_ROLES,
  type BoardRole,
  INVITATION_EMAILS_MAX,
  WORKSPACE_ROLES,
  type WorkspaceRole,
} from '@flowbit/shared';
import { useQuery } from '@tanstack/react-query';
import { CopyIcon, LinkIcon, MailIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  invitationsQuery,
  type Scope,
  useCreateInvitationLink,
  useInvite,
  useRevokeInvitation,
} from './queries';

export const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50';

const emailSchema = z.email();

/** Splits "a@x.com, b@y.com" into addresses; null if any is invalid. */
export function parseEmails(text: string): string[] | null {
  const parts = text
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > INVITATION_EMAILS_MAX) return null;
  return parts.every((part) => emailSchema.safeParse(part).success) ? parts : null;
}

export function RoleSelect<T extends WorkspaceRole | BoardRole>({
  scope,
  value,
  onChange,
  label,
  id,
  disabled,
}: {
  scope: Scope['kind'];
  value: T;
  onChange: (role: T) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const roles = (scope === 'board' ? BOARD_ROLES : WORKSPACE_ROLES) as unknown as readonly T[];
  return (
    <select
      id={id}
      aria-label={label}
      className={SELECT_CLASS}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {roles.map((role) => (
        <option key={role} value={role}>
          {scope === 'board'
            ? t(`boards.roles.${role as BoardRole}`)
            : t(`workspaces.roles.${role as WorkspaceRole}`)}
        </option>
      ))}
    </select>
  );
}

/** Invite by email or with a shareable link, and see who is still invited. */
export function InvitePanel({ scope }: { scope: Scope }) {
  const { t, i18n } = useTranslation();
  const invite = useInvite(scope);
  const createLink = useCreateInvitationLink(scope);
  const revoke = useRevokeInvitation(scope);
  const { data: invitations = [] } = useQuery(invitationsQuery(scope));
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState<WorkspaceRole | BoardRole>('MEMBER');
  const [linkRole, setLinkRole] = useState<WorkspaceRole | BoardRole>('MEMBER');
  const parsed = parseEmails(emails);
  const link = invitations.find((invitation) => invitation.email === null);
  const pending = invitations.filter((invitation) => invitation.email !== null);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('invitations.linkCopied'));
    } catch {
      window.prompt(t('invitations.copyManually'), url);
    }
  };

  return (
    <div className="grid gap-5">
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!parsed) return;
          invite.mutate(
            { emails: parsed, role },
            {
              onSuccess: () => {
                setEmails('');
                toast.success(t('invitations.sent', { count: parsed.length }));
              },
            },
          );
        }}
      >
        <Label htmlFor={`invite-${scope.id}`}>{t('invitations.byEmail')}</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={`invite-${scope.id}`}
            value={emails}
            onChange={(event) => setEmails(event.target.value)}
            placeholder={t('invitations.emailsPlaceholder')}
            className="min-w-48 flex-1"
            autoComplete="off"
          />
          <RoleSelect
            scope={scope.kind}
            value={role}
            onChange={setRole}
            label={t('invitations.role')}
          />
          <Button type="submit" disabled={!parsed || invite.isPending}>
            <MailIcon />
            {t('invitations.send')}
          </Button>
        </div>
        {emails.trim() && !parsed ? (
          <p className="text-xs text-destructive">
            {t('invitations.invalidEmails', { max: INVITATION_EMAILS_MAX })}
          </p>
        ) : null}
      </form>

      <div className="grid gap-2 rounded-lg border p-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <LinkIcon className="size-4" aria-hidden />
          {t('invitations.link')}
        </p>
        {link ? (
          <>
            <div className="flex gap-2">
              <Input
                readOnly
                value={link.url}
                aria-label={t('invitations.link')}
                onFocus={(event) => event.target.select()}
                className="font-mono text-xs"
              />
              <Button variant="secondary" onClick={() => void copy(link.url)}>
                <CopyIcon />
                {t('invitations.copy')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('invitations.linkHint', {
                role:
                  scope.kind === 'board'
                    ? t(`boards.roles.${link.role as BoardRole}`)
                    : t(`workspaces.roles.${link.role as WorkspaceRole}`),
                date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
                  new Date(link.expiresAt),
                ),
              })}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="justify-self-start text-destructive"
              onClick={() => revoke.mutate(link.id)}
            >
              {t('invitations.disableLink')}
            </Button>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <RoleSelect
              scope={scope.kind}
              value={linkRole}
              onChange={setLinkRole}
              label={t('invitations.role')}
            />
            <Button
              variant="secondary"
              disabled={createLink.isPending}
              onClick={() => createLink.mutate(linkRole)}
            >
              {t('invitations.createLink')}
            </Button>
          </div>
        )}
      </div>

      {pending.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">{t('invitations.pending')}</p>
          <ul className="grid gap-1">
            {pending.map((invitation) => (
              <li key={invitation.id} className="flex items-center gap-2 text-sm">
                <MailIcon className="size-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{invitation.email}</span>
                <span className="text-xs text-muted-foreground">
                  {scope.kind === 'board'
                    ? t(`boards.roles.${invitation.role as BoardRole}`)
                    : t(`workspaces.roles.${invitation.role as WorkspaceRole}`)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={t('invitations.revoke', { email: invitation.email })}
                  onClick={() => revoke.mutate(invitation.id)}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
