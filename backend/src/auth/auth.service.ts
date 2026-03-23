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
import { Role, TokenType } from '@prisma/client';
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
  async registerUser(
    dto: RegisterUserDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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

      return this.issueTokens(account.id, account.phone, account.role);
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error('Failed to register user', error);
      throw error;
    }
  }

  /**
   * Creates a new rider account AND the linked Rider profile in one transaction.
   * Throws ConflictException if the phone number is already registered.
   */
  async registerRider(
    dto: RegisterRiderDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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
            licenseNumber: dto.licenseNumber,
            bikeRegistration: dto.bikeRegistration,
            bikeModel: dto.bikeModel,
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
          licenseNumber: dto.licenseNumber,
          bikeRegistration: dto.bikeRegistration,
          bikeModel: dto.bikeModel,
        });
        void this.sendEmailVerificationOtp(
          account.id,
          account.email,
          account.fullName,
        );
      }

      return this.issueTokens(account.id, account.phone, account.role);
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error('Failed to register rider', error);
      throw error;
    }
  }

  // ─── Login ────────────────────────────────────────────────

  /**
   * Verifies phone + password and returns a fresh token pair.
   * Intentionally returns the same error message for both wrong phone and wrong password
   * to avoid leaking whether a phone number is registered.
   */
  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const account = await this.prisma.account.findUnique({
        where: { phone: dto.phone },
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
      return this.issueTokens(account.id, account.phone, account.role);
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

      await this.mailService.sendEmailVerificationOtp({
        to: email,
        fullName,
        otp,
        expiresMins,
      });
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
}
