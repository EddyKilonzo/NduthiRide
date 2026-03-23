import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from './jwt.strategy';

/**
 * Validates the long-lived refresh token.
 * Reads the raw token from the Authorization header so the service
 * can compare it against the stored hashed value.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret') as string,
      passReqToCallback: true, // So we can access the raw token in validate()
    });
  }

  async validate(request: Request, payload: JwtPayload) {
    // Extract the raw token from the header
    const authHeader = request.headers.authorization ?? '';
    const refreshToken = authHeader.replace('Bearer ', '').trim();

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
    });

    if (!account || !account.refreshToken) {
      throw new UnauthorizedException(
        'Account not found or refresh token revoked',
      );
    }

    // Return both so the auth service can verify the hash
    return { ...account, rawRefreshToken: refreshToken };
  }
}
