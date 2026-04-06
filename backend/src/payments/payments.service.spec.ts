import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { Lipana } from '@lipana/sdk';

import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { LipanaWebhookService } from './lipana-webhook.service';
import { PaymentAuditService } from './payment-audit.service';
import { TrackingGateway } from '../tracking/tracking.gateway';

// Mock Lipana SDK at the module level
jest.mock('@lipana/sdk');
const MockedLipana = jest.mocked(Lipana);

const mockLipanaInstance = {
  transactions: {
    initiateStkPush: jest.fn(),
  },
};

const mockPrisma = {
  ride: { findUnique: jest.fn() },
  parcel: { findUnique: jest.fn() },
  payment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockConfig = {
  getOrThrow: jest.fn(),
};

const mockWebhookService = {
  verifySignature: jest.fn(),
  parseWebhookPayload: jest.fn(),
  isTimestampValid: jest.fn(),
};

const mockAuditService = {
  createLog: jest.fn(),
  getLogsForPayment: jest.fn(),
  getLogsForUser: jest.fn(),
  getSuspiciousActivity: jest.fn(),
};

const mockTrackingGateway = {
  emitPaymentUpdate: jest.fn(),
  emitTripPaymentUpdate: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeAll(() => {
    // Silence Logger output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  beforeEach(async () => {
    // Setup Lipana mock
    MockedLipana.mockImplementation(
      () => mockLipanaInstance as unknown as Lipana,
    );
    mockLipanaInstance.transactions.initiateStkPush.mockClear();
    mockWebhookService.verifySignature.mockClear();
    mockWebhookService.parseWebhookPayload.mockClear();

    // Setup ConfigService mock BEFORE compiling
    mockConfig.getOrThrow.mockReturnValue('lip_sk_test_mock_key');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: LipanaWebhookService, useValue: mockWebhookService },
        { provide: PaymentAuditService, useValue: mockAuditService },
        { provide: TrackingGateway, useValue: mockTrackingGateway },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  // ─── initiatePayment ──────────────────────────────────────

  describe('initiatePayment', () => {
    const userId = 'user-1';
    const rideDto = {
      rideId: 'ride-1',
      method: PaymentMethod.MPESA,
      mpesaPhone: '0712345678',
    };
    const cashDto = { rideId: 'ride-1', method: PaymentMethod.CASH };

    it('throws BadRequestException when neither rideId nor parcelId is provided', async () => {
      await expect(
        service.initiatePayment(userId, {
          method: PaymentMethod.MPESA,
          mpesaPhone: '07x',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when ride does not exist', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue(null);

      await expect(service.initiatePayment(userId, rideDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when ride belongs to another user', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId: 'other',
        estimatedFare: 100,
      });

      await expect(service.initiatePayment(userId, rideDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('records a CASH payment without calling Lipana', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId,
        estimatedFare: 100,
      });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1' });

      const result = await service.initiatePayment(userId, cashDto);

      expect(result.method).toBe(PaymentMethod.CASH);
      expect(
        mockLipanaInstance.transactions.initiateStkPush,
      ).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for MPESA payment without mpesaPhone', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId,
        estimatedFare: 100,
      });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1' });

      await expect(
        service.initiatePayment(userId, {
          rideId: 'ride-1',
          method: PaymentMethod.MPESA,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('initiates STK push via Lipana and returns transactionId on success', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId,
        estimatedFare: 100,
      });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      mockPrisma.payment.update.mockResolvedValue({});

      mockLipanaInstance.transactions.initiateStkPush.mockResolvedValue({
        transactionId: 'TXN1234567890',
        checkoutRequestID: 'ws_CO_123',
      });

      const result = await service.initiatePayment(userId, rideDto);

      expect(result.transactionId).toBe('TXN1234567890');
      expect(result.checkoutRequestId).toBe('ws_CO_123');
      expect(result.paymentId).toBe('pay-1');
      expect(
        mockLipanaInstance.transactions.initiateStkPush,
      ).toHaveBeenCalledWith({
        phone: '+254712345678',
        amount: 100,
        accountReference: expect.stringContaining('NduthiRide-ride-'),
        transactionDesc: 'Ride payment',
      });
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { checkoutRequestId: 'ws_CO_123' },
      });
    });

    it('accepts Lipana STK response with checkoutRequestId (camelCase id)', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId,
        estimatedFare: 100,
      });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      mockPrisma.payment.update.mockResolvedValue({});

      mockLipanaInstance.transactions.initiateStkPush.mockResolvedValue({
        transactionId: 'TXN1234567890',
        checkoutRequestId: 'ws_CO_123',
      });

      const result = await service.initiatePayment(userId, rideDto);

      expect(result.checkoutRequestId).toBe('ws_CO_123');
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { checkoutRequestId: 'ws_CO_123' },
      });
    });

    it('accepts Lipana STK envelope with nested data object', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId,
        estimatedFare: 100,
      });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      mockPrisma.payment.update.mockResolvedValue({});

      mockLipanaInstance.transactions.initiateStkPush.mockResolvedValue({
        success: true,
        message: 'STK push initiated',
        data: {
          transactionId: 'TXN_NESTED',
          checkoutRequestID: 'ws_CO_NESTED',
        },
      });

      const result = await service.initiatePayment(userId, rideDto);

      expect(result.checkoutRequestId).toBe('ws_CO_NESTED');
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { checkoutRequestId: 'ws_CO_NESTED' },
      });
    });

    it('accepts STK response using id as transactionId when transactionId absent', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId,
        estimatedFare: 100,
      });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      mockPrisma.payment.update.mockResolvedValue({});

      mockLipanaInstance.transactions.initiateStkPush.mockResolvedValue({
        id: 'txn_only_id',
        checkoutRequestID: 'ws_CO_456',
      });

      const result = await service.initiatePayment(userId, rideDto);

      expect(result.transactionId).toBe('txn_only_id');
      expect(result.checkoutRequestId).toBe('ws_CO_456');
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { checkoutRequestId: 'ws_CO_456' },
      });
    });

    it('throws InternalServerErrorException when Lipana STK push fails', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId,
        estimatedFare: 100,
      });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1' });

      mockLipanaInstance.transactions.initiateStkPush.mockRejectedValue(
        new Error('Lipana API error'),
      );

      await expect(service.initiatePayment(userId, rideDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('rejects duplicate requests within idempotency window', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-1',
        userId,
        estimatedFare: 100,
      });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1' });

      // First request succeeds
      mockLipanaInstance.transactions.initiateStkPush.mockResolvedValue({
        transactionId: 'TXN1234567890',
        checkoutRequestID: 'ws_CO_123',
      });

      await service.initiatePayment(userId, rideDto);

      // Second request within 60s should fail
      await expect(service.initiatePayment(userId, rideDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── handleLipanaWebhook ──────────────────────────────────

  describe('handleLipanaWebhook', () => {
    const buildWebhookPayload = (
      event: string,
      status: string,
      transactionId = 'TXN1234567890',
    ) => ({
      event,
      data: {
        transactionId,
        amount: 100,
        status,
        phone: '+254712345678',
        checkoutRequestID: 'ws_CO_123',
        timestamp: new Date().toISOString(), // Add current timestamp
      },
    });

    beforeEach(() => {
      // Webhook signature verification passes by default
      mockWebhookService.verifySignature.mockReturnValue(true);
      // Timestamp validation passes by default
      mockWebhookService.isTimestampValid = jest.fn().mockReturnValue(true);
    });

    it('rejects webhook with invalid signature', async () => {
      mockWebhookService.verifySignature.mockReturnValue(false);

      // Should not throw, just log and return
      await service.handleLipanaWebhook(
        Buffer.from(JSON.stringify({})),
        'invalid-signature',
        {},
      );

      expect(mockWebhookService.verifySignature).toHaveBeenCalled();
      expect(mockPrisma.payment.findFirst).not.toHaveBeenCalled();
    });

    it('marks payment COMPLETED on payment.success event', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.PROCESSING,
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockWebhookService.parseWebhookPayload.mockReturnValue(
        buildWebhookPayload('payment.success', 'success'),
      );

      await service.handleLipanaWebhook(
        Buffer.from(JSON.stringify({})),
        'valid-signature',
        buildWebhookPayload('payment.success', 'success'),
      );

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.COMPLETED,
          }) as unknown,
        }),
      );
    });

    it('marks COMPLETED on payment.success when data.status is processing (not stuck in pending branch)', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.PROCESSING,
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockWebhookService.parseWebhookPayload.mockReturnValue(
        buildWebhookPayload('payment.success', 'processing'),
      );

      await service.handleLipanaWebhook(
        Buffer.from(JSON.stringify({})),
        'valid-signature',
        buildWebhookPayload('payment.success', 'processing'),
      );

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.COMPLETED,
          }) as unknown,
        }),
      );
    });

    it('normalizes payment_success event name to payment.success', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.PROCESSING,
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockWebhookService.parseWebhookPayload.mockReturnValue(
        buildWebhookPayload('payment_success', 'success'),
      );

      await service.handleLipanaWebhook(
        Buffer.from(JSON.stringify({})),
        'valid-signature',
        buildWebhookPayload('payment_success', 'success'),
      );

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.COMPLETED,
          }) as unknown,
        }),
      );
    });

    it('does not mark COMPLETED on transaction.success (STK dispatch, not customer paid)', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.PROCESSING,
      });
      mockWebhookService.parseWebhookPayload.mockReturnValue(
        buildWebhookPayload('transaction.success', 'success'),
      );

      await service.handleLipanaWebhook(
        Buffer.from(JSON.stringify({})),
        'valid-signature',
        buildWebhookPayload('transaction.success', 'success'),
      );

      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('does not mark COMPLETED on payment.completed without official payment.success event', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.PROCESSING,
      });
      mockWebhookService.parseWebhookPayload.mockReturnValue(
        buildWebhookPayload('payment.completed', 'success'),
      );

      await service.handleLipanaWebhook(
        Buffer.from(JSON.stringify({})),
        'valid-signature',
        buildWebhookPayload('payment.completed', 'success'),
      );

      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('does not mark COMPLETED when event is payment.pending even if data.status is success', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.PROCESSING,
      });
      mockWebhookService.parseWebhookPayload.mockReturnValue(
        buildWebhookPayload('payment.pending', 'success'),
      );

      await service.handleLipanaWebhook(
        Buffer.from(JSON.stringify({})),
        'valid-signature',
        buildWebhookPayload('payment.pending', 'success'),
      );

      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockTrackingGateway.emitPaymentUpdate).toHaveBeenCalledWith(
        'pay-1',
        expect.objectContaining({ status: 'PROCESSING' }),
      );
    });

    it('marks payment FAILED on payment.failed event', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.PROCESSING,
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockWebhookService.parseWebhookPayload.mockReturnValue(
        buildWebhookPayload('payment.failed', 'failed'),
      );

      await service.handleLipanaWebhook(
        Buffer.from(JSON.stringify({})),
        'valid-signature',
        buildWebhookPayload('payment.failed', 'failed'),
      );

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PaymentStatus.FAILED },
        }),
      );
    });

    it('does nothing when transaction is not found', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockWebhookService.parseWebhookPayload.mockReturnValue(
        buildWebhookPayload('payment.success', 'success'),
      );

      await service.handleLipanaWebhook(
        Buffer.from(JSON.stringify({})),
        'valid-signature',
        buildWebhookPayload('payment.success', 'success'),
      );

      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('skips already completed payments (idempotency)', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.COMPLETED,
      });
      mockWebhookService.parseWebhookPayload.mockReturnValue(
        buildWebhookPayload('payment.success', 'success'),
      );

      await service.handleLipanaWebhook(
        Buffer.from(JSON.stringify({})),
        'valid-signature',
        buildWebhookPayload('payment.success', 'success'),
      );

      // Should only check status, not update
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('does not throw on webhook processing errors', async () => {
      mockWebhookService.parseWebhookPayload.mockImplementation(() => {
        throw new Error('Parse error');
      });

      // Should not throw - webhooks should always return 200
      await expect(
        service.handleLipanaWebhook(
          Buffer.from(JSON.stringify({})),
          'valid-signature',
          {},
        ),
      ).resolves.toBeUndefined();
    });
  });

  // ─── getPaymentStatus ─────────────────────────────────────

  describe('getPaymentStatus', () => {
    it('returns payment details for a known checkoutRequestId', async () => {
      const payment = {
        id: 'pay-1',
        status: PaymentStatus.COMPLETED,
        amount: 100,
        mpesaReceiptNumber: 'TXN1234567890',
        completedAt: new Date(),
      };
      mockPrisma.payment.findUnique.mockResolvedValue(payment);

      const result = await service.getPaymentStatus('ws_CO_123');

      expect(result).toEqual(payment);
    });

    it('throws NotFoundException for unknown checkoutRequestId', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.getPaymentStatus('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
