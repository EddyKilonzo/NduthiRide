import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, TokenType, type Account } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { RegisterRiderDto } from './dto/register-rider.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import type { StringValue } from 'ms';

// Number of bcrypt salt rounds — higher is more secure but slower
const BCRYPT_ROUNDS = 12;

/** Public session user — matches frontend `AuthUser` (no secrets). */
export type AuthUserPayload = {
  id: string;
  phone: string;
  email?: string;
  fullName: string;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  // ─── Registration ─────────────────────────────────────────

  /**
   * Creates a new user account.
   * Throws ConflictException if the phone number is already registered.
   */
  async registerUser(dto: RegisterUserDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUserPayload;
  }> {
    try {
      await this.assertPhoneIsAvailable(dto.phone);

      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

      const account = await this.prisma.account.create({
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          email: dto.email,
          passwordHash,
          role: Role.USER,
        },
      });

      this.logger.log(`New user registered: ${account.id}`);

      // Fire-and-forget: send welcome email + OTP if email was provided
      if (account.email) {
        void this.sendEmailVerificationOtp(
          account.id,
          account.email,
          account.fullName,
        );
        void this.mailService.sendWelcomeUser({
          to: account.email,
          fullName: account.fullName,
          email: account.email,
        });
      }

      const tokens = await this.issueTokens(
        account.id,
        account.phone,
        account.role,
      );
      return { ...tokens, user: this.toAuthUserPayload(account) };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (this.isUniqueConstraintError(error, 'email')) {
        throw new ConflictException('This email address is already registered');
      }
      this.logger.error('Failed to register user', error);
      throw error;
    }
  }

  /**
   * Creates a new rider account AND the linked Rider profile in one transaction.
   * Throws ConflictException if the phone number is already registered.
   */
  async registerRider(dto: RegisterRiderDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUserPayload;
  }> {
    try {
      await this.assertPhoneIsAvailable(dto.phone);

      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

      // Use a transaction so account + rider profile are created atomically
      const account = await this.prisma.$transaction(async (tx) => {
        const newAccount = await tx.account.create({
          data: {
            fullName: dto.fullName,
            phone: dto.phone,
            email: dto.email,
            passwordHash,
            role: Role.RIDER,
          },
        });

        await tx.rider.create({
          data: {
            accountId: newAccount.id,
            licenseNumber: dto.licenseNumber ?? 'To be provided',
            bikeRegistration: dto.bikeRegistration ?? 'To be provided',
            bikeModel: dto.bikeModel ?? null,
          },
        });

        return newAccount;
      });

      this.logger.log(`New rider registered: ${account.id}`);

      // Fire-and-forget: welcome email to rider (if email provided)
      if (account.email) {
        void this.mailService.sendWelcomeRider({
          to: account.email,
          fullName: account.fullName,
          licenseNumber: dto.licenseNumber ?? 'To be provided',
          bikeRegistration: dto.bikeRegistration ?? 'To be provided',
          bikeModel: dto.bikeModel ?? 'To be provided',
        });
        void this.sendEmailVerificationOtp(
          account.id,
          account.email,
          account.fullName,
        );
      }

      const tokens = await this.issueTokens(
        account.id,
        account.phone,
        account.role,
      );
      return { ...tokens, user: this.toAuthUserPayload(account) };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (this.isUniqueConstraintError(error, 'email')) {
        throw new ConflictException('This email address is already registered');
      }
      this.logger.error('Failed to register rider', error);
      throw error;
    }
  }

  // ─── Login ────────────────────────────────────────────────

  /**
   * Verifies email + password and returns a fresh token pair.
   * Intentionally returns the same error message for both wrong email and wrong password
   * to avoid leaking whether an address is registered.
   * Accounts without an email cannot use this endpoint.
   */
  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUserPayload;
  }> {
    try {
      const email = dto.email.trim().toLowerCase();
      const account = await this.prisma.account.findUnique({
        where: { email },
      });

      if (!account || !account.isActive) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const passwordMatches = await bcrypt.compare(
        dto.password,
        account.passwordHash,
      );
      if (!passwordMatches) {
        throw new UnauthorizedException('Invalid credentials');
      }

      this.logger.log(`Login successful: ${account.id}`);
      const tokens = await this.issueTokens(
        account.id,
        account.phone,
        account.role,
      );
      return { ...tokens, user: this.toAuthUserPayload(account) };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error('Login failed', error);
      throw error;
    }
  }

  // ─── Token management ─────────────────────────────────────

  /**
   * Validates the stored hashed refresh token and issues a new token pair.
   * The old refresh token is rotated (invalidated) on each call.
   */
  async refreshTokens(
    accountId: string,
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
      });

      if (!account || !account.refreshToken) {
        throw new UnauthorizedException('Access denied');
      }

      const tokenMatches = await bcrypt.compare(
        rawRefreshToken,
        account.refreshToken,
      );
      if (!tokenMatches) {
        throw new UnauthorizedException('Access denied');
      }

      return this.issueTokens(account.id, account.phone, account.role);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error('Token refresh failed', error);
      throw error;
    }
  }

  /**
   * Clears the stored refresh token — effectively logs the user out on all devices.
   */
  async logout(accountId: string): Promise<void> {
    try {
      await this.prisma.account.update({
        where: { id: accountId },
        data: { refreshToken: null },
      });
    } catch (error) {
      this.logger.error(`Logout failed for account ${accountId}`, error);
      throw error;
    }
  }

  // ─── Private helpers ──────────────────────────────────────

  private toAuthUserPayload(
    account: Pick<
      Account,
      'id' | 'phone' | 'email' | 'fullName' | 'avatarUrl' | 'role' | 'isActive'
    >,
  ): AuthUserPayload {
    const payload: AuthUserPayload = {
      id: account.id,
      phone: account.phone,
      fullName: account.fullName,
      avatarUrl: account.avatarUrl,
      role: account.role,
      isActive: account.isActive,
    };
    if (account.email) {
      payload.email = account.email;
    }
    return payload;
  }

  /**
   * Generates a new access + refresh token pair, stores the hashed refresh token,
   * and returns both tokens to the caller.
   */
  private async issueTokens(
    accountId: string,
    phone: string,
    role: Role,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = { sub: accountId, phone, role: role as string };

    // getOrThrow ensures values are defined strings (throws at startup if missing).
    // `@nestjs/jwt` expects a branded `ms.StringValue`, so we cast the env string.
    const accessExpiresIn = this.configService.getOrThrow<string>(
      'jwt.accessExpiresIn',
    ) as unknown as StringValue;
    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'jwt.refreshExpiresIn',
    ) as unknown as StringValue;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    // Store a hash — never store raw tokens
    const hashedRefreshToken = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.prisma.account.update({
      where: { id: accountId },
      data: { refreshToken: hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  // ─── Email verification (OTP) ─────────────────────────────

  /**
   * Generates a 6-digit OTP, hashes it, stores it in VerificationToken,
   * and sends the OTP to the user's email.
   */
  async sendEmailVerificationOtp(
    accountId: string,
    email: string,
    fullName: string,
  ): Promise<void> {
    try {
      const expiresMins =
        this.configService.get<number>('mail.otpExpiresMins') ?? 10;
      const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
      const tokenHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
      const expiresAt = new Date(Date.now() + expiresMins * 60 * 1000);

      // Invalidate any existing unused OTPs for this account
      await this.prisma.verificationToken.deleteMany({
        where: { accountId, type: TokenType.EMAIL_VERIFY, usedAt: null },
      });

      await this.prisma.verificationToken.create({
        data: { accountId, tokenHash, type: TokenType.EMAIL_VERIFY, expiresAt },
      });

      const sent = await this.mailService.sendEmailVerificationOtp({
        to: email,
        fullName,
        otp,
        expiresMins,
      });

      if (!sent) {
        this.logger.error(`Verification email was not delivered to ${email}`);
        if (this.configService.get<string>('app.nodeEnv') === 'development') {
          this.logger.warn(
            `[development] SMTP failed — use this OTP to verify (check MAIL_* / Brevo sender): ${otp}`,
          );
        }
      } else if (this.configService.get<boolean>('mail.debugLogOtp')) {
        this.logger.warn(
          `[MAIL_DEBUG_OTP] Verification code for ${email}: ${otp}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `sendEmailVerificationOtp failed for ${accountId}`,
        error,
      );
      // Non-fatal — do not re-throw
    }
  }

  /**
   * Verifies the OTP submitted by the user.
   * Marks the token as used and sets isEmailVerified = true on the account.
   */
  async verifyEmail(accountId: string, otp: string): Promise<void> {
    try {
      const tokens = await this.prisma.verificationToken.findMany({
        where: {
          accountId,
          type: TokenType.EMAIL_VERIFY,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      // Find a token whose hash matches the submitted OTP
      let matched: (typeof tokens)[number] | null = null;
      for (const t of tokens) {
        if (await bcrypt.compare(otp, t.tokenHash)) {
          matched = t;
          break;
        }
      }

      if (!matched) {
        throw new BadRequestException('Invalid or expired verification code');
      }

      // Mark used and verify in a single transaction
      await this.prisma.$transaction([
        this.prisma.verificationToken.update({
          where: { id: matched.id },
          data: { usedAt: new Date() },
        }),
        this.prisma.account.update({
          where: { id: accountId },
          data: { isEmailVerified: true },
        }),
      ]);

      this.logger.log(`Email verified for account ${accountId}`);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`verifyEmail failed for ${accountId}`, error);
      throw error;
    }
  }

  // ─── Password reset ────────────────────────────────────────

  /**
   * Sends a password-reset link to the account's email address.
   * Silently succeeds even if the email is not registered (prevents enumeration).
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      const account = await this.prisma.account.findUnique({
        where: { email },
      });
      if (!account) return; // Enumeration guard — no error

      const expiresMins = 30;
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);
      const expiresAt = new Date(Date.now() + expiresMins * 60 * 1000);

      // Invalidate any existing unused reset tokens
      await this.prisma.verificationToken.deleteMany({
        where: {
          accountId: account.id,
          type: TokenType.PASSWORD_RESET,
          usedAt: null,
        },
      });

      await this.prisma.verificationToken.create({
        data: {
          accountId: account.id,
          tokenHash,
          type: TokenType.PASSWORD_RESET,
          expiresAt,
        },
      });

      await this.mailService.sendPasswordReset({
        to: email,
        fullName: account.fullName,
        resetToken: rawToken,
        expiresMins,
      });
    } catch (error) {
      this.logger.error(`forgotPassword failed for ${email}`, error);
      throw error;
    }
  }

  /**
   * Validates the reset token and sets the new password.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    try {
      // Find all non-expired, unused reset tokens to check against
      const tokens = await this.prisma.verificationToken.findMany({
        where: {
          type: TokenType.PASSWORD_RESET,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      let matched: (typeof tokens)[number] | null = null;
      for (const t of tokens) {
        if (await bcrypt.compare(rawToken, t.tokenHash)) {
          matched = t;
          break;
        }
      }

      if (!matched) {
        throw new BadRequestException('Invalid or expired reset link');
      }

      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

      await this.prisma.$transaction([
        this.prisma.verificationToken.update({
          where: { id: matched.id },
          data: { usedAt: new Date() },
        }),
        // Invalidate all refresh tokens to force re-login on all devices
        this.prisma.account.update({
          where: { id: matched.accountId },
          data: { passwordHash, refreshToken: null },
        }),
      ]);

      this.logger.log(`Password reset for account ${matched.accountId}`);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('resetPassword failed', error);
      throw error;
    }
  }

  /**
   * Authenticated user changes password. Invalidates refresh tokens (other sessions must sign in again).
   */
  async changePassword(
    accountId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    try {
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
        select: { id: true, passwordHash: true },
      });
      if (!account) {
        throw new NotFoundException('Account not found');
      }

      const ok = await bcrypt.compare(currentPassword, account.passwordHash);
      if (!ok) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      if (currentPassword === newPassword) {
        throw new BadRequestException(
          'New password must be different from your current password',
        );
      }

      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

      await this.prisma.account.update({
        where: { id: accountId },
        data: { passwordHash, refreshToken: null },
      });

      this.logger.log(`Password changed for account ${accountId}`);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(`changePassword failed for ${accountId}`, error);
      throw error;
    }
  }

  // ─── Re-send OTP (rate-limited by the 10-min expiry window) ──

  async resendVerificationOtp(accountId: string): Promise<void> {
    try {
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
      });
      if (!account) throw new NotFoundException('Account not found');
      if (!account.email)
        throw new BadRequestException('No email address on file');
      if (account.isEmailVerified)
        throw new BadRequestException('Email already verified');

      await this.sendEmailVerificationOtp(
        accountId,
        account.email,
        account.fullName,
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(`resendVerificationOtp failed for ${accountId}`, error);
      throw error;
    }
  }

  /**
   * Checks that a phone number has not already been registered.
   * Throws ConflictException if it is taken.
   */
  private async assertPhoneIsAvailable(phone: string): Promise<void> {
    const existing = await this.prisma.account.findUnique({ where: { phone } });
    if (existing) {
      throw new ConflictException('This phone number is already registered');
    }
  }

  /** Returns true when the error is a Prisma unique-constraint violation on the given field. */
  private isUniqueConstraintError(error: unknown, field: string): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const e = error as Record<string, unknown>;
    if (e['code'] !== 'P2002') return false;

    // Prisma 5 / standard format: meta.target = ['field']
    const meta = e['meta'] as Record<string, unknown> | undefined;
    if (Array.isArray(meta?.['target'])) {
      return (meta['target'] as string[]).includes(field);
    }

    // Prisma 7 driver-adapter format: meta.driverAdapterError.cause.constraint.fields
    const cause = (
      meta?.['driverAdapterError'] as Record<string, unknown> | undefined
    )?.['cause'] as Record<string, unknown> | undefined;
    const fields = (
      cause?.['constraint'] as Record<string, unknown> | undefined
    )?.['fields'];
    if (Array.isArray(fields)) {
      return (fields as string[]).includes(field);
    }

    return false;
  }
}
