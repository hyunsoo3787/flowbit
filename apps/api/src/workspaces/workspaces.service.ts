import { Injectable } from '@nestjs/common';
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  Workspace as WorkspaceDto,
} from '@flowbit/shared';
import { AppError } from '../common/app-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  canCreateWorkspaceIn,
  canManageWorkspace,
  effectiveWorkspaceRole,
} from './workspace-policy.js';

/** Loads a workspace together with the caller's memberships, which decide their role. */
function withCallerMemberships(userId: string) {
  return {
    members: { where: { userId }, select: { role: true } },
    organization: { select: { members: { where: { userId }, select: { role: true } } } },
  } satisfies Prisma.WorkspaceInclude;
}

type WorkspaceWithMemberships = Prisma.WorkspaceGetPayload<{
  include: ReturnType<typeof withCallerMemberships>;
}>;

function roleOf(workspace: WorkspaceWithMemberships) {
  return effectiveWorkspaceRole(
    workspace.organization.members[0]?.role ?? null,
    workspace.members[0]?.role ?? null,
  );
}

function toDto(workspace: WorkspaceWithMemberships): WorkspaceDto | null {
  const role = roleOf(workspace);
  if (!role) return null;
  return {
    id: workspace.id,
    organizationId: workspace.organizationId,
    name: workspace.name,
    description: workspace.description,
    role,
    version: workspace.version,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  async list(userId: string): Promise<WorkspaceDto[]> {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        OR: [
          { members: { some: { userId } } },
          { organization: { members: { some: { userId, role: { in: ['OWNER', 'ADMIN'] } } } } },
        ],
      },
      include: withCallerMemberships(userId),
      orderBy: { createdAt: 'asc' },
    });
    return workspaces.map(toDto).filter((dto): dto is WorkspaceDto => dto !== null);
  }

  async get(userId: string, workspaceId: string): Promise<WorkspaceDto> {
    const dto = toDto(await this.load(userId, workspaceId));
    if (!dto) throw AppError.notFound('WORKSPACE_NOT_FOUND');
    return dto;
  }

  async create(
    user: { id: string; name: string },
    input: CreateWorkspaceInput,
  ): Promise<WorkspaceDto> {
    const organizationId =
      input.organizationId ??
      (await this.organizations.ensurePersonalOrganization(user.id, user.name)).id;
    const organizationRole = await this.organizations.getMembershipRole(organizationId, user.id);
    if (!canCreateWorkspaceIn(organizationRole)) throw AppError.notFound();

    const workspace = await this.prisma.workspace.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description ?? null,
        createdById: user.id,
        members: { create: { userId: user.id, role: 'ADMIN' } },
      },
      include: withCallerMemberships(user.id),
    });
    return toDto(workspace)!;
  }

  async update(
    userId: string,
    workspaceId: string,
    input: UpdateWorkspaceInput,
  ): Promise<WorkspaceDto> {
    await this.requireManage(userId, workspaceId);
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { ...input, version: { increment: 1 } },
      include: withCallerMemberships(userId),
    });
    return toDto(workspace)!;
  }

  async remove(userId: string, workspaceId: string): Promise<void> {
    await this.requireManage(userId, workspaceId);
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  /** The caller's effective role in a workspace, or null without access. */
  async getRole(userId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: withCallerMemberships(userId),
    });
    return workspace ? roleOf(workspace) : null;
  }

  private async load(userId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: withCallerMemberships(userId),
    });
    if (!workspace) throw AppError.notFound('WORKSPACE_NOT_FOUND');
    return workspace;
  }

  private async requireManage(userId: string, workspaceId: string) {
    const role = roleOf(await this.load(userId, workspaceId));
    // No access at all looks exactly like a missing workspace.
    if (!role) throw AppError.notFound('WORKSPACE_NOT_FOUND');
    if (!canManageWorkspace(role)) throw AppError.forbidden();
  }
}
