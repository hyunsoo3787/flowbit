import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import {
  type ClientToServerEvents,
  REALTIME_PATH,
  type ServerToClientEvents,
} from '@flowbit/shared';
import { fromNodeHeaders } from 'better-auth/node';
import type { Socket } from 'socket.io';
import { z } from 'zod';
import { AUTH } from '../auth/auth.constants.js';
import type { Auth } from '../auth/create-auth.js';
import { BoardAccessService } from '../boards/board-access.service.js';
import { ENV, type Env } from '../config/env.js';
import {
  boardRoom,
  type RealtimeServer,
  RealtimeService,
  type SocketData,
  userRoom,
} from './realtime.service.js';

const boardIdSchema = z.uuid();
const editingSchema = z.object({ boardId: z.uuid(), cardId: z.uuid(), editing: z.boolean() });

type RealtimeSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

@WebSocketGateway({ path: REALTIME_PATH, serveClient: false })
export class RealtimeGateway
  implements OnGatewayInit<RealtimeServer>, OnGatewayConnection<RealtimeSocket>
{
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(ENV) private readonly env: Env,
    private readonly boardAccess: BoardAccessService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: RealtimeServer) {
    this.realtime.attach(server);
    const trustedOrigins = new Set(
      [this.env.PUBLIC_URL, ...this.env.TRUSTED_ORIGINS].map((url) => new URL(url).origin),
    );

    // Authenticate every connection with the session cookie. Browsers send
    // cookies on cross-site WebSocket handshakes too, so also check the origin.
    server.use(async (socket, next) => {
      const origin = socket.handshake.headers.origin;
      if (origin && !trustedOrigins.has(origin)) return next(new Error('FORBIDDEN'));
      try {
        const session = await this.auth.api.getSession({
          headers: fromNodeHeaders(socket.handshake.headers),
        });
        if (!session) return next(new Error('UNAUTHENTICATED'));
        const { id, name, email, image } = session.user;
        socket.data.userId = id;
        socket.data.user = { id, name, email, image: image ?? null };
        next();
      } catch (error) {
        this.logger.warn(`Socket authentication failed: ${String(error)}`);
        next(new Error('UNAUTHENTICATED'));
      }
    });
  }

  async handleConnection(socket: RealtimeSocket) {
    await socket.join(userRoom(socket.data.userId));
    // Rooms are already empty once 'disconnect' fires, so note the boards first.
    socket.on('disconnecting', () => {
      const boards = [...socket.rooms].filter((room) => room.startsWith('board:'));
      setImmediate(() => {
        for (const room of boards)
          void this.realtime.broadcastPresence(room.slice('board:'.length));
      });
    });
  }

  /** Subscribes to a board's events, if the user may see the board. */
  @SubscribeMessage('board:join')
  async join(@ConnectedSocket() socket: RealtimeSocket, @MessageBody() boardId: unknown) {
    const parsed = boardIdSchema.safeParse(boardId);
    if (!parsed.success) return { ok: false };
    const role = await this.boardAccess.getRole(socket.data.userId, parsed.data);
    if (!role) return { ok: false };
    await socket.join(boardRoom(parsed.data));
    void this.realtime.broadcastPresence(parsed.data);
    return { ok: true };
  }

  @SubscribeMessage('board:leave')
  async leave(@ConnectedSocket() socket: RealtimeSocket, @MessageBody() boardId: unknown) {
    if (typeof boardId !== 'string' || !socket.rooms.has(boardRoom(boardId))) return;
    await socket.leave(boardRoom(boardId));
    void this.realtime.broadcastPresence(boardId);
  }

  /** Relays "someone is editing this card" to the others on the board (level 2). */
  @SubscribeMessage('card:editing')
  editing(@ConnectedSocket() socket: RealtimeSocket, @MessageBody() body: unknown) {
    const parsed = editingSchema.safeParse(body);
    if (!parsed.success || !socket.rooms.has(boardRoom(parsed.data.boardId))) return;
    socket.to(boardRoom(parsed.data.boardId)).emit('card:editing', {
      ...parsed.data,
      user: socket.data.user,
    });
  }
}
