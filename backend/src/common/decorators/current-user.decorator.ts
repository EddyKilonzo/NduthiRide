import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import type { Account } from '@prisma/client';

/**
 * Extracts the authenticated user attached by JwtStrategy.
 * Use on controller method parameters: @CurrentUser() user: Account
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Account => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: Account }>();
    return request.user;
  },
);
