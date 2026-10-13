import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isOwnMutation } from '@/lib/mutation-ids';
import { getSocket } from '@/lib/realtime';
import { applyEvent } from './board-cache';
import { boardQuery, boardsQuery } from './queries';

/**
 * Keeps a cached board in sync with changes made by others: joins the board's
 * room, applies incoming events, and refetches after reconnecting to catch up
 * on anything missed while offline.
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
      socket.emit('board:join', boardId, () => {
        if (joinedBefore) void queryClient.invalidateQueries({ queryKey: key });
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
      queryClient.setQueryData(key, (board) => (board ? applyEvent(board, event) : board));
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
