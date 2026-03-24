import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Wraps PrismaClient as a NestJS injectable service.
 * Connects on module init and gracefully disconnects on shutdown.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for Prisma PostgreSQL adapter');
    }

    super({
      adapter: new PrismaPg({ connectionString }),
      log: ['error', 'warn'],
    });
  }

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_DB_CONNECT === 'true') {
      this.logger.warn('Skipping database connection as SKIP_DB_CONNECT is true');
      return;
    }

    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to the database', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (process.env.SKIP_DB_CONNECT === 'true') return;
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }
}
