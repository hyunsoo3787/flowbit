import type {
  Board as BoardDto,
  BoardRole,
  Card as CardDto,
  List as ListDto,
} from '@flowbit/shared';
import { boardBackgroundSchema, DEFAULT_BOARD_BACKGROUND } from '@flowbit/shared';
import type { Board, Card, List } from '../generated/prisma/client.js';

/** The stored color, or the default if a row somehow holds an invalid value. */
function background(value: string): string {
  return boardBackgroundSchema.safeParse(value).success ? value : DEFAULT_BOARD_BACKGROUND;
}

export function toBoardDto(board: Board, role: BoardRole): BoardDto {
  return { ...toBoardEventDto(board), role };
}

/** A board as broadcast to everyone on it: without the recipient-specific role. */
export function toBoardEventDto(board: Board): Omit<BoardDto, 'role'> {
  return {
    id: board.id,
    workspaceId: board.workspaceId,
    name: board.name,
    visibility: board.visibility,
    background: background(board.background),
    version: board.version,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

export function toListDto(list: List): ListDto {
  return {
    id: list.id,
    boardId: list.boardId,
    name: list.name,
    position: list.position,
    version: list.version,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  };
}

export function toCardDto(card: Card): CardDto {
  return {
    id: card.id,
    boardId: card.boardId,
    listId: card.listId,
    title: card.title,
    description: card.description,
    position: card.position,
    version: card.version,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}
