import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string; // Account ID
  phone: string;
  role: string;
}

/**
 * Validates the short-lived JWT access token on each protected request.
 * Attaches the full Account record to request.user if valid.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret') as string,
    });
  }

  async validate(payload: JwtPayload) {
    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
    });

    if (!account || !account.isActive) {
      throw new UnauthorizedException('Account not found or deactivated');
    }

    return account; // Becomes request.user
  }
}
