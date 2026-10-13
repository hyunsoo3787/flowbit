import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Health } from '@flowbit/shared';
import type { FastifyReply } from 'fastify';
import { Public } from '../auth/decorators.js';
import { ApiJsonResponse } from '../common/api-docs.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ValkeyService } from '../valkey/valkey.service.js';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly valkey: ValkeyService,
  ) {}

  @Get()
  @ApiJsonResponse(200, 'Health', 503)
  async check(@Res({ passthrough: true }) reply: FastifyReply): Promise<Health> {
    const database = await this.prisma.$queryRaw`SELECT 1`
      .then(() => 'up' as const)
      .catch(() => 'down' as const);
    const valkey = this.valkey.enabled
      ? (await this.valkey.ping())
        ? ('up' as const)
        : ('down' as const)
      : ('disabled' as const);
    const healthy = database === 'up' && valkey !== 'down';
    if (!healthy) reply.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: healthy ? 'ok' : 'degraded', checks: { database, valkey } };
  }
}
