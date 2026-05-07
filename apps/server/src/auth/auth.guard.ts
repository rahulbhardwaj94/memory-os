import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import type { User } from './auth';

// Kept for backwards-compat — no longer enforced but still imported by controllers/health
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

// No-auth mode: memory-os is self-hosted, so we always inject the single local
// user rather than enforcing sessions or API keys.
@Injectable()
export class AuthGuard implements CanActivate {
  private cachedUser: User | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    req['user'] = await this.localUser();
    return true;
  }

  private async localUser(): Promise<User> {
    if (this.cachedUser) return this.cachedUser;

    const row = await this.prisma.user.upsert({
      where: { email: env.DEFAULT_USER_EMAIL },
      create: { email: env.DEFAULT_USER_EMAIL, name: 'Local User', emailVerified: true },
      update: {},
    });

    this.cachedUser = {
      id: row.id,
      email: row.email,
      name: row.name,
      emailVerified: row.emailVerified,
      image: row.image ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as unknown as User;

    return this.cachedUser;
  }
}
