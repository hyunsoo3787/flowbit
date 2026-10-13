import { Injectable, Logger } from '@nestjs/common';
import type { BoardEvent, ClientToServerEvents, ServerToClientEvents } from '@flowbit/shared';
import type { Server } from 'socket.io';

export interface SocketData {
  userId: string;
}

export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

export const boardRoom = (boardId: string) => `board:${boardId}`;

/**
 * Broadcasts board changes to everyone viewing the board (D-010, level 1).
 * Services publish after their transaction commits. With Valkey configured,
 * the Socket.IO adapter delivers events to clients on every API replica.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: RealtimeServer | null = null;

  attach(server: RealtimeServer) {
    this.server = server;
  }

  publish(event: BoardEvent) {
    this.server?.to(boardRoom(event.boardId)).emit('board:event', event);
  }

  /** Removes every socket from a board's room, e.g. after the board was deleted. */
  closeRoom(boardId: string) {
    this.server?.in(boardRoom(boardId)).socketsLeave(boardRoom(boardId));
  }

  /** Removes sockets whose user may no longer see the board, e.g. after a visibility change. */
  async evict(boardId: string, canStay: (userId: string) => Promise<boolean>) {
    if (!this.server) return;
    try {
      const sockets = await this.server.in(boardRoom(boardId)).fetchSockets();
      await Promise.all(
        sockets.map(async (socket) => {
          if (!(await canStay(socket.data.userId))) socket.leave(boardRoom(boardId));
        }),
      );
    } catch (error) {
      this.logger.warn(`Could not re-check room ${boardId}: ${String(error)}`);
    }
  }
}
