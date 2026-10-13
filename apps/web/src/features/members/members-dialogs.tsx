import type { BoardDetail, BoardRole, Workspace, WorkspaceRole } from '@flowbit/shared';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMe } from '@/features/auth/queries';
import { InvitePanel, RoleSelect, SELECT_CLASS } from './invite-panel';
import {
  useRemoveWorkspaceMember,
  useSetBoardMember,
  useUpdateWorkspaceMember,
  workspaceMembersQuery,
} from './queries';

/** Workspace members, their roles, and invitations. */
export function WorkspaceMembersDialog({
  workspace,
  trigger,
}: {
  workspace: Workspace;
  trigger: ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: members = [] } = useQuery(workspaceMembersQuery(workspace.id));
  const updateMember = useUpdateWorkspaceMember(workspace.id);
  const removeMember = useRemoveWorkspaceMember(workspace.id);
  const isAdmin = workspace.role === 'ADMIN';

  const memberList = (
    <ul className="grid gap-2">
      {members.map(({ user, role }) => {
        const self = user.id === me?.id;
        return (
          <li key={user.id} className="flex flex-wrap items-center gap-2">
            <Avatar user={user} size="md" />
            <span className="grid min-w-0 flex-1">
              <span className="truncate text-sm font-medium">
                {user.name}
                {self ? <span className="text-muted-foreground"> {t('members.you')}</span> : null}
              </span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
            {isAdmin ? (
              <RoleSelect<WorkspaceRole>
                scope="workspace"
                value={role}
                label={t('members.roleOf', { name: user.name })}
                onChange={(next) => updateMember.mutate({ userId: user.id, role: next })}
              />
            ) : (
              <span className="text-xs text-muted-foreground">{t(`workspaces.roles.${role}`)}</span>
            )}
            {isAdmin || self ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  const message = self
                    ? t('members.leaveConfirm', { name: workspace.name })
                    : t('members.removeConfirm', { name: user.name });
                  if (!window.confirm(message)) return;
                  removeMember.mutate(user.id, {
                    onSuccess: () => {
                      if (self) void navigate({ to: '/' });
                    },
                  });
                }}
              >
                {self ? t('members.leave') : t('members.remove')}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('members.workspaceTitle', { name: workspace.name })}</DialogTitle>
          <DialogDescription>{t('members.workspaceHint')}</DialogDescription>
        </DialogHeader>
        {isAdmin ? (
          <Tabs defaultValue="members">
            <TabsList>
              <TabsTrigger value="members">
                {t('members.tab', { count: members.length })}
              </TabsTrigger>
              <TabsTrigger value="invite">{t('invitations.tab')}</TabsTrigger>
            </TabsList>
            <TabsContent value="members">{memberList}</TabsContent>
            <TabsContent value="invite">
              <InvitePanel scope={{ kind: 'workspace', id: workspace.id }} />
            </TabsContent>
          </Tabs>
        ) : (
          memberList
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Who has access to a board, explicit board roles, and invitations. */
export function BoardShareDialog({ board, trigger }: { board: BoardDetail; trigger: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const setMember = useSetBoardMember(board.id);
  const isAdmin = board.role === 'ADMIN';
  const INHERITED = 'INHERITED';

  const memberList = (
    <ul className="grid gap-2">
      {board.members.map(({ user, role, boardRole }) => {
        const self = user.id === me?.id;
        return (
          <li key={user.id} className="flex flex-wrap items-center gap-2">
            <Avatar user={user} size="md" />
            <span className="grid min-w-0 flex-1">
              <span className="truncate text-sm font-medium">
                {user.name}
                {self ? <span className="text-muted-foreground"> {t('members.you')}</span> : null}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {boardRole
                  ? user.email
                  : t('members.viaWorkspace', { role: t(`boards.roles.${role}`) })}
              </span>
            </span>
            {isAdmin ? (
              <select
                aria-label={t('members.roleOf', { name: user.name })}
                className={SELECT_CLASS}
                value={boardRole ?? INHERITED}
                onChange={(event) => {
                  const value = event.target.value;
                  setMember.mutate({
                    userId: user.id,
                    role: value === INHERITED ? null : (value as BoardRole),
                  });
                }}
              >
                {boardRole ? null : <option value={INHERITED}>{t('members.inherited')}</option>}
                {(['ADMIN', 'MEMBER', 'OBSERVER'] as const).map((option) => (
                  <option key={option} value={option}>
                    {t(`boards.roles.${option}`)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-muted-foreground">{t(`boards.roles.${role}`)}</span>
            )}
            {boardRole && (isAdmin || self) ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  const message = self
                    ? t('members.leaveConfirm', { name: board.name })
                    : t('members.removeFromBoardConfirm', { name: user.name });
                  if (!window.confirm(message)) return;
                  setMember.mutate(
                    { userId: user.id, role: null },
                    {
                      onSuccess: ({ items }) => {
                        if (self && !items.some((member) => member.user.id === user.id)) {
                          void navigate({ to: '/' });
                        }
                      },
                    },
                  );
                }}
              >
                {self ? t('members.leave') : t('members.remove')}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('members.boardTitle', { name: board.name })}</DialogTitle>
          <DialogDescription>
            {board.visibility === 'PRIVATE'
              ? t('members.privateHint')
              : t('members.workspaceBoardHint')}
          </DialogDescription>
        </DialogHeader>
        {isAdmin ? (
          <Tabs defaultValue="members">
            <TabsList>
              <TabsTrigger value="members">
                {t('members.tab', { count: board.members.length })}
              </TabsTrigger>
              <TabsTrigger value="invite">{t('invitations.tab')}</TabsTrigger>
            </TabsList>
            <TabsContent value="members">{memberList}</TabsContent>
            <TabsContent value="invite">
              <InvitePanel scope={{ kind: 'board', id: board.id }} />
            </TabsContent>
          </Tabs>
        ) : (
          memberList
        )}
      </DialogContent>
    </Dialog>
  );
}
