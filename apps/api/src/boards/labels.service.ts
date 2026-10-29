import { Injectable } from '@nestjs/common';
import type { createLabelSchema, Label as LabelDto, UpdateLabelInput } from '@flowbit/shared';
import type { z } from 'zod';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { BoardAccessService } from './board-access.service.js';
import { canEditContent } from './board-policy.js';
import { toLabelDto } from './mappers.js';

/** A board's labels. Members and admins manage them (docs/ARCHITECTURE.md, "Authorization"). */
@Injectable()
export class LabelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(
    userId: string,
    boardId: string,
    input: z.output<typeof createLabelSchema>,
    clientMutationId: string | null,
  ): Promise<LabelDto> {
    await this.access.require(userId, boardId, canEditContent);
    const label = await this.prisma.label.create({
      data: { boardId, name: input.name, color: input.color },
    });
    this.publish(toLabelDto(label), userId, clientMutationId);
    return toLabelDto(label);
  }

  async update(
    userId: string,
    labelId: string,
    input: UpdateLabelInput,
    clientMutationId: string | null,
  ): Promise<LabelDto> {
    await this.requireEditable(userId, labelId);
    const label = await this.prisma.label.update({
      where: { id: labelId },
      data: { ...input, version: { increment: 1 } },
    });
    this.publish(toLabelDto(label), userId, clientMutationId);
    return toLabelDto(label);
  }

  async remove(userId: string, labelId: string, clientMutationId: string | null) {
    const label = await this.requireEditable(userId, labelId);
    await this.prisma.label.delete({ where: { id: labelId } });
    this.realtime.publish({
      type: 'label.deleted',
      boardId: label.boardId,
      actorId: userId,
      clientMutationId,
      labelId,
    });
  }

  private async requireEditable(userId: string, labelId: string) {
    const label = await this.prisma.label.findUnique({ where: { id: labelId } });
    if (!label) throw AppError.notFound('LABEL_NOT_FOUND');
    await this.access.require(userId, label.boardId, canEditContent, {
      notFound: 'LABEL_NOT_FOUND',
    });
    return label;
  }

  private publish(label: LabelDto, actorId: string, clientMutationId: string | null) {
    this.realtime.publish({
      type: 'label.upserted',
      boardId: label.boardId,
      actorId,
      clientMutationId,
      label,
    });
  }
}
