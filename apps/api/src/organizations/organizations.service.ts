import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the user's personal organization, creating it if needed (D-008).
   * Safe to call concurrently: the unique `personalOwnerId` guarantees a
   * single personal organization per user.
   */
  async ensurePersonalOrganization(userId: string, name: string) {
    const existing = await this.prisma.organization.findUnique({
      where: { personalOwnerId: userId },
    });
    if (existing) return existing;
    try {
      return await this.prisma.organization.create({
        data: {
          name,
          personalOwnerId: userId,
          members: { create: { userId, role: 'OWNER' } },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.organization.findUniqueOrThrow({ where: { personalOwnerId: userId } });
      }
      throw error;
    }
  }

  async getMembershipRole(organizationId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    return membership?.role ?? null;
  }
}
