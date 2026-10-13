import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { meQuery } from '@/features/auth/queries';
import { isOwnMutation } from '@/lib/mutation-ids';
import { getSocket } from '@/lib/realtime';
import { applyEvent } from './board-cache';
import { boardQuery, boardsQuery } from './queries';

/**
 * Keeps a cached board in sync with changes made by others: joins the board's
 * room, applies incoming events, and refetches after joining to catch up on
 * anything missed before (while loading, or while offline).
 */
export function useBoardRealtime(boardId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const socket = getSocket();
    const key = boardQuery(boardId).queryKey;
    let joinedBefore = false;

    const join = () => {
      const startedAt = Date.now();
      socket.emit('board:join', boardId, () => {
        // Changes made between loading the board and joining its room were
        // never sent to this tab: catch up if the cached board is older.
        const loadedAt = queryClient.getQueryState(key)?.dataUpdatedAt ?? 0;
        if (joinedBefore || loadedAt < startedAt) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
        joinedBefore = true;
      });
    };

    const onEvent: Parameters<typeof socket.on<'board:event'>>[1] = (event) => {
      if (event.boardId !== boardId || isOwnMutation(event.clientMutationId)) return;
      if (event.type === 'board.deleted') {
        const workspaceId = queryClient.getQueryData(key)?.workspaceId;
        queryClient.removeQueries({ queryKey: key });
        toast.info(t('boards.deletedElsewhere'));
        if (workspaceId) {
          void queryClient.invalidateQueries({ queryKey: boardsQuery(workspaceId).queryKey });
          void navigate({ to: '/w/$workspaceId', params: { workspaceId } });
        } else {
          void navigate({ to: '/' });
        }
        return;
      }
      if (event.type === 'card.content') {
        void queryClient.invalidateQueries({ queryKey: ['cards', event.cardId, event.part] });
        return;
      }
      queryClient.setQueryData(key, (board) => {
        if (!board) return board;
        const next = applyEvent(board, event);
        if (event.type !== 'members.updated') return next;
        // The caller's own role may have changed too.
        const meId = queryClient.getQueryData(meQuery.queryKey)?.id;
        const mine = event.members.find((member) => member.user.id === meId);
        return mine ? { ...next, role: mine.role } : next;
      });
    };

    socket.on('connect', join);
    socket.on('board:event', onEvent);
    if (socket.connected) join();

    return () => {
      socket.off('connect', join);
      socket.off('board:event', onEvent);
      socket.emit('board:leave', boardId);
    };
  }, [boardId, queryClient, navigate, t]);
}
