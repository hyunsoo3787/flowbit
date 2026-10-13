import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type CreateWorkspaceInput,
  createWorkspaceSchema,
  type UpdateWorkspaceInput,
  updateWorkspaceSchema,
  type Workspace,
  type WorkspaceList,
} from '@flowbit/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { ApiJsonBody, ApiJsonResponse } from '../common/api-docs.js';
import { IdParamPipe } from '../common/id-param.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { WorkspacesService } from './workspaces.service.js';

const workspaceIdPipe = new IdParamPipe('WORKSPACE_NOT_FOUND');

@ApiTags('workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  @ApiJsonResponse(200, 'WorkspaceList', 401)
  async list(@CurrentUser() user: AuthUser): Promise<WorkspaceList> {
    return { items: await this.workspaces.list(user.id) };
  }

  @Post()
  @ApiJsonBody('CreateWorkspaceInput')
  @ApiJsonResponse(201, 'Workspace', 400, 401, 404)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createWorkspaceSchema)) input: CreateWorkspaceInput,
  ): Promise<Workspace> {
    return this.workspaces.create(user, input);
  }

  @Get(':workspaceId')
  @ApiJsonResponse(200, 'Workspace', 401, 404)
  get(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', workspaceIdPipe) workspaceId: string,
  ): Promise<Workspace> {
    return this.workspaces.get(user.id, workspaceId);
  }

  @Patch(':workspaceId')
  @ApiJsonBody('UpdateWorkspaceInput')
  @ApiJsonResponse(200, 'Workspace', 400, 401, 403, 404)
  update(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', workspaceIdPipe) workspaceId: string,
    @Body(new ZodValidationPipe(updateWorkspaceSchema)) input: UpdateWorkspaceInput,
  ): Promise<Workspace> {
    return this.workspaces.update(user.id, workspaceId, input);
  }

  @Delete(':workspaceId')
  @HttpCode(204)
  @ApiJsonResponse(204, null, 401, 403, 404)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', workspaceIdPipe) workspaceId: string,
  ): Promise<void> {
    await this.workspaces.remove(user.id, workspaceId);
  }
}
