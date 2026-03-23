import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Protects routes that require a valid JWT access token. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
