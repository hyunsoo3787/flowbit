import type { Board, Card, Label, List } from './board.js';
import type { BoardMember, UserSummary } from './members.js';
import type { Notification } from './notifications.js';

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

/** Who has a board open right now (real-time level 2). */
export interface BoardPresence {
  boardId: string;
  users: UserSummary[];
}

/** Someone started or stopped editing a card (its description or a comment). */
export interface CardEditing {
  boardId: string;
  cardId: string;
  user: UserSummary;
  editing: boolean;
}

/** How long an "editing" signal lasts unless it is renewed. */
export const EDITING_TTL_MS = 15_000;

export interface ServerToClientEvents {
  'board:event': (event: BoardEvent) => void;
  'board:presence': (presence: BoardPresence) => void;
  'card:editing': (editing: CardEditing) => void;
  /** A new notification for the connected user. */
  notification: (notification: Notification) => void;
  /** Notifications were read elsewhere; refresh the unread count. */
  'notifications:changed': () => void;
}

export interface ClientToServerEvents {
  'board:join': (boardId: string, ack: (result: { ok: boolean }) => void) => void;
  'board:leave': (boardId: string) => void;
  'card:editing': (input: { boardId: string; cardId: string; editing: boolean }) => void;
}
