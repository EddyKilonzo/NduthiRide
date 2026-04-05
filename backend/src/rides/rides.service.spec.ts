import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentMethod, RideStatus } from '@prisma/client';

import { RidesService } from './rides.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';

const mockPrisma = {
  ride: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  account: {
    findUnique: jest.fn(),
  },
  rider: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  setting: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  rating: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  passengerRating: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockMail = {
  sendRideConfirmed: jest.fn(),
  sendRiderAccepted: jest.fn(),
  sendRideCompleted: jest.fn(),
};

const mockTrackingGateway = {
  emitNewRideRequest: jest.fn(),
  emitToAccount: jest.fn(),
};

const mockChatService = {
  createConversation: jest.fn(),
  getConversationByRideOrParcel: jest.fn(),
  closeConversation: jest.fn().mockResolvedValue({ id: 'conv-1', closedAt: new Date() }),
};

const mockChatGateway = {
  emitChatClosed: jest.fn(),
};

const mockNotificationsService = {
  createInAppNotification: jest.fn(),
  send: jest.fn(),
};

describe('RidesService', () => {
  let service: RidesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RidesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMail },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: TrackingGateway, useValue: mockTrackingGateway },
        { provide: ChatService, useValue: mockChatService },
        { provide: ChatGateway, useValue: mockChatGateway },
      ],
    }).compile();

    service = module.get<RidesService>(RidesService);
    jest.clearAllMocks();
  });

  // ─── createRide ───────────────────────────────────────────

  describe('createRide', () => {
    const dto = {
      pickupLat: -1.2921,
      pickupLng: 36.8219,
      pickupAddress: 'CBD',
      dropoffLat: -1.3,
      dropoffLng: 36.85,
      dropoffAddress: 'Westlands',
      paymentMethod: PaymentMethod.MPESA,
      mpesaPhone: '0712345678',
    };

    it('creates a ride with estimated fare and distance', async () => {
      const createdRide = {
        id: 'ride-1',
        userId: 'user-1',
        pickupAddress: dto.pickupAddress,
        dropoffAddress: dto.dropoffAddress,
        estimatedFare: 80,
        estimatedMins: 5,
        distanceKm: 1.0,
        paymentMethod: PaymentMethod.MPESA,
        user: { fullName: 'Alice', phone: '07x', avatarUrl: null },
      };
      mockPrisma.ride.create.mockResolvedValue(createdRide);

      const result = await service.createRide('user-1', dto);

      expect(result.id).toBe('ride-1');
      expect(mockPrisma.ride.create).toHaveBeenCalled();
      expect(mockTrackingGateway.emitNewRideRequest).toHaveBeenCalledWith(
        createdRide,
      );
    });
  });

  // ─── getUserRides ─────────────────────────────────────────

  describe('getUserRides', () => {
    it('returns paginated rides for a user', async () => {
      const rides = [{ id: '1' }, { id: '2' }];
      mockPrisma.ride.findMany.mockResolvedValue(rides);
      mockPrisma.ride.count.mockResolvedValue(2);

      const result = await service.getUserRides('user-1', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  // ─── getRideById ──────────────────────────────────────────

  describe('getRideById', () => {
    it('returns a ride if the user is the owner or rider', async () => {
      const mockRide = { id: 'ride-1', userId: 'user-1', riderId: 'rider-1' };
      mockPrisma.ride.findUnique.mockResolvedValue(mockRide);
      mockPrisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });

      const result = await service.getRideById('ride-1', 'user-1');
      expect(result.id).toBe('ride-1');
    });

    it('throws ForbiddenException if user is not authorized', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId: 'other-user',
        riderId: 'other-rider',
      });
      mockPrisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });

      await expect(service.getRideById('ride-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── acceptRide ───────────────────────────────────────────

  describe('acceptRide', () => {
    it('allows verified rider to accept a PENDING ride', async () => {
      const riderAccountId = 'rider-acc-1';
      const riderId = 'rider-1';
      const rideId = 'ride-1';

      mockPrisma.rider.findUnique.mockResolvedValue({
        id: riderId,
        accountId: riderAccountId,
        isVerified: true,
        isAvailable: true,
      });
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: rideId,
        status: RideStatus.PENDING,
      });
      mockPrisma.account.findUnique.mockResolvedValue({ fullName: 'Rider Name' });
      mockPrisma.ride.update.mockResolvedValue({
        id: rideId,
        status: RideStatus.ACCEPTED,
        riderId,
        user: { fullName: 'Alice' },
      });

      const result = await service.acceptRide(rideId, riderAccountId);

      expect(result.status).toBe(RideStatus.ACCEPTED);
      expect(mockChatService.createConversation).toHaveBeenCalledWith(
        rideId,
        undefined,
      );
    });

    it('throws ForbiddenException if rider is not verified', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue({ isVerified: false });
      await expect(service.acceptRide('r1', 'acc1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── updateRideStatus ─────────────────────────────────────

  describe('updateRideStatus', () => {
    it('allows transition ACCEPTED → EN_ROUTE_TO_PICKUP', async () => {
      const riderAccountId = 'rider-acc-1';
      const riderId = 'rider-1';
      const rideId = 'ride-1';

      mockPrisma.rider.findUnique.mockResolvedValue({ id: riderId });
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: rideId,
        riderId,
        status: RideStatus.ACCEPTED,
      });
      mockPrisma.account.findUnique.mockResolvedValue({ fullName: 'Rider' });
      mockPrisma.ride.update.mockResolvedValue({
        id: rideId,
        status: RideStatus.EN_ROUTE_TO_PICKUP,
      });

      const result = await service.updateRideStatus(
        rideId,
        riderAccountId,
        RideStatus.EN_ROUTE_TO_PICKUP,
      );
      expect(result.status).toBe(RideStatus.EN_ROUTE_TO_PICKUP);
    });

    it('allows transition ARRIVED_AT_PICKUP → IN_PROGRESS', async () => {
      const riderId = 'rider-1';
      mockPrisma.rider.findUnique.mockResolvedValue({ id: riderId });
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'r1',
        riderId,
        status: RideStatus.ARRIVED_AT_PICKUP,
      });
      mockPrisma.account.findUnique.mockResolvedValue({ fullName: 'Rider' });
      mockPrisma.ride.update.mockResolvedValue({
        status: RideStatus.IN_PROGRESS,
      });

      const result = await service.updateRideStatus(
        'r1',
        'acc1',
        RideStatus.IN_PROGRESS,
      );
      expect(result.status).toBe(RideStatus.IN_PROGRESS);
    });

    it('sets completedAt and increments totalRides on COMPLETED', async () => {
      const riderId = 'rider-1';
      mockPrisma.rider.findUnique.mockResolvedValue({ id: riderId });
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'r1',
        riderId,
        status: RideStatus.IN_PROGRESS,
      });
      mockPrisma.account.findUnique.mockResolvedValue({ fullName: 'Rider' });
      mockPrisma.ride.update.mockResolvedValue({
        status: RideStatus.COMPLETED,
      });
      mockChatService.getConversationByRideOrParcel.mockResolvedValue({
        id: 'conv-1',
      });

      await service.updateRideStatus('r1', 'acc1', RideStatus.COMPLETED);

      expect(mockPrisma.ride.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RideStatus.COMPLETED,
            completedAt: expect.any(Date),
          }),
        }),
      );
      expect(mockPrisma.rider.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: riderId },
          data: { totalRides: { increment: 1 } },
        }),
      );
      expect(mockChatService.closeConversation).toHaveBeenCalledWith('conv-1');
      expect(mockChatGateway.emitChatClosed).toHaveBeenCalled();
    });

    it('throws BadRequestException for an invalid status transition', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });
      mockPrisma.ride.findUnique.mockResolvedValue({
        status: RideStatus.PENDING,
        riderId: 'rider-1',
      });
      await expect(
        service.updateRideStatus('r1', 'acc1', RideStatus.COMPLETED),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when ride belongs to a different rider', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });
      mockPrisma.ride.findUnique.mockResolvedValue({ riderId: 'other-rider' });
      await expect(
        service.updateRideStatus('r1', 'acc1', RideStatus.ACCEPTED),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── cancelRide ───────────────────────────────────────────

  describe('cancelRide', () => {
    it('cancels a PENDING ride', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        status: RideStatus.PENDING,
      });
      mockPrisma.ride.update.mockResolvedValue({ status: RideStatus.CANCELLED });

      const result = await service.cancelRide('r1', 'u1');
      expect(result.status).toBe(RideStatus.CANCELLED);
    });

    it('cancels an ACCEPTED ride', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        status: RideStatus.ACCEPTED,
        riderId: 'rider-1',
      });
      mockPrisma.ride.update.mockResolvedValue({ status: RideStatus.CANCELLED });
      mockChatService.getConversationByRideOrParcel.mockResolvedValue({
        id: 'conv-1',
      });

      await service.cancelRide('r1', 'u1');
      expect(mockChatService.closeConversation).toHaveBeenCalledWith('conv-1');
    });

    it('throws BadRequestException when ride is IN_PROGRESS', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        status: RideStatus.IN_PROGRESS,
        userId: 'u1',
      });
      await expect(service.cancelRide('r1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when user does not own the ride', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({ userId: 'other-u' });
      mockPrisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });
      await expect(service.cancelRide('r1', 'u1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when ride does not exist', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue(null);
      await expect(service.cancelRide('r1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getRiderActiveRide ───────────────────────────────────

  describe('getRiderActiveRide', () => {
    it('returns the active ride for the rider', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });
      mockPrisma.ride.findFirst.mockResolvedValue({ id: 'r1' });

      const result = await service.getRiderActiveRide('acc1');
      expect(result?.id).toBe('r1');
    });

    it('throws NotFoundException when rider profile does not exist', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue(null);
      await expect(service.getRiderActiveRide('acc1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
