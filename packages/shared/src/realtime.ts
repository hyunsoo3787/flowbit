import type { Board, Card, Label, List } from './board.js';
import type { BoardMember } from './members.js';

/** Socket.IO path, under /api so proxies only need to forward one prefix. */
export const REALTIME_PATH = '/api/socket.io';

/** Header carrying a client-generated id for a mutation, echoed in its events (D-010). */
export const CLIENT_MUTATION_ID_HEADER = 'x-client-mutation-id';

interface EventBase {
  boardId: string;
  actorId: string;
  clientMutationId: string | null;
}

/** Changes on a board, broadcast to everyone viewing it. */
export type BoardEvent = EventBase &
  (
    | { type: 'board.updated'; board: Omit<Board, 'role'> }
    | { type: 'board.deleted' }
    | { type: 'list.upserted'; list: List }
    | { type: 'list.deleted'; listId: string }
    | { type: 'card.upserted'; card: Card }
    | { type: 'card.deleted'; cardId: string }
    | { type: 'label.upserted'; label: Label }
    | { type: 'label.deleted'; labelId: string }
    /** The people with access changed; carries the full new list. */
    | { type: 'members.updated'; members: BoardMember[] }
    /** Checklists or comments of a card changed; clients showing them refetch. */
    | { type: 'card.content'; cardId: string; part: 'checklists' | 'comments' }
  );

export interface ServerToClientEvents {
  'board:event': (event: BoardEvent) => void;
}

export interface ClientToServerEvents {
  'board:join': (boardId: string, ack: (result: { ok: boolean }) => void) => void;
  'board:leave': (boardId: string) => void;
}
