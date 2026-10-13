import {
  type ClientToServerEvents,
  REALTIME_PATH,
  type ServerToClientEvents,
} from '@flowbit/shared';
import { io, type Socket } from 'socket.io-client';

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: RealtimeSocket | null = null;

/** The shared Socket.IO connection, created on first use (D-010). */
export function getSocket(): RealtimeSocket {
  socket ??= io({ path: REALTIME_PATH, withCredentials: true, transports: ['websocket'] });
  return socket;
}

/** Closes the connection, e.g. on sign-out, so the next user gets a fresh one. */
export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
