import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from './auth';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const req = ctx.switchToHttp().getRequest<{ user: User }>();
    return req.user;
  },
);
