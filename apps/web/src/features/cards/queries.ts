import type {
  Checklist,
  ChecklistItem,
  Comment,
  CommentPage,
  UpdateChecklistItemInput,
} from '@flowbit/shared';
import {
  type InfiniteData,
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, unwrap } from '@/api/client';
import { errorMessage } from '@/lib/errors';
import { mutationHeaders } from '@/lib/mutation-ids';
import { positionAtIndex } from '../boards/board-cache';

// Checklists and comments are loaded with the card dialog. Changes by others
// arrive as `card.content` events, which refetch these queries.

export const checklistsQuery = (cardId: string) =>
  queryOptions({
    queryKey: ['cards', cardId, 'checklists'],
    queryFn: async () =>
      (await unwrap(api.GET('/api/v1/cards/{cardId}/checklists', { params: { path: { cardId } } })))
        .items,
  });

export const commentsQuery = (cardId: string) =>
  infiniteQueryOptions({
    queryKey: ['cards', cardId, 'comments'],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/api/v1/cards/{cardId}/comments', {
          params: { path: { cardId }, query: pageParam ? { before: pageParam } : {} },
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page: CommentPage) => page.nextCursor,
  });

/**
 * A mutation on a card's checklists that patches the cached checklists
 * immediately, rolls back on error, and refetches afterwards for the
 * authoritative order and ids.
 */
function useChecklistMutation<TVariables>(
  cardId: string,
  request: (variables: TVariables, headers: Record<string, string>) => Promise<unknown>,
  optimistic: (checklists: Checklist[], variables: TVariables) => Checklist[],
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = checklistsQuery(cardId).queryKey;
  return useMutation({
    mutationFn: (variables: TVariables) => request(variables, mutationHeaders()),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      if (previous) queryClient.setQueryData(key, optimistic(previous, variables));
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(errorMessage(t, error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

const mapItems = (
  checklists: Checklist[],
  update: (item: ChecklistItem, checklist: Checklist) => ChecklistItem | null,
) =>
  checklists.map((checklist) => ({
    ...checklist,
    items: checklist.items.flatMap((item) => {
      const next = update(item, checklist);
      return next ? [next] : [];
    }),
  }));

export function useChecklistMutations(cardId: string) {
  const temp = () => `temp-${crypto.randomUUID()}`;

  const createChecklist = useChecklistMutation(
    cardId,
    ({ title }: { title: string }, headers) =>
      unwrap(
        api.POST('/api/v1/cards/{cardId}/checklists', {
          params: { path: { cardId } },
          body: { title },
          headers,
        }),
      ),
    (checklists, { title }) => [
      ...checklists,
      {
        id: temp(),
        cardId,
        title,
        position: positionAtIndex(checklists, checklists.length),
        items: [],
      },
    ],
  );

  const renameChecklist = useChecklistMutation(
    cardId,
    ({ checklistId, title }: { checklistId: string; title: string }, headers) =>
      unwrap(
        api.PATCH('/api/v1/checklists/{checklistId}', {
          params: { path: { checklistId } },
          body: { title },
          headers,
        }),
      ),
    (checklists, { checklistId, title }) =>
      checklists.map((checklist) =>
        checklist.id === checklistId ? { ...checklist, title } : checklist,
      ),
  );

  const deleteChecklist = useChecklistMutation(
    cardId,
    (checklistId: string, headers) =>
      api.DELETE('/api/v1/checklists/{checklistId}', {
        params: { path: { checklistId } },
        headers,
      }),
    (checklists, checklistId) => checklists.filter((checklist) => checklist.id !== checklistId),
  );

  const addItem = useChecklistMutation(
    cardId,
    ({ checklistId, text }: { checklistId: string; text: string }, headers) =>
      unwrap(
        api.POST('/api/v1/checklists/{checklistId}/items', {
          params: { path: { checklistId } },
          body: { text },
          headers,
        }),
      ),
    (checklists, { checklistId, text }) =>
      checklists.map((checklist) =>
        checklist.id === checklistId
          ? {
              ...checklist,
              items: [
                ...checklist.items,
                {
                  id: temp(),
                  checklistId,
                  text,
                  position: positionAtIndex(checklist.items, checklist.items.length),
                  completedAt: null,
                  assigneeId: null,
                  dueAt: null,
                },
              ],
            }
          : checklist,
      ),
  );

  const updateItem = useChecklistMutation(
    cardId,
    ({ itemId, ...body }: UpdateChecklistItemInput & { itemId: string }, headers) =>
      unwrap(
        api.PATCH('/api/v1/checklist-items/{itemId}', {
          params: { path: { itemId } },
          body,
          headers,
        }),
      ),
    (checklists, { itemId, completed, ...body }) =>
      mapItems(checklists, (item) =>
        item.id === itemId
          ? {
              ...item,
              ...body,
              ...(completed === undefined
                ? {}
                : { completedAt: completed ? new Date().toISOString() : null }),
            }
          : item,
      ),
  );

  const moveItem = useChecklistMutation(
    cardId,
    ({ itemId, toIndex }: { itemId: string; checklistId: string; toIndex: number }, headers) =>
      unwrap(
        api.POST('/api/v1/checklist-items/{itemId}/move', {
          params: { path: { itemId } },
          body: { toIndex },
          headers,
        }),
      ),
    (checklists, { itemId, checklistId, toIndex }) =>
      checklists.map((checklist) => {
        if (checklist.id !== checklistId) return checklist;
        const item = checklist.items.find((candidate) => candidate.id === itemId);
        if (!item) return checklist;
        const rest = checklist.items.filter((candidate) => candidate.id !== itemId);
        rest.splice(toIndex, 0, { ...item, position: positionAtIndex(rest, toIndex) });
        return { ...checklist, items: rest };
      }),
  );

  const deleteItem = useChecklistMutation(
    cardId,
    (itemId: string, headers) =>
      api.DELETE('/api/v1/checklist-items/{itemId}', { params: { path: { itemId } }, headers }),
    (checklists, itemId) => mapItems(checklists, (item) => (item.id === itemId ? null : item)),
  );

  return {
    createChecklist,
    renameChecklist,
    deleteChecklist,
    addItem,
    updateItem,
    moveItem,
    deleteItem,
  };
}

type CommentData = InfiniteData<CommentPage>;

function mapComments(data: CommentData, update: (comments: Comment[], index: number) => Comment[]) {
  return {
    ...data,
    pages: data.pages.map((page, i) => ({ ...page, items: update(page.items, i) })),
  };
}

export function useCommentMutations(cardId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = commentsQuery(cardId).queryKey;
  const onError = (error: Error) => toast.error(errorMessage(t, error));
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: (body: string) =>
      unwrap(
        api.POST('/api/v1/cards/{cardId}/comments', {
          params: { path: { cardId } },
          body: { body },
          headers: mutationHeaders(),
        }),
      ),
    onSuccess: (comment) =>
      queryClient.setQueryData(key, (data: CommentData | undefined) =>
        data
          ? mapComments(data, (comments, i) => (i === 0 ? [comment, ...comments] : comments))
          : data,
      ),
    onError,
  });

  const update = useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      unwrap(
        api.PATCH('/api/v1/comments/{commentId}', {
          params: { path: { commentId } },
          body: { body },
          headers: mutationHeaders(),
        }),
      ),
    onSuccess: (comment) =>
      queryClient.setQueryData(key, (data: CommentData | undefined) =>
        data
          ? mapComments(data, (comments) =>
              comments.map((existing) => (existing.id === comment.id ? comment : existing)),
            )
          : data,
      ),
    onError,
  });

  const remove = useMutation({
    mutationFn: (commentId: string) =>
      api.DELETE('/api/v1/comments/{commentId}', {
        params: { path: { commentId } },
        headers: mutationHeaders(),
      }),
    onMutate: (commentId) =>
      queryClient.setQueryData(key, (data: CommentData | undefined) =>
        data
          ? mapComments(data, (comments) => comments.filter((comment) => comment.id !== commentId))
          : data,
      ),
    onError: (error) => {
      onError(error);
      void refresh();
    },
  });

  return { create, update, remove };
}
