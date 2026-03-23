import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Protects the refresh-token endpoint — validates the long-lived token. */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
