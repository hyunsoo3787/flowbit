import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import { ValkeyService } from '../valkey/valkey.service.js';

/**
 * Socket.IO adapter that fans events out through Valkey when it is configured,
 * so clients connected to any API replica receive them (D-002, D-010).
 */
export class RealtimeIoAdapter extends IoAdapter {
  private readonly clients: Redis[] = [];

  constructor(private readonly appContext: INestApplicationContext) {
    super(appContext);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    const valkey = this.appContext.get(ValkeyService).client;
    if (valkey) {
      const pub = valkey.duplicate();
      const sub = valkey.duplicate();
      this.clients.push(pub, sub);
      server.adapter(createAdapter(pub, sub));
    }
    return server;
  }

  override async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.all(this.clients.map((client) => client.quit().catch(() => undefined)));
    this.clients.length = 0;
  }
}
