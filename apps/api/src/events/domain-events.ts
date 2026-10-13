import { Global, Injectable, Logger, Module } from '@nestjs/common';

/** Things that happened, for features that react to them (notifications). */
export type DomainEvent =
  | { type: 'card.created'; boardId: string; cardId: string; actorId: string; activityId: string }
  | {
      type: 'card.assigned';
      boardId: string;
      cardId: string;
      actorId: string;
      assigneeId: string;
      activityId: string;
    }
  | {
      type: 'card.moved';
      boardId: string;
      cardId: string;
      actorId: string;
      fromListId: string;
      toListId: string;
      activityId: string;
    }
  | {
      type: 'comment.created';
      boardId: string;
      cardId: string;
      actorId: string;
      commentId: string;
      body: string;
      activityId: string;
    };

type Handler = (event: DomainEvent) => Promise<void>;

/**
 * A small in-process event bus. Services emit after their transaction
 * commits; handlers run afterwards, so a failing handler never fails the
 * request. Work that must survive a restart goes to the job queue.
 */
@Injectable()
export class DomainEvents {
  private readonly logger = new Logger(DomainEvents.name);
  private readonly handlers: Handler[] = [];
  private readonly pending = new Set<Promise<void>>();

  subscribe(handler: Handler) {
    this.handlers.push(handler);
  }

  emit(event: DomainEvent) {
    for (const handler of this.handlers) {
      const run = handler(event)
        .catch((error: unknown) =>
          this.logger.error(`Handling ${event.type} failed: ${String(error)}`),
        )
        .finally(() => this.pending.delete(run));
      this.pending.add(run);
    }
  }

  /** Waits until every handler started so far has finished (tests, shutdown). */
  async settled() {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }
}

@Global()
@Module({ providers: [DomainEvents], exports: [DomainEvents] })
export class EventsModule {}
