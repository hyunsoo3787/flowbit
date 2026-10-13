import type { BoardRole, WorkspaceRole } from '@flowbit/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, unwrap } from '@/api/client';
import { boardQuery } from '@/features/boards/queries';
import { errorMessage } from '@/lib/errors';
import { mutationHeaders } from '@/lib/mutation-ids';

export type Scope = { kind: 'workspace'; id: string } | { kind: 'board'; id: string };

export const workspaceMembersQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'members'],
    queryFn: async () =>
      (
        await unwrap(
          api.GET('/api/v1/workspaces/{workspaceId}/members', {
            params: { path: { workspaceId } },
          }),
        )
      ).items,
  });

export const invitationsQuery = (scope: Scope) =>
  queryOptions({
    queryKey: [scope.kind === 'board' ? 'boards' : 'workspaces', scope.id, 'invitations'],
    queryFn: async () =>
      (
        await unwrap(
          scope.kind === 'board'
            ? api.GET('/api/v1/boards/{boardId}/invitations', {
                params: { path: { boardId: scope.id } },
              })
            : api.GET('/api/v1/workspaces/{workspaceId}/invitations', {
                params: { path: { workspaceId: scope.id } },
              }),
        )
      ).items,
  });

export const invitationPreviewQuery = (token: string) =>
  queryOptions({
    queryKey: ['invitations', token],
    queryFn: () => unwrap(api.GET('/api/v1/invitations/{token}', { params: { path: { token } } })),
    retry: false,
  });

function useOnError() {
  const { t } = useTranslation();
  return (error: Error) => toast.error(errorMessage(t, error));
}

export function useInvite(scope: Scope) {
  const queryClient = useQueryClient();
  const onError = useOnError();
  return useMutation({
    mutationFn: ({ emails, role }: { emails: string[]; role: WorkspaceRole | BoardRole }) =>
      unwrap(
        scope.kind === 'board'
          ? api.POST('/api/v1/boards/{boardId}/invitations', {
              params: { path: { boardId: scope.id } },
              body: { emails, role: role as BoardRole },
            })
          : api.POST('/api/v1/workspaces/{workspaceId}/invitations', {
              params: { path: { workspaceId: scope.id } },
              body: { emails, role: role as WorkspaceRole },
            }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsQuery(scope).queryKey }),
    onError,
  });
}

export function useCreateInvitationLink(scope: Scope) {
  const queryClient = useQueryClient();
  const onError = useOnError();
  return useMutation({
    mutationFn: (role: WorkspaceRole | BoardRole) =>
      unwrap(
        scope.kind === 'board'
          ? api.POST('/api/v1/boards/{boardId}/invitation-link', {
              params: { path: { boardId: scope.id } },
              body: { role: role as BoardRole },
            })
          : api.POST('/api/v1/workspaces/{workspaceId}/invitation-link', {
              params: { path: { workspaceId: scope.id } },
              body: { role: role as WorkspaceRole },
            }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsQuery(scope).queryKey }),
    onError,
  });
}

export function useRevokeInvitation(scope: Scope) {
  const queryClient = useQueryClient();
  const onError = useOnError();
  return useMutation({
    mutationFn: (invitationId: string) =>
      api.DELETE('/api/v1/invitations/{invitationId}', {
        params: { path: { invitationId } },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsQuery(scope).queryKey }),
    onError,
  });
}

export function useUpdateWorkspaceMember(workspaceId: string) {
  const queryClient = useQueryClient();
  const onError = useOnError();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
      unwrap(
        api.PATCH('/api/v1/workspaces/{workspaceId}/members/{userId}', {
          params: { path: { workspaceId, userId } },
          body: { role },
        }),
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: workspaceMembersQuery(workspaceId).queryKey }),
    onError,
  });
}

export function useRemoveWorkspaceMember(workspaceId: string) {
  const queryClient = useQueryClient();
  const onError = useOnError();
  return useMutation({
    mutationFn: (userId: string) =>
      api.DELETE('/api/v1/workspaces/{workspaceId}/members/{userId}', {
        params: { path: { workspaceId, userId } },
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: workspaceMembersQuery(workspaceId).queryKey }),
    onError,
  });
}

/** Board memberships; the board's member list is replaced with the answer. */
export function useSetBoardMember(boardId: string) {
  const queryClient = useQueryClient();
  const onError = useOnError();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: BoardRole | null }) =>
      unwrap(
        role
          ? api.PUT('/api/v1/boards/{boardId}/members/{userId}', {
              params: { path: { boardId, userId } },
              body: { role },
              headers: mutationHeaders(),
            })
          : api.DELETE('/api/v1/boards/{boardId}/members/{userId}', {
              params: { path: { boardId, userId } },
              headers: mutationHeaders(),
            }),
      ),
    onSuccess: ({ items }) =>
      queryClient.setQueryData(boardQuery(boardId).queryKey, (board) =>
        board ? { ...board, members: items } : board,
      ),
    onError,
  });
}
