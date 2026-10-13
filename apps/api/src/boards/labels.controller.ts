import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createLabelSchema,
  type Label,
  type UpdateLabelInput,
  updateLabelSchema,
} from '@flowbit/shared';
import type { z } from 'zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { ApiJsonBody, ApiJsonResponse } from '../common/api-docs.js';
import { IdParamPipe } from '../common/id-param.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ApiClientMutationId, ClientMutationId } from '../realtime/client-mutation-id.decorator.js';
import { LabelsService } from './labels.service.js';

const boardIdPipe = new IdParamPipe('BOARD_NOT_FOUND');
const labelIdPipe = new IdParamPipe('LABEL_NOT_FOUND');

@ApiTags('labels')
@Controller()
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Post('boards/:boardId/labels')
  @ApiClientMutationId()
  @ApiJsonBody('CreateLabelInput')
  @ApiJsonResponse(201, 'Label', 400, 401, 403, 404)
  create(
    @CurrentUser() user: AuthUser,
    @Param('boardId', boardIdPipe) boardId: string,
    @Body(new ZodValidationPipe(createLabelSchema)) input: z.output<typeof createLabelSchema>,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Label> {
    return this.labels.create(user.id, boardId, input, clientMutationId);
  }

  @Patch('labels/:labelId')
  @ApiClientMutationId()
  @ApiJsonBody('UpdateLabelInput')
  @ApiJsonResponse(200, 'Label', 400, 401, 403, 404)
  update(
    @CurrentUser() user: AuthUser,
    @Param('labelId', labelIdPipe) labelId: string,
    @Body(new ZodValidationPipe(updateLabelSchema)) input: UpdateLabelInput,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<Label> {
    return this.labels.update(user.id, labelId, input, clientMutationId);
  }

  @Delete('labels/:labelId')
  @HttpCode(204)
  @ApiClientMutationId()
  @ApiJsonResponse(204, null, 401, 403, 404)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('labelId', labelIdPipe) labelId: string,
    @ClientMutationId() clientMutationId: string | null,
  ): Promise<void> {
    await this.labels.remove(user.id, labelId, clientMutationId);
  }
}
