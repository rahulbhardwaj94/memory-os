import { All, Controller, Req, Res, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { IncomingMessage, ServerResponse } from 'http';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './auth.guard';
import { auth } from './auth';
import { ApiKeyService } from './api-key.service';
import { CurrentUser } from './current-user.decorator';
import type { User } from './auth';

/**
 * /auth/** — catch-all proxied to Better Auth (sign-in, sign-up, sessions, etc.)
 * /auth/api-keys — managed by our own ApiKeyService (list, create, revoke)
 */
@Controller('auth')
@SkipThrottle()
export class AuthController {
  private readonly betterAuthHandler = toNodeHandler(auth);

  constructor(private readonly apiKeyService: ApiKeyService) {}

  // ─── API key management ───────────────────────────────────────────────────

  @Get('api-keys')
  listApiKeys(@CurrentUser() user: User) {
    return this.apiKeyService.list(user.id);
  }

  @Post('api-keys')
  async createApiKey(
    @Body() body: { name: string },
    @CurrentUser() user: User,
  ) {
    return this.apiKeyService.create(user.id, body.name);
  }

  @Delete('api-keys/:id')
  revokeApiKey(@Param('id') id: string, @CurrentUser() user: User) {
    return this.apiKeyService.revoke(id, user.id);
  }

  // ─── Better Auth catch-all (must be last) ─────────────────────────────────

  @All('*')
  @Public()
  handle(@Req() req: IncomingMessage, @Res() res: ServerResponse): void {
    void this.betterAuthHandler(req, res);
  }
}
