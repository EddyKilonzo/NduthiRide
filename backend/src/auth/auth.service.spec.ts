import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

jest.mock('bcrypt');

const mockPrisma = {
  account: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  rider: {
    create: jest.fn(),
  },
  verificationToken: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockJwt = {
  signAsync: jest.fn(),
};

const mockConfig = {
  getOrThrow: jest.fn(),
  get: jest.fn(),
};

const mockMail = {
  sendWelcomeUser: jest.fn(),
  sendWelcomeRider: jest.fn(),
  sendEmailVerificationOtp: jest.fn().mockResolvedValue(true),
  sendPasswordReset: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ─── registerUser ─────────────────────────────────────────

  describe('registerUser', () => {
    const dto = {
      fullName: 'Alice Doe',
      phone: '0712345678',
      email: 'alice@example.com',
      password: 'Secret123!',
    };

    it('creates a new user and returns tokens', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null); // phone available
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pw');
      mockPrisma.account.create.mockResolvedValue({
        id: 'acc-1',
        phone: dto.phone,
        email: dto.email,
        fullName: dto.fullName,
        avatarUrl: null,
        role: Role.USER,
        isActive: true,
      });
      mockConfig.getOrThrow.mockReturnValue('15m');
      mockJwt.signAsync.mockResolvedValue('token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_rt');
      mockPrisma.account.update.mockResolvedValue({});

      const result = await service.registerUser(dto);

      expect(mockPrisma.account.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user).toMatchObject({
        id: 'acc-1',
        phone: dto.phone,
        email: dto.email,
        fullName: dto.fullName,
        role: Role.USER,
      });
    });

    it('throws ConflictException when phone is already registered', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.registerUser(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── registerRider ────────────────────────────────────────

  describe('registerRider', () => {
    const dto = {
      fullName: 'Bob Rider',
      phone: '0798765432',
      email: 'bob@example.com',
      password: 'Ride123!',
      licenseNumber: 'DL-001',
      bikeRegistration: 'KCA 001A',
      bikeModel: 'Honda CB',
    };

    it('creates rider account with profile in a transaction', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pw');

      const createdAccount = {
        id: 'acc-2',
        phone: dto.phone,
        email: dto.email,
        fullName: dto.fullName,
        avatarUrl: null,
        role: Role.RIDER,
        isActive: true,
      };
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
          return fn(mockPrisma);
        },
      );
      mockPrisma.account.create.mockResolvedValue(createdAccount);
      mockPrisma.rider.create.mockResolvedValue({});
      mockConfig.getOrThrow.mockReturnValue('15m');
      mockJwt.signAsync.mockResolvedValue('token');
      mockPrisma.account.update.mockResolvedValue({});

      const result = await service.registerRider(dto);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      expect(result.user.role).toBe(Role.RIDER);
    });

    it('throws ConflictException when phone is already registered', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.registerRider(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── login ────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'user@example.com', password: 'Secret123!' };
    const account = {
      id: 'acc-1',
      email: dto.email,
      phone: '0712345678',
      fullName: 'Test User',
      avatarUrl: null,
      role: Role.USER,
      isActive: true,
      passwordHash: 'hashed_pw',
    };

    it('returns tokens on valid credentials', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(account);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockConfig.getOrThrow.mockReturnValue('15m');
      mockJwt.signAsync.mockResolvedValue('token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_rt');
      mockPrisma.account.update.mockResolvedValue({});

      const result = await service.login(dto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe('acc-1');
      expect(result.user.role).toBe(Role.USER);
    });

    it('throws UnauthorizedException for unknown email', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(account);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for inactive account', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        ...account,
        isActive: false,
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── refreshTokens ────────────────────────────────────────

  describe('refreshTokens', () => {
    it('issues new tokens when refresh token matches', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        phone: '07x',
        role: Role.USER,
        refreshToken: 'hashed_rt',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockConfig.getOrThrow.mockReturnValue('15m');
      mockJwt.signAsync.mockResolvedValue('new_token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_rt');
      mockPrisma.account.update.mockResolvedValue({});

      const result = await service.refreshTokens('acc-1', 'raw_rt');

      expect(result).toHaveProperty('accessToken');
    });

    it('throws UnauthorizedException when account has no stored refresh token', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        refreshToken: null,
      });

      await expect(service.refreshTokens('acc-1', 'raw_rt')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when token does not match', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        refreshToken: 'hashed_rt',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.refreshTokens('acc-1', 'wrong_token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── logout ───────────────────────────────────────────────

  describe('logout', () => {
    it('clears the refresh token', async () => {
      mockPrisma.account.update.mockResolvedValue({});

      await service.logout('acc-1');

      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { refreshToken: null },
      });
    });
  });

  // ─── verifyEmail ──────────────────────────────────────────

  describe('verifyEmail', () => {
    it('marks email as verified when OTP matches', async () => {
      const tokenRecord = { id: 'tok-1', tokenHash: 'hashed_otp' };
      mockPrisma.verificationToken.findMany.mockResolvedValue([tokenRecord]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.verifyEmail('acc-1', '123456');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when OTP does not match', async () => {
      mockPrisma.verificationToken.findMany.mockResolvedValue([
        { id: 'tok-1', tokenHash: 'hashed_otp' },
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.verifyEmail('acc-1', 'wrong')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when no valid tokens exist', async () => {
      mockPrisma.verificationToken.findMany.mockResolvedValue([]);

      await expect(service.verifyEmail('acc-1', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── forgotPassword ───────────────────────────────────────

  describe('forgotPassword', () => {
    it('does nothing silently when email is not registered', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.forgotPassword('unknown@example.com'),
      ).resolves.toBeUndefined();
      expect(mockPrisma.verificationToken.create).not.toHaveBeenCalled();
    });

    it('creates a reset token and sends email when account exists', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        email: 'alice@example.com',
        fullName: 'Alice',
      });
      mockPrisma.verificationToken.deleteMany.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_token');
      mockPrisma.verificationToken.create.mockResolvedValue({});
      mockMail.sendPasswordReset.mockResolvedValue(undefined);

      await service.forgotPassword('alice@example.com');

      expect(mockPrisma.verificationToken.create).toHaveBeenCalledTimes(1);
      expect(mockMail.sendPasswordReset).toHaveBeenCalledTimes(1);
    });
  });

  // ─── resetPassword ────────────────────────────────────────

  describe('resetPassword', () => {
    it('updates the password when token is valid', async () => {
      const tokenRecord = {
        id: 'tok-1',
        tokenHash: 'hashed_reset',
        accountId: 'acc-1',
      };
      mockPrisma.verificationToken.findMany.mockResolvedValue([tokenRecord]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_pw');
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.resetPassword('raw_token', 'NewPass123!');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when reset token is invalid', async () => {
      mockPrisma.verificationToken.findMany.mockResolvedValue([
        { id: 'tok-1', tokenHash: 'hashed_reset', accountId: 'acc-1' },
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.resetPassword('bad_token', 'NewPass123!'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── changePassword ───────────────────────────────────────

  describe('changePassword', () => {
    it('throws UnauthorizedException when current password is wrong', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        passwordHash: 'stored_hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('acc-1', 'wrong', 'NewPass123!'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.account.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when new password equals current', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        passwordHash: 'stored_hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassword('acc-1', 'SamePass1!', 'SamePass1!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password and clears refresh token when current is valid', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        passwordHash: 'stored_hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_pw');
      mockPrisma.account.update.mockResolvedValue({});

      await service.changePassword('acc-1', 'OldPass123!', 'NewPass123!');

      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { passwordHash: 'new_hashed_pw', refreshToken: null },
      });
    });
  });

  // ─── resendVerificationOtp ────────────────────────────────

  describe('resendVerificationOtp', () => {
    it('throws NotFoundException when account does not exist', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(service.resendVerificationOtp('acc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when no email is on file', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        email: null,
      });

      await expect(service.resendVerificationOtp('acc-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when email is already verified', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        email: 'a@b.com',
        isEmailVerified: true,
      });

      await expect(service.resendVerificationOtp('acc-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
