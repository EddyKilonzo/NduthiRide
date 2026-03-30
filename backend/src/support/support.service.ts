import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createTicket(accountId: string, dto: { subject: string; message: string; priority?: string }) {
    try {
      return await this.prisma.supportTicket.create({
        data: {
          accountId,
          subject: dto.subject,
          message: dto.message,
          priority: dto.priority || 'NORMAL',
        },
      });
    } catch (error) {
      this.logger.error(`createTicket failed for ${accountId}`, error);
      throw error;
    }
  }

  async listMyTickets(accountId: string) {
    try {
      return await this.prisma.supportTicket.findMany({
        where: { accountId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`listMyTickets failed for ${accountId}`, error);
      throw error;
    }
  }

  async getTicketById(id: string, accountId: string) {
    try {
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id },
      });

      if (!ticket || ticket.accountId !== accountId) {
        throw new NotFoundException('Ticket not found');
      }

      return ticket;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`getTicketById failed for ${id}`, error);
      throw error;
    }
  }

  // Admin methods (to be used by AdminService or AdminController)
  async listAllTickets(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          account: { select: { fullName: true, phone: true, role: true } },
        },
      }),
      this.prisma.supportTicket.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateTicketStatus(id: string, status: string) {
    try {
      return await this.prisma.supportTicket.update({
        where: { id },
        data: { status },
      });
    } catch (error) {
      this.logger.error(`updateTicketStatus failed for ${id}`, error);
      throw error;
    }
  }
}
