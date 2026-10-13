import type {
  Board as BoardDto,
  BoardRole,
  Card as CardDto,
  Label as LabelDto,
  LabelColor,
  List as ListDto,
  UserSummary,
} from '@flowbit/shared';
import { boardBackgroundSchema, DEFAULT_BOARD_BACKGROUND, labelColorSchema } from '@flowbit/shared';
import type { Board, Label, List, Prisma, User } from '../generated/prisma/client.js';

/** Relations every card query loads, for the assignee and label ids in its DTO. */
export const CARD_INCLUDE = {
  assignees: { select: { userId: true }, orderBy: { createdAt: 'asc' } },
  labels: { select: { labelId: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.CardInclude;

export type CardWithRelations = Prisma.CardGetPayload<{ include: typeof CARD_INCLUDE }>;

/** Fields of a user that other people on a board may see. */
export const USER_SUMMARY_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} satisfies Prisma.UserSelect;

export function toUserSummary(user: Pick<User, 'id' | 'name' | 'email' | 'image'>): UserSummary {
  return { id: user.id, name: user.name, email: user.email, image: user.image };
}

function color(value: string | null): LabelColor | null {
  if (value === null) return null;
  const parsed = labelColorSchema.safeParse(value);
  return parsed.success ? parsed.data : 'gray';
}

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

const iso = (date: Date | null) => date?.toISOString() ?? null;

export function toCardDto(card: CardWithRelations): CardDto {
  return {
    id: card.id,
    boardId: card.boardId,
    listId: card.listId,
    title: card.title,
    description: card.description,
    position: card.position,
    startAt: iso(card.startAt),
    dueAt: iso(card.dueAt),
    dueCompletedAt: iso(card.dueCompletedAt),
    coverColor: color(card.coverColor),
    assigneeIds: card.assignees.map((assignee) => assignee.userId),
    labelIds: card.labels.map((label) => label.labelId),
    badges: {
      comments: card.commentCount,
      checklistItems: card.checklistTotal,
      checklistItemsDone: card.checklistDone,
    },
    version: card.version,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

export function toLabelDto(label: Label): LabelDto {
  return {
    id: label.id,
    boardId: label.boardId,
    name: label.name,
    color: color(label.color) ?? 'gray',
    version: label.version,
  };
}
