import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Account } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the account record for the given ID.
   * Strips the password hash and refresh token from the response.
   */
  async getProfile(
    accountId: string,
  ): Promise<Omit<Account, 'passwordHash' | 'refreshToken'>> {
    try {
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          // Excluded: passwordHash, refreshToken
          passwordHash: false,
          refreshToken: false,
        },
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      return account as Omit<Account, 'passwordHash' | 'refreshToken'>;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`getProfile failed for ${accountId}`, error);
      throw error;
    }
  }

  /**
   * Updates the profile of the authenticated user.
   * If a new phone is provided, it checks that the number is not already taken.
   */
  async updateProfile(
    accountId: string,
    dto: UpdateUserDto,
  ): Promise<Omit<Account, 'passwordHash' | 'refreshToken'>> {
    try {
      // If the user wants to change their phone, make sure it is not taken
      if (dto.phone) {
        const existing = await this.prisma.account.findFirst({
          where: { phone: dto.phone, NOT: { id: accountId } },
        });
        if (existing) {
          throw new ConflictException('This phone number is already in use');
        }
      }

      const updated = await this.prisma.account.update({
        where: { id: accountId },
        data: {
          ...(dto.fullName && { fullName: dto.fullName }),
          ...(dto.phone && { phone: dto.phone }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        },
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          passwordHash: false,
          refreshToken: false,
        },
      });

      return updated as Omit<Account, 'passwordHash' | 'refreshToken'>;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error(`updateProfile failed for ${accountId}`, error);
      throw error;
    }
  }

  /**
   * Updates the FCM token for the given account.
   */
  async updateFcmToken(accountId: string, token: string): Promise<void> {
    try {
      await this.prisma.account.update({
        where: { id: accountId },
        data: { fcmToken: token },
      });
      this.logger.log(`FCM token updated for account ${accountId}`);
    } catch (error) {
      this.logger.error(`updateFcmToken failed for ${accountId}`, error);
      throw error;
    }
  }
}
