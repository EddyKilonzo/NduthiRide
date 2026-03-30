import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ParcelStatus } from '@prisma/client';

import { ParcelsService } from './parcels.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';

const mockPrisma = {
  parcel: {
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
  rating: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  setting: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockMail = {
  sendParcelConfirmed: jest.fn(),
};

const mockTrackingGateway = {
  emitNewParcelRequest: jest.fn(),
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

describe('ParcelsService', () => {
  let service: ParcelsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParcelsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMail },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: TrackingGateway, useValue: mockTrackingGateway },
        { provide: ChatService, useValue: mockChatService },
        { provide: ChatGateway, useValue: mockChatGateway },
      ],
    }).compile();

    service = module.get<ParcelsService>(ParcelsService);
    jest.clearAllMocks();
  });

  // ─── calculateEstimate ────────────────────────────────────

  describe('calculateEstimate', () => {
    it('calculates estimate with base fee and distance rate', () => {
      const dto = {
        pickupLat: -1.2921,
        pickupLng: 36.8219,
        dropoffLat: -1.2921,
        dropoffLng: 36.83, // ~0.9km away
        weightKg: 1.0,
      };

      const result = service.calculateEstimate(dto);

      expect(result.distanceKm).toBeGreaterThan(0);
      expect(result.deliveryFee).toBeGreaterThan(80); // base fee
    });

    it('adds weight surcharge for packages over 1kg', () => {
      const dto = {
        pickupLat: -1.2921,
        pickupLng: 36.8219,
        dropoffLat: -1.2921,
        dropoffLng: 36.8219, // distance 0
        weightKg: 3.0, // 2kg extra
      };

      const result = service.calculateEstimate(dto);

      // base (80) + distance (0) + 2kg * 20 = 120
      expect(result.deliveryFee).toBe(120);
    });
  });

  // ─── createParcel ─────────────────────────────────────────

  describe('createParcel', () => {
    const dto = {
      pickupLat: -1.2921,
      pickupLng: 36.8219,
      pickupAddress: 'CBD',
      dropoffLat: -1.28,
      dropoffLng: 36.81,
      dropoffAddress: 'Westlands',
      itemDescription: 'Documents',
      weightKg: 0.5,
      recipientName: 'Jane',
      recipientPhone: '07x',
      paymentMethod: 'MPESA' as const,
      mpesaPhone: '0712345678',
    };

    it('creates a parcel and emits notification', async () => {
      const createdParcel = {
        id: 'parcel-1',
        userId: 'user-1',
        ...dto,
        deliveryFee: 100,
        distanceKm: 2.0,
        user: { fullName: 'Alice', phone: '07x' },
      };
      mockPrisma.parcel.create.mockResolvedValue(createdParcel);

      const result = await service.createParcel('user-1', dto);

      expect(result.id).toBe('parcel-1');
      expect(mockPrisma.parcel.create).toHaveBeenCalled();
      expect(mockTrackingGateway.emitNewParcelRequest).toHaveBeenCalledWith(
        createdParcel,
      );
    });
  });

  // ─── getUserParcels ───────────────────────────────────────

  describe('getUserParcels', () => {
    it('returns paginated parcels for a user', async () => {
      const parcels = [{ id: '1' }, { id: '2' }];
      mockPrisma.parcel.findMany.mockResolvedValue(parcels);
      mockPrisma.parcel.count.mockResolvedValue(2);

      const result = await service.getUserParcels('user-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });
  });

  // ─── getParcelById ────────────────────────────────────────

  describe('getParcelById', () => {
    const parcelId = 'parcel-1';
    const userId = 'user-1';

    it('returns a parcel if user is owner', async () => {
      const mockParcel = { id: parcelId, userId, riderId: null };
      mockPrisma.parcel.findUnique.mockResolvedValue(mockParcel);
      mockPrisma.rider.findUnique.mockResolvedValue(null);

      const result = await service.getParcelById(parcelId, userId);

      expect(result.id).toBe(parcelId);
    });

    it('throws ForbiddenException if user is not involved', async () => {
      const mockParcel = { id: parcelId, userId: 'other-user', riderId: 'other-rider' };
      mockPrisma.parcel.findUnique.mockResolvedValue(mockParcel);
      mockPrisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });

      await expect(service.getParcelById(parcelId, 'random-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException if parcel does not exist', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(null);
      await expect(service.getParcelById(parcelId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── acceptParcel ─────────────────────────────────────────

  describe('acceptParcel', () => {
    const parcelId = 'parcel-1';
    const riderAccountId = 'rider-acc-1';
    const riderId = 'rider-1';

    it('allows verified rider to accept a PENDING parcel', async () => {
      const mockRider = { id: riderId, accountId: riderAccountId, isVerified: true };
      const mockParcel = { id: parcelId, status: ParcelStatus.PENDING };

      mockPrisma.rider.findUnique.mockResolvedValue(mockRider);
      mockPrisma.parcel.findUnique.mockResolvedValue(mockParcel);
      mockPrisma.account.findUnique.mockResolvedValue({ fullName: 'Rider Name' });
      mockPrisma.parcel.update.mockResolvedValue({
        ...mockParcel,
        riderId,
        status: ParcelStatus.ACCEPTED,
        user: { fullName: 'Alice' },
      });

      const result = await service.acceptParcel(parcelId, riderAccountId);

      expect(result.status).toBe(ParcelStatus.ACCEPTED);
      expect(mockChatService.createConversation).toHaveBeenCalledWith(
        undefined,
        parcelId,
      );
    });

    it('throws ForbiddenException if rider is not verified', async () => {
      const mockRider = { id: riderId, accountId: riderAccountId, isVerified: false };
      mockPrisma.rider.findUnique.mockResolvedValue(mockRider);

      await expect(service.acceptParcel(parcelId, riderAccountId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── updateParcelStatus ───────────────────────────────────

  describe('updateParcelStatus', () => {
    const parcelId = 'parcel-1';
    const riderAccountId = 'rider-acc-1';
    const riderId = 'rider-1';

    it('allows rider to update status in order', async () => {
      const mockRider = { id: riderId };
      const mockParcel = { id: parcelId, riderId, status: ParcelStatus.ACCEPTED };

      mockPrisma.rider.findUnique.mockResolvedValue(mockRider);
      mockPrisma.parcel.findUnique.mockResolvedValue(mockParcel);
      mockPrisma.account.findUnique.mockResolvedValue({ fullName: 'Rider' });
      mockPrisma.parcel.update.mockResolvedValue({
        ...mockParcel,
        status: ParcelStatus.PICKED_UP,
      });

      const result = await service.updateParcelStatus(
        parcelId,
        riderAccountId,
        ParcelStatus.PICKED_UP,
      );

      expect(result.status).toBe(ParcelStatus.PICKED_UP);
    });

    it('throws BadRequestException for invalid transition', async () => {
      const mockRider = { id: riderId };
      const mockParcel = { id: parcelId, riderId, status: ParcelStatus.ACCEPTED };

      mockPrisma.rider.findUnique.mockResolvedValue(mockRider);
      mockPrisma.parcel.findUnique.mockResolvedValue(mockParcel);

      await expect(
        service.updateParcelStatus(parcelId, riderAccountId, ParcelStatus.DELIVERED),
      ).rejects.toThrow(BadRequestException);
    });

    it('closes conversation and emits event when delivered', async () => {
      const mockRider = { id: riderId };
      const mockParcel = { id: parcelId, riderId, status: ParcelStatus.IN_TRANSIT };
      const mockConversation = { id: 'conv-1' };

      mockPrisma.rider.findUnique.mockResolvedValue(mockRider);
      mockPrisma.parcel.findUnique.mockResolvedValue(mockParcel);
      mockPrisma.account.findUnique.mockResolvedValue({ fullName: 'Rider' });
      mockPrisma.parcel.update.mockResolvedValue({
        ...mockParcel,
        status: ParcelStatus.DELIVERED,
      });
      mockChatService.getConversationByRideOrParcel.mockResolvedValue(
        mockConversation,
      );
      mockChatService.closeConversation.mockResolvedValue({
        id: 'conv-1',
        closedAt: new Date(),
      });

      await service.updateParcelStatus(
        parcelId,
        riderAccountId,
        ParcelStatus.DELIVERED,
      );

      expect(mockChatService.closeConversation).toHaveBeenCalledWith('conv-1');
      expect(mockChatGateway.emitChatClosed).toHaveBeenCalled();
    });
  });

  // ─── uploadProof ──────────────────────────────────────────

  describe('uploadProof', () => {
    it('updates parcel with proof image URL', async () => {
      const riderAccountId = 'rider-acc-1';
      const riderId = 'rider-1';
      const parcelId = 'parcel-1';
      const imageUrl = 'https://cloudinary.com/image.jpg';

      mockPrisma.rider.findUnique.mockResolvedValue({ id: riderId });
      mockPrisma.parcel.findUnique.mockResolvedValue({ id: parcelId, riderId });
      mockPrisma.parcel.update.mockResolvedValue({ id: parcelId, proofImageUrl: imageUrl });

      const result = await service.uploadProof(parcelId, riderAccountId, imageUrl);

      expect(result.proofImageUrl).toBe(imageUrl);
    });
  });

  // ─── getRiderActiveParcel ─────────────────────────────────

  describe('getRiderActiveParcel', () => {
    it('returns the active parcel for a rider', async () => {
      const riderAccountId = 'rider-acc-1';
      const riderId = 'rider-1';
      mockPrisma.rider.findUnique.mockResolvedValue({ id: riderId });
      mockPrisma.parcel.findFirst.mockResolvedValue({ id: 'parcel-1', riderId });

      const result = await service.getRiderActiveParcel(riderAccountId);

      expect(result.id).toBe('parcel-1');
    });
  });

  // ─── cancelParcel ─────────────────────────────────────────

  describe('cancelParcel', () => {
    const parcelId = 'parcel-1';
    const userId = 'user-1';
    const riderId = 'rider-1';
    const riderAccountId = 'rider-acc-1';

    const mockParcel = {
      id: parcelId,
      userId,
      riderId: null,
      status: ParcelStatus.PENDING,
    };

    it('throws NotFoundException if parcel does not exist', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(null);
      await expect(service.cancelParcel(parcelId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException if account is neither owner nor assigned rider', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(mockParcel);
      mockPrisma.rider.findUnique.mockResolvedValue(null);
      await expect(service.cancelParcel(parcelId, 'wrong-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException if status is not cancellable (e.g., PICKED_UP)', async () => {
      const pickedUpParcel = { ...mockParcel, status: ParcelStatus.PICKED_UP };
      mockPrisma.parcel.findUnique.mockResolvedValue(pickedUpParcel);
      await expect(service.cancelParcel(parcelId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows owner to cancel a PENDING parcel', async () => {
      mockPrisma.parcel.findUnique.mockResolvedValue(mockParcel);
      mockPrisma.parcel.update.mockResolvedValue({
        ...mockParcel,
        status: ParcelStatus.CANCELLED,
      });

      const result = await service.cancelParcel(parcelId, userId);

      expect(result.status).toBe(ParcelStatus.CANCELLED);
      expect(mockPrisma.parcel.update).toHaveBeenCalledWith({
        where: { id: parcelId },
        data: { status: ParcelStatus.CANCELLED },
      });
      // Conversation should NOT be closed because it wasn't ACCEPTED yet
      expect(mockChatService.getConversationByRideOrParcel).not.toHaveBeenCalled();
    });

    it('allows assigned rider to cancel an ACCEPTED parcel and closes chat', async () => {
      const acceptedParcel = {
        ...mockParcel,
        status: ParcelStatus.ACCEPTED,
        riderId,
      };
      const mockRider = { id: riderId, accountId: riderAccountId };
      const mockConversation = { id: 'conv-1' };

      mockPrisma.parcel.findUnique.mockResolvedValue(acceptedParcel);
      mockPrisma.rider.findUnique.mockResolvedValue(mockRider);
      mockPrisma.parcel.update.mockResolvedValue({
        ...acceptedParcel,
        status: ParcelStatus.CANCELLED,
      });
      mockChatService.getConversationByRideOrParcel.mockResolvedValue(
        mockConversation,
      );
      mockChatService.closeConversation.mockResolvedValue({
        id: 'conv-1',
        closedAt: new Date(),
      });

      const result = await service.cancelParcel(parcelId, riderAccountId);

      expect(result.status).toBe(ParcelStatus.CANCELLED);
      expect(mockChatService.closeConversation).toHaveBeenCalledWith('conv-1');
      expect(mockChatGateway.emitChatClosed).toHaveBeenCalled();
    });
  });

  // ─── rateParcel ───────────────────────────────────────────

  describe('rateParcel', () => {
    const parcelId = 'parcel-1';
    const userId = 'user-1';
    const riderId = 'rider-1';

    it('allows user to rate a delivered parcel', async () => {
      const mockParcel = {
        id: parcelId,
        userId,
        riderId,
        status: ParcelStatus.DELIVERED,
        rating: null,
      };
      mockPrisma.parcel.findUnique.mockResolvedValue(mockParcel);
      mockPrisma.rating.create.mockResolvedValue({ score: 5 });
      mockPrisma.rating.findMany.mockResolvedValue([{ score: 5 }, { score: 4 }]);

      const result = await service.rateParcel(parcelId, userId, {
        score: 5,
        comment: 'Great',
      });

      expect(result.score).toBe(5);
      expect(mockPrisma.rider.update).toHaveBeenCalledWith({
        where: { id: riderId },
        data: { ratingAverage: 4.5 },
      });
    });

    it('throws BadRequestException if already rated', async () => {
      const mockParcel = {
        id: parcelId,
        userId,
        riderId,
        status: ParcelStatus.DELIVERED,
        rating: { id: 'r1' },
      };
      mockPrisma.parcel.findUnique.mockResolvedValue(mockParcel);

      await expect(
        service.rateParcel(parcelId, userId, { score: 5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
