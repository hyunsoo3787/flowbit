import { EDITING_TTL_MS, type UserSummary } from '@flowbit/shared';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { getSocket } from '@/lib/realtime';

/** Real-time level 2 for one board: who has it open, and who is editing which card. */
interface BoardLive {
  viewers: UserSummary[];
  /** People editing each card right now, without the viewer. */
  editing: Map<string, UserSummary[]>;
}

const BoardLiveContext = createContext<BoardLive>({ viewers: [], editing: new Map() });

export function useBoardLive() {
  return useContext(BoardLiveContext);
}

export function BoardLiveProvider({ boardId, children }: { boardId: string; children: ReactNode }) {
  const [viewers, setViewers] = useState<UserSummary[]>([]);
  // cardId → userId → { user, until }
  const [signals, setSignals] = useState(
    new Map<string, Map<string, { user: UserSummary; until: number }>>(),
  );

  useEffect(() => {
    const socket = getSocket();
    const onPresence: Parameters<typeof socket.on<'board:presence'>>[1] = (presence) => {
      if (presence.boardId === boardId) setViewers(presence.users);
    };
    const onEditing: Parameters<typeof socket.on<'card:editing'>>[1] = (event) => {
      if (event.boardId !== boardId) return;
      setSignals((current) => {
        const next = new Map(current);
        const people = new Map(next.get(event.cardId));
        if (event.editing) {
          people.set(event.user.id, { user: event.user, until: Date.now() + EDITING_TTL_MS });
        } else {
          people.delete(event.user.id);
        }
        next.set(event.cardId, people);
        return next;
      });
    };
    // Signals that weren't renewed expire, e.g. when someone's tab closed.
    const sweep = setInterval(() => {
      const now = Date.now();
      setSignals((current) => {
        let changed = false;
        const next = new Map<string, Map<string, { user: UserSummary; until: number }>>();
        for (const [cardId, people] of current) {
          const alive = new Map([...people].filter(([, signal]) => signal.until > now));
          if (alive.size !== people.size) changed = true;
          if (alive.size > 0) next.set(cardId, alive);
        }
        return changed ? next : current;
      });
    }, 3000);
    socket.on('board:presence', onPresence);
    socket.on('card:editing', onEditing);
    return () => {
      socket.off('board:presence', onPresence);
      socket.off('card:editing', onEditing);
      clearInterval(sweep);
      setViewers([]);
      setSignals(new Map());
    };
  }, [boardId]);

  const editing = new Map(
    [...signals].map(([cardId, people]) => [
      cardId,
      [...people.values()].map((signal) => signal.user),
    ]),
  );
  return <BoardLiveContext value={{ viewers, editing }}>{children}</BoardLiveContext>;
}

/**
 * Tells others on the board that the viewer is editing a card while `active`
 * is true, renewing the signal before it expires.
 */
export function useEditingSignal(boardId: string, cardId: string, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const socket = getSocket();
    const send = (editing: boolean) => socket.emit('card:editing', { boardId, cardId, editing });
    send(true);
    const renew = setInterval(() => send(true), EDITING_TTL_MS / 2);
    return () => {
      clearInterval(renew);
      send(false);
    };
  }, [boardId, cardId, active]);
}
