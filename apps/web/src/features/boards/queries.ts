import {
  type BoardDetail,
  type Card,
  comparePositions,
  type CreateBoardInput,
  type CreateLabelInput,
  type List,
  type UpdateBoardInput,
  type UpdateCardInput,
  type UpdateLabelInput,
} from '@flowbit/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, unwrap } from '@/api/client';
import { errorMessage } from '@/lib/errors';
import { mutationHeaders } from '@/lib/mutation-ids';
import {
  cardsInList,
  positionAtIndex,
  removeCard,
  removeLabel,
  removeList,
  updateBoardFields,
  upsertCard,
  upsertLabel,
  upsertList,
} from './board-cache';

export const boardsQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'boards'],
    queryFn: async () =>
      (
        await unwrap(
          api.GET('/api/v1/workspaces/{workspaceId}/boards', { params: { path: { workspaceId } } }),
        )
      ).items,
  });

/** Boards someone was invited to without joining their workspace. */
export const sharedBoardsQuery = queryOptions({
  queryKey: ['shared-boards'],
  queryFn: async () => (await unwrap(api.GET('/api/v1/me/shared-boards'))).items,
});

export const boardQuery = (boardId: string) =>
  queryOptions({
    queryKey: ['boards', boardId],
    queryFn: () => unwrap(api.GET('/api/v1/boards/{boardId}', { params: { path: { boardId } } })),
  });

export function useCreateBoard(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBoardInput) =>
      unwrap(
        api.POST('/api/v1/workspaces/{workspaceId}/boards', {
          params: { path: { workspaceId } },
          body,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardsQuery(workspaceId).queryKey }),
  });
}

/**
 * A board mutation that updates the cached board immediately (synchronously,
 * so a drop in drag and drop never flickers), rolls back if the request
 * fails, and applies the server's answer when it succeeds.
 */
function useBoardMutation<TVariables, TResult>(
  boardId: string,
  options: {
    request: (variables: TVariables, headers: Record<string, string>) => Promise<TResult>;
    optimistic: (board: BoardDetail, variables: TVariables) => BoardDetail;
    settle?: (board: BoardDetail, result: TResult, variables: TVariables) => BoardDetail;
    onSuccess?: (result: TResult) => void;
  },
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = boardQuery(boardId).queryKey;

  const mutation = useMutation({
    mutationFn: ({ variables }: { variables: TVariables; previous: BoardDetail | undefined }) =>
      options.request(variables, mutationHeaders()),
    onError: (error, { previous }) => {
      if (previous) queryClient.setQueryData(key, previous);
      toast.error(errorMessage(t, error));
    },
    onSuccess: (result, { variables }) => {
      const settle = options.settle;
      if (settle) {
        queryClient.setQueryData(key, (board) =>
          board ? settle(board, result, variables) : board,
        );
      }
      options.onSuccess?.(result);
    },
  });

  const mutate = (variables: TVariables) => {
    // Stop any refetch first, so its response can't overwrite the optimistic state.
    void queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData(key);
    if (previous) queryClient.setQueryData(key, options.optimistic(previous, variables));
    mutation.mutate({ variables, previous });
  };

  return { mutate, isPending: mutation.isPending };
}

export function useUpdateBoard(boardId: string) {
  const queryClient = useQueryClient();
  return useBoardMutation(boardId, {
    request: (body: UpdateBoardInput, headers) =>
      unwrap(
        api.PATCH('/api/v1/boards/{boardId}', { params: { path: { boardId } }, body, headers }),
      ),
    optimistic: (board, body) => ({ ...board, ...body }),
    settle: (board, result) => updateBoardFields(board, result),
    onSuccess: (result) =>
      void queryClient.invalidateQueries({ queryKey: boardsQuery(result.workspaceId).queryKey }),
  });
}

export function useDeleteBoard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.DELETE('/api/v1/boards/{boardId}', {
        params: { path: { boardId } },
        headers: mutationHeaders(),
      }),
    onSuccess: () => {
      const workspaceId = queryClient.getQueryData(boardQuery(boardId).queryKey)?.workspaceId;
      queryClient.removeQueries({ queryKey: boardQuery(boardId).queryKey });
      if (workspaceId) {
        void queryClient.invalidateQueries({ queryKey: boardsQuery(workspaceId).queryKey });
      }
    },
  });
}

const tempId = () => `temp-${crypto.randomUUID()}`;
const nowIso = () => new Date().toISOString();

export function useCreateList(boardId: string) {
  return useBoardMutation(boardId, {
    request: ({ name }: { name: string; tempId: string }, headers) =>
      unwrap(
        api.POST('/api/v1/boards/{boardId}/lists', {
          params: { path: { boardId } },
          body: { name },
          headers,
        }),
      ),
    optimistic: (board, { name, tempId: id }) =>
      upsertList(board, {
        id,
        boardId,
        name,
        position: positionAtIndex(board.lists, board.lists.length),
        version: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }),
    settle: (board, list, { tempId: id }) => upsertList(removeList(board, id), list),
  });
}

export function useRenameList(boardId: string) {
  return useBoardMutation(boardId, {
    request: ({ listId, name }: { listId: string; name: string }, headers) =>
      unwrap(
        api.PATCH('/api/v1/lists/{listId}', {
          params: { path: { listId } },
          body: { name },
          headers,
        }),
      ),
    optimistic: (board, { listId, name }) => ({
      ...board,
      lists: board.lists.map((list) => (list.id === listId ? { ...list, name } : list)),
    }),
    settle: upsertList,
  });
}

export function useMoveList(boardId: string) {
  return useBoardMutation(boardId, {
    request: (
      { listId, toIndex, toBoardId }: { listId: string; toIndex: number; toBoardId?: string },
      headers,
    ) =>
      unwrap(
        api.POST('/api/v1/lists/{listId}/move', {
          params: { path: { listId } },
          body: { toIndex, ...(toBoardId ? { toBoardId } : {}) },
          headers,
        }),
      ),
    optimistic: (board, { listId, toIndex, toBoardId }) => {
      if (toBoardId && toBoardId !== board.id) return removeList(board, listId);
      const list = board.lists.find((item) => item.id === listId);
      if (!list) return board;
      const siblings = board.lists.filter((item) => item.id !== listId);
      return upsertList(board, { ...list, position: positionAtIndex(siblings, toIndex) });
    },
    settle: upsertList,
  });
}

export function useDeleteList(boardId: string) {
  return useBoardMutation(boardId, {
    request: (listId: string, headers) =>
      api.DELETE('/api/v1/lists/{listId}', { params: { path: { listId } }, headers }),
    optimistic: removeList,
  });
}

export function useCreateCard(boardId: string) {
  return useBoardMutation(boardId, {
    request: ({ listId, title }: { listId: string; title: string; tempId: string }, headers) =>
      unwrap(
        api.POST('/api/v1/lists/{listId}/cards', {
          params: { path: { listId } },
          body: { title },
          headers,
        }),
      ),
    optimistic: (board, { listId, title, tempId: id }) => {
      const siblings = cardsInList(board, listId);
      return upsertCard(board, {
        id,
        boardId,
        listId,
        title,
        description: '',
        position: positionAtIndex(siblings, siblings.length),
        startAt: null,
        dueAt: null,
        dueCompletedAt: null,
        coverColor: null,
        assigneeIds: [],
        labelIds: [],
        badges: { comments: 0, checklistItems: 0, checklistItemsDone: 0 },
        version: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    },
    settle: (board, card, { tempId: id }) => upsertCard(removeCard(board, id), card),
  });
}

export function useUpdateCard(boardId: string) {
  return useBoardMutation(boardId, {
    request: ({ cardId, ...body }: UpdateCardInput & { cardId: string }, headers) =>
      unwrap(api.PATCH('/api/v1/cards/{cardId}', { params: { path: { cardId } }, body, headers })),
    optimistic: (board, { cardId, dueComplete, ...body }) => ({
      ...board,
      cards: board.cards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              ...body,
              ...(dueComplete === undefined
                ? {}
                : { dueCompletedAt: dueComplete ? (card.dueCompletedAt ?? nowIso()) : null }),
            }
          : card,
      ),
    }),
    settle: upsertCard,
  });
}

function toggle(ids: string[], id: string, on: boolean) {
  return on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((item) => item !== id);
}

export function useSetAssignee(boardId: string) {
  return useBoardMutation(boardId, {
    request: (
      { cardId, userId, assigned }: { cardId: string; userId: string; assigned: boolean },
      headers,
    ) => {
      const options = { params: { path: { cardId, userId } }, headers };
      return unwrap(
        assigned
          ? api.PUT('/api/v1/cards/{cardId}/assignees/{userId}', options)
          : api.DELETE('/api/v1/cards/{cardId}/assignees/{userId}', options),
      );
    },
    optimistic: (board, { cardId, userId, assigned }) => ({
      ...board,
      cards: board.cards.map((card) =>
        card.id === cardId
          ? { ...card, assigneeIds: toggle(card.assigneeIds, userId, assigned) }
          : card,
      ),
    }),
    settle: upsertCard,
  });
}

export function useSetCardLabel(boardId: string) {
  return useBoardMutation(boardId, {
    request: (
      { cardId, labelId, applied }: { cardId: string; labelId: string; applied: boolean },
      headers,
    ) => {
      const options = { params: { path: { cardId, labelId } }, headers };
      return unwrap(
        applied
          ? api.PUT('/api/v1/cards/{cardId}/labels/{labelId}', options)
          : api.DELETE('/api/v1/cards/{cardId}/labels/{labelId}', options),
      );
    },
    optimistic: (board, { cardId, labelId, applied }) => ({
      ...board,
      cards: board.cards.map((card) =>
        card.id === cardId ? { ...card, labelIds: toggle(card.labelIds, labelId, applied) } : card,
      ),
    }),
    settle: upsertCard,
  });
}

export function useCreateLabel(boardId: string) {
  return useBoardMutation(boardId, {
    request: (body: CreateLabelInput & { tempId: string }, headers) =>
      unwrap(
        api.POST('/api/v1/boards/{boardId}/labels', {
          params: { path: { boardId } },
          body: { name: body.name, color: body.color },
          headers,
        }),
      ),
    optimistic: (board, { tempId: id, name, color }) =>
      upsertLabel(board, { id, boardId, name: name ?? '', color, version: 0 }),
    settle: (board, label, { tempId: id }) => upsertLabel(removeLabel(board, id), label),
  });
}

export function useUpdateLabel(boardId: string) {
  return useBoardMutation(boardId, {
    request: ({ labelId, ...body }: UpdateLabelInput & { labelId: string }, headers) =>
      unwrap(
        api.PATCH('/api/v1/labels/{labelId}', { params: { path: { labelId } }, body, headers }),
      ),
    optimistic: (board, { labelId, ...body }) => ({
      ...board,
      labels: board.labels.map((label) => (label.id === labelId ? { ...label, ...body } : label)),
    }),
    settle: upsertLabel,
  });
}

export function useDeleteLabel(boardId: string) {
  return useBoardMutation(boardId, {
    request: (labelId: string, headers) =>
      api.DELETE('/api/v1/labels/{labelId}', { params: { path: { labelId } }, headers }),
    optimistic: removeLabel,
  });
}

export function useMoveCard(boardId: string) {
  return useBoardMutation(boardId, {
    request: (
      { cardId, toListId, toIndex }: { cardId: string; toListId: string; toIndex: number },
      headers,
    ) =>
      unwrap(
        api.POST('/api/v1/cards/{cardId}/move', {
          params: { path: { cardId } },
          body: { toListId, toIndex },
          headers,
        }),
      ),
    optimistic: (board, { cardId, toListId, toIndex }) => {
      const card = board.cards.find((item) => item.id === cardId);
      if (!card) return board;
      if (!board.lists.some((list) => list.id === toListId)) return removeCard(board, cardId);
      const siblings = cardsInList(board, toListId).filter((item) => item.id !== cardId);
      return upsertCard(board, {
        ...card,
        listId: toListId,
        position: positionAtIndex(siblings, toIndex),
      });
    },
    settle: upsertCard,
  });
}

export function useDeleteCard(boardId: string) {
  return useBoardMutation(boardId, {
    request: (cardId: string, headers) =>
      api.DELETE('/api/v1/cards/{cardId}', { params: { path: { cardId } }, headers }),
    optimistic: removeCard,
  });
}

/** Sorted lists of a board, with their cards. */
export function boardColumns(board: BoardDetail): { list: List; cards: Card[] }[] {
  const byList = new Map<string, Card[]>();
  for (const card of board.cards) {
    const cards = byList.get(card.listId) ?? [];
    cards.push(card);
    byList.set(card.listId, cards);
  }
  return [...board.lists]
    .sort(comparePositions)
    .map((list) => ({ list, cards: (byList.get(list.id) ?? []).sort(comparePositions) }));
}

export function newTempId() {
  return tempId();
}
