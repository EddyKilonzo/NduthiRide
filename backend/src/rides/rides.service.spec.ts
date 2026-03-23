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

const mockPrisma = {
  ride: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  rider: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  account: {
    findUnique: jest.fn(),
  },
};

const mockMail = {
  sendRideConfirmed: jest.fn(),
  sendRiderAccepted: jest.fn(),
  sendRideCompleted: jest.fn(),
};

const mockTrackingGateway = {
  emitNewRideRequest: jest.fn(),
};

const mockChatService = {
  createConversation: jest.fn(),
  getConversationByRideOrParcel: jest.fn(),
  closeConversation: jest.fn(),
};

const mockChatGateway = {
  emitChatClosed: jest.fn(),
};

describe('RidesService', () => {
  let service: RidesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RidesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMail },
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
      mockPrisma.account.findUnique.mockResolvedValue(null); // no email → skip mail

      const result = await service.createRide('user-1', dto);

      expect(mockPrisma.ride.create).toHaveBeenCalledTimes(1);
      expect(result.estimatedFare).toBeGreaterThanOrEqual(50); // at least base fare
    });

    it('sends a confirmation email when the user has an email address', async () => {
      const createdRide = {
        id: 'ride-2',
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
      mockPrisma.account.findUnique.mockResolvedValue({
        email: 'alice@example.com',
        fullName: 'Alice',
      });

      await service.createRide('user-1', dto);

      expect(mockMail.sendRideConfirmed).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getUserRides ─────────────────────────────────────────

  describe('getUserRides', () => {
    it('returns paginated rides for the user', async () => {
      const rides = [{ id: 'ride-1' }, { id: 'ride-2' }];
      mockPrisma.ride.findMany.mockResolvedValue(rides);
      mockPrisma.ride.count.mockResolvedValue(2);

      const result = await service.getUserRides('user-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });
  });

  // ─── getRideById ──────────────────────────────────────────

  describe('getRideById', () => {
    it('returns the ride if the requester is the owner', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId: 'user-1',
        riderId: null,
      });
      mockPrisma.rider.findUnique.mockResolvedValue(null);

      const result = await service.getRideById('ride-1', 'user-1');

      expect(result.id).toBe('ride-1');
    });

    it('returns the ride if the requester is the assigned rider', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId: 'other',
        riderId: 'rider-1',
      });
      mockPrisma.rider.findUnique.mockResolvedValue({
        id: 'rider-1',
        accountId: 'acc-rider',
      });

      const result = await service.getRideById('ride-1', 'acc-rider');

      expect(result.id).toBe('ride-1');
    });

    it('throws NotFoundException when ride does not exist', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue(null);

      await expect(
        service.getRideById('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for unrelated account', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId: 'owner',
        riderId: 'rider-1',
      });
      mockPrisma.rider.findUnique.mockResolvedValue({
        id: 'rider-other',
        accountId: 'stranger',
      });

      await expect(service.getRideById('ride-1', 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── acceptRide ───────────────────────────────────────────

  describe('acceptRide', () => {
    const rider = {
      id: 'rider-1',
      accountId: 'acc-rider',
      isVerified: true,
      isAvailable: true,
    };

    it('assigns the rider and moves status to ACCEPTED', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue(rider);
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        status: RideStatus.PENDING,
      });
      const updatedRide = {
        id: 'ride-1',
        riderId: rider.id,
        status: RideStatus.ACCEPTED,
        userId: 'user-1',
        pickupAddress: 'CBD',
        dropoffAddress: 'Westlands',
        estimatedFare: 80,
        user: null,
        bikeModel: null,
        bikeRegistration: 'KCA 001A',
        ratingAverage: 4.5,
      };
      mockPrisma.ride.update.mockResolvedValue(updatedRide);
      mockPrisma.account.findUnique.mockResolvedValue(null); // skip mail

      const result = await service.acceptRide('ride-1', 'acc-rider');

      expect(result.status).toBe(RideStatus.ACCEPTED);
    });

    it('throws ForbiddenException when rider profile not found', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue(null);

      await expect(service.acceptRide('ride-1', 'acc-rider')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when rider is not verified', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue({
        ...rider,
        isVerified: false,
      });

      await expect(service.acceptRide('ride-1', 'acc-rider')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when rider is unavailable', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue({
        ...rider,
        isAvailable: false,
      });

      await expect(service.acceptRide('ride-1', 'acc-rider')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when ride is not PENDING', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue(rider);
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        status: RideStatus.ACCEPTED,
      });

      await expect(service.acceptRide('ride-1', 'acc-rider')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── updateRideStatus ─────────────────────────────────────

  describe('updateRideStatus', () => {
    const rider = { id: 'rider-1', accountId: 'acc-rider' };

    it.each([
      [RideStatus.ACCEPTED, RideStatus.EN_ROUTE_TO_PICKUP],
      [RideStatus.EN_ROUTE_TO_PICKUP, RideStatus.ARRIVED_AT_PICKUP],
      [RideStatus.ARRIVED_AT_PICKUP, RideStatus.IN_PROGRESS],
    ])('allows transition %s → %s', async (from, to) => {
      mockPrisma.rider.findUnique.mockResolvedValue(rider);
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        status: from,
        riderId: rider.id,
      });
      mockPrisma.ride.update.mockResolvedValue({ id: 'ride-1', status: to });

      const result = await service.updateRideStatus('ride-1', 'acc-rider', to);

      expect(result.status).toBe(to);
    });

    it('sets completedAt and increments totalRides on COMPLETED', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue(rider);
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        status: RideStatus.IN_PROGRESS,
        riderId: rider.id,
        estimatedFare: 100,
        userId: 'user-1',
        pickupAddress: 'A',
        dropoffAddress: 'B',
        distanceKm: 2,
        paymentMethod: 'MPESA',
      });
      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-1',
        status: RideStatus.COMPLETED,
        finalFare: 100,
        userId: 'user-1',
        pickupAddress: 'A',
        dropoffAddress: 'B',
        distanceKm: 2,
        paymentMethod: 'MPESA',
      });
      mockPrisma.rider.update.mockResolvedValue({});
      mockPrisma.account.findUnique.mockResolvedValue(null); // skip mail

      await service.updateRideStatus(
        'ride-1',
        'acc-rider',
        RideStatus.COMPLETED,
      );

      expect(mockPrisma.rider.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { totalRides: { increment: 1 } } }),
      );
    });

    it('throws BadRequestException for an invalid status transition', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue(rider);
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        status: RideStatus.PENDING, // not in ALLOWED_STATUS_TRANSITIONS
        riderId: rider.id,
      });

      await expect(
        service.updateRideStatus('ride-1', 'acc-rider', RideStatus.COMPLETED),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when ride belongs to a different rider', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue({
        id: 'rider-other',
        accountId: 'acc-rider',
      });
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        status: RideStatus.ACCEPTED,
        riderId: 'rider-1', // different
      });

      await expect(
        service.updateRideStatus(
          'ride-1',
          'acc-rider',
          RideStatus.EN_ROUTE_TO_PICKUP,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── cancelRide ───────────────────────────────────────────

  describe('cancelRide', () => {
    it('cancels a PENDING ride', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId: 'user-1',
        status: RideStatus.PENDING,
      });
      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-1',
        status: RideStatus.CANCELLED,
      });

      const result = await service.cancelRide('ride-1', 'user-1');

      expect(result.status).toBe(RideStatus.CANCELLED);
    });

    it('cancels an ACCEPTED ride', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId: 'user-1',
        status: RideStatus.ACCEPTED,
      });
      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-1',
        status: RideStatus.CANCELLED,
      });

      const result = await service.cancelRide('ride-1', 'user-1');

      expect(result.status).toBe(RideStatus.CANCELLED);
    });

    it('throws BadRequestException when ride is IN_PROGRESS', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId: 'user-1',
        status: RideStatus.IN_PROGRESS,
      });

      await expect(service.cancelRide('ride-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when user does not own the ride', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId: 'other',
        status: RideStatus.PENDING,
      });

      await expect(service.cancelRide('ride-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when ride does not exist', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue(null);

      await expect(service.cancelRide('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getRiderActiveRide ───────────────────────────────────

  describe('getRiderActiveRide', () => {
    it('returns the active ride for the rider', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });
      const activeRide = { id: 'ride-1', status: RideStatus.IN_PROGRESS };
      mockPrisma.ride.findFirst.mockResolvedValue(activeRide);

      const result = await service.getRiderActiveRide('acc-rider');

      expect(result).toEqual(activeRide);
    });

    it('throws NotFoundException when rider profile does not exist', async () => {
      mockPrisma.rider.findUnique.mockResolvedValue(null);

      await expect(service.getRiderActiveRide('acc-rider')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
