import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

/**
 * Service for verifying Lipana webhook signatures.
 * Ensures webhook requests are authentic and haven't been tampered with.
 */
@Injectable()
export class LipanaWebhookService {
  private readonly logger = new Logger(LipanaWebhookService.name);
  private readonly webhookSecret: string;

  // Store processed webhook IDs to prevent replay attacks
  private readonly processedWebhooks = new Map<string, number>();
  private readonly REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private readonly config: ConfigService) {
    this.webhookSecret = this.config.getOrThrow<string>('lipana.webhookSecret');
  }

  /**
   * Verifies the authenticity of a Lipana webhook request.
   *
   * @param payload - The raw request body (as string or Buffer)
   * @param signature - The X-Lipana-Signature header value
   * @returns true if the signature is valid, false otherwise
   *
   * @throws BadRequestException if signature header is missing
   */
  verifySignature(payload: string | Buffer, signature?: string): boolean {
    if (!signature) {
      this.logger.warn('Webhook request missing X-Lipana-Signature header');
      throw new BadRequestException('Missing webhook signature');
    }

    try {
      // Convert payload to Buffer if it's a string
      const body = typeof payload === 'string' ? Buffer.from(payload) : payload;

      // Compute expected signature using HMAC-SHA256
      const expectedSignature = createHmac('sha256', this.webhookSecret)
        .update(body)
        .digest('hex');

      // Use constant-time comparison to prevent timing attacks
      const signatureBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (signatureBuffer.length !== expectedBuffer.length) {
        this.logger.warn('Webhook signature length mismatch');
        return false;
      }

      const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);

      if (!isValid) {
        this.logger.warn('Invalid webhook signature detected');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error);
      return false;
    }
  }

  /**
   * Parses and validates a Lipana webhook payload.
   * Also checks for replay attacks using transactionId + timestamp.
   *
   * @param body - The parsed JSON body from the webhook request
   * @returns The validated payload with proper typing
   *
   * @throws BadRequestException if payload structure is invalid or replay detected
   */
  parseWebhookPayload(body: unknown): {
    event: string;
    data: {
      transactionId: string;
      amount: number;
      status: string;
      phone: string;
      checkoutRequestID?: string;
      timestamp?: string;
    };
  } {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid webhook payload');
    }

    const payload = body as Record<string, unknown>;

    // Validate required fields
    if (typeof payload.event !== 'string') {
      throw new BadRequestException('Missing or invalid event field');
    }

    if (!payload.data || typeof payload.data !== 'object') {
      throw new BadRequestException('Missing or invalid data field');
    }

    const data = payload.data as Record<string, unknown>;

    if (typeof data.transactionId !== 'string') {
      throw new BadRequestException('Missing transactionId');
    }

    if (typeof data.amount !== 'number' || data.amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    if (typeof data.status !== 'string') {
      throw new BadRequestException('Missing status');
    }

    if (typeof data.phone !== 'string') {
      throw new BadRequestException('Missing phone');
    }

    // Check for replay attacks
    const webhookId = `${data.transactionId}:${data.timestamp || ''}`;
    if (this.isReplayAttack(webhookId)) {
      this.logger.warn(`Replay attack detected for webhook: ${webhookId}`);
      throw new BadRequestException(
        'Webhook already processed (replay attack prevented)',
      );
    }
    this.recordProcessedWebhook(webhookId);

    return {
      event: payload.event,
      data: {
        transactionId: data.transactionId,
        amount: data.amount,
        status: data.status,
        phone: data.phone,
        checkoutRequestID: data.checkoutRequestID as string | undefined,
        timestamp: data.timestamp as string | undefined,
      },
    };
  }

  /**
   * Checks if a webhook has already been processed (replay attack prevention).
   */
  private isReplayAttack(webhookId: string): boolean {
    try {
      return this.processedWebhooks.has(webhookId);
    } catch (error) {
      this.logger.error('Replay attack check failed', error);
      return false;
    }
  }

  /**
   * Records a processed webhook to prevent replay attacks.
   */
  private recordProcessedWebhook(webhookId: string): void {
    try {
      this.processedWebhooks.set(webhookId, Date.now());

      // Cleanup old entries (older than replay window)
      const now = Date.now();
      for (const [id, timestamp] of this.processedWebhooks.entries()) {
        if (now - timestamp > this.REPLAY_WINDOW_MS) {
          this.processedWebhooks.delete(id);
        }
      }
    } catch (error) {
      this.logger.error('Failed to record processed webhook', error);
    }
  }

  /**
   * Generates a unique nonce for additional replay protection.
   * Can be used in conjunction with timestamp validation.
   */
  generateNonce(): string {
    try {
      return randomBytes(32).toString('hex');
    } catch (error) {
      this.logger.error('Failed to generate nonce', error);
      throw new InternalServerErrorException(
        'Failed to generate security nonce',
      );
    }
  }

  /**
   * Validates webhook timestamp is within acceptable window (5 minutes).
   * Prevents old webhooks from being processed.
   */
  isTimestampValid(timestamp?: string): boolean {
    try {
      if (!timestamp) return true; // Skip if no timestamp provided

      const webhookTime = new Date(timestamp).getTime();
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes

      return Math.abs(now - webhookTime) <= maxAge;
    } catch (error) {
      this.logger.error('Timestamp validation failed', error);
      return false;
    }
  }
}
