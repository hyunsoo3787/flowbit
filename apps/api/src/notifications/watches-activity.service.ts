import { Injectable } from '@nestjs/common';
import type { Activity, ActivityPage } from '@flowbit/shared';
import { BoardAccessService } from '../boards/board-access.service.js';
import { CardsService } from '../boards/cards.service.js';
import { toUserSummary, USER_SUMMARY_SELECT } from '../boards/mappers.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const PAGE_SIZE = 40;

/** Following boards and cards, and what happened on them. */
@Injectable()
export class WatchesActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly cards: CardsService,
  ) {}

  /** Anyone who can see a board may watch it. */
  async watchBoard(userId: string, boardId: string, watching: boolean) {
    await this.access.require(userId, boardId, () => true);
    if (watching) {
      await this.prisma.watch.createMany({ data: [{ userId, boardId }], skipDuplicates: true });
    } else {
      await this.prisma.watch.deleteMany({ where: { userId, boardId } });
    }
    return { watching };
  }

  async watchCard(userId: string, cardId: string, watching: boolean) {
    await this.cards.requireCard(userId, cardId, () => true);
    if (watching) {
      await this.prisma.watch.createMany({ data: [{ userId, cardId }], skipDuplicates: true });
    } else {
      await this.prisma.watch.deleteMany({ where: { userId, cardId } });
    }
    return { watching };
  }

  async boardActivity(userId: string, boardId: string, cursor?: string): Promise<ActivityPage> {
    await this.access.require(userId, boardId, () => true);
    return this.page({ boardId }, cursor);
  }

  async cardActivity(userId: string, cardId: string, cursor?: string): Promise<ActivityPage> {
    const card = await this.cards.requireCard(userId, cardId, () => true);
    // A card that moved between boards keeps only the history visible on its current board.
    return this.page({ cardId, boardId: card.boardId }, cursor);
  }

  /** Newest first; activity ids are UUIDv7 and sort by time. */
  private async page(where: Prisma.ActivityWhereInput, cursor?: string): Promise<ActivityPage> {
    const rows = await this.prisma.activity.findMany({
      where: { ...where, ...(cursor ? { id: { lt: cursor } } : {}) },
      orderBy: { id: 'desc' },
      take: PAGE_SIZE + 1,
      include: {
        actor: { select: USER_SUMMARY_SELECT },
        card: { select: { id: true, title: true } },
      },
    });
    const page = rows.slice(0, PAGE_SIZE);
    return {
      items: page.map((row): Activity => ({
        id: row.id,
        type: row.type,
        actor: row.actor ? toUserSummary(row.actor) : null,
        card: row.card,
        payload: (row.payload ?? {}) as Record<string, unknown>,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: rows.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
    };
  }
}
