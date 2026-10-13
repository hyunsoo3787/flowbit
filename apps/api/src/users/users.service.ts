import { Injectable } from '@nestjs/common';
import {
  DEFAULT_LOCALE,
  isLocale,
  type UpdateProfileInput,
  type UserProfile,
} from '@flowbit/shared';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    locale: isLocale(user.locale) ? user.locale : DEFAULT_LOCALE,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    return toUserProfile(await this.prisma.user.findUniqueOrThrow({ where: { id: userId } }));
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    return toUserProfile(await this.prisma.user.update({ where: { id: userId }, data: input }));
  }
}
