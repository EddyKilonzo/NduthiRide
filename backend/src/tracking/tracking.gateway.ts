import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RidersService } from '../riders/riders.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

/** Shape of rider location update emitted from the mobile client */
interface LocationUpdatePayload {
  lat: number;
  lng: number;
  speed?: number;
}

/** Map of accountId → socketId for directing server-push events */
const connectedClients = new Map<string, string>();

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowed = (
        process.env.CORS_ORIGINS ??
        process.env.FRONTEND_URL ??
        'https://nduthi-ride-r479.vercel.app'
      ).split(',').map(o => o.trim());
      if (!origin || allowed.includes(origin)) callback(null, true);
      else callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  },
  namespace: '/tracking',
  // Allow polling fallback so WebSocket upgrades aren't mandatory.
  // Render's proxy can drop WebSocket upgrades; polling ensures a reliable
  // baseline transport. pingTimeout/pingInterval keep idle connections alive.
  transports: ['polling', 'websocket'],
  pingTimeout: 60_000,
  pingInterval: 25_000,
  connectTimeout: 45_000,
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ridersService: RidersService,
  ) {}

  // ─── Connection lifecycle ─────────────────────────────────

  /**
   * On connection: validate the JWT from the handshake, then:
   * - Register the client in connectedClients map
   * - Join their personal room (user:accountId or rider:accountId)
   * - If RIDER, also join the shared 'riders' room for broadcast requests
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as { token?: string }).token ??
        (client.handshake.headers.authorization ?? '').replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      });

      // Attach identity to the socket for use in message handlers
      (client.data as { accountId: string; role: string }) = {
        accountId: payload.sub,
        role: payload.role,
      };

      connectedClients.set(payload.sub, client.id);

      // Each user/rider gets a private room for direct server-push events
      await client.join(`account:${payload.sub}`);

      if (payload.role === 'RIDER') {
        await client.join('riders'); // Receives new ride/parcel broadcast requests
      }

      if (payload.role === 'ADMIN') {
        await client.join('admins');
      }

      this.logger.log(`Connected: ${payload.sub} (${payload.role})`);
    } catch {
      // Invalid JWT — disconnect immediately
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const data = client.data as { accountId?: string };
    if (data?.accountId) {
      connectedClients.delete(data.accountId);
      this.logger.log(`Disconnected: ${data.accountId}`);
    }
  }

  // ─── Admin → Server events ────────────────────────────────

  /**
   * Admin joins the live tracking room to see all riders.
   * Immediately pushes the initial state of all active riders.
   */
  @SubscribeMessage('admin:join')
  async handleAdminJoin(@ConnectedSocket() client: Socket): Promise<void> {
    const { role } = client.data as { role: string };
    if (role !== 'ADMIN') return;

    await client.join('admins:live-map');
    
    // Initial push of all active/available riders
    const riders = await this.prisma.rider.findMany({
      where: {
        OR: [
          { isAvailable: true },
          { ridesAsRider: { some: { status: { in: ['ACCEPTED', 'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PICKUP', 'IN_PROGRESS'] } } } },
          { parcelsAsRider: { some: { status: { in: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'] } } } }
        ]
      },
      include: { account: { select: { fullName: true } } }
    });

    const mapData = riders.map(r => ({
      id: r.id,
      fullName: r.account.fullName,
      lat: r.currentLat,
      lng: r.currentLng,
      status: r.isAvailable ? 'AVAILABLE' : 'ACTIVE',
      lastSeen: r.lastSeenAt
    })).filter(r => r.lat && r.lng);

    client.emit('tracking:all-riders', mapData);
  }

  // ─── Rider → Server events ────────────────────────────────

  /**
   * Rider sends their GPS coordinates.
   * Updates the database and forwards location to the user who has an active ride with this rider.
   *
   * Payload: { lat, lng, speed? }
   * Debounce is enforced on the client side (every 5 seconds).
   */
  @SubscribeMessage('rider:location-update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LocationUpdatePayload,
  ): Promise<void> {
    const { accountId } = client.data as { accountId: string };

    // Find the rider record
    const rider = await this.prisma.rider.findUnique({ where: { accountId } });
    if (!rider) return;

    // Persist location + history record
    await this.ridersService.updateLocation(accountId, {
      lat: payload.lat,
      lng: payload.lng,
      speed: payload.speed,
    });

    // Broadcast update to admins watching the live map
    this.server.to('admins:live-map').emit('tracking:location', {
      riderId: rider.id,
      lat: payload.lat,
      lng: payload.lng,
      speed: payload.speed,
      timestamp: new Date().toISOString(),
    });

    // Find the user on the active ride with this rider and forward their ETA
    const activeRide = await this.prisma.ride.findFirst({
      where: {
        riderId: rider.id,
        status: {
          in: [
            'ACCEPTED',
            'EN_ROUTE_TO_PICKUP',
            'ARRIVED_AT_PICKUP',
            'IN_PROGRESS',
          ],
        },
      },
    });

    if (activeRide) {
      // Push live location to the passenger's room
      this.server.to(`account:${activeRide.userId}`).emit('tracking:location', {
        riderId: rider.id,
        lat: payload.lat,
        lng: payload.lng,
        speed: payload.speed,
        timestamp: new Date().toISOString(),
      });
    }

    // Also push to the parcel sender if the rider is on an active parcel delivery
    const activeParcel = await this.prisma.parcel.findFirst({
      where: {
        riderId: rider.id,
        status: { in: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'] },
      },
    });

    if (activeParcel) {
      this.server.to(`account:${activeParcel.userId}`).emit('tracking:location', {
        riderId: rider.id,
        lat: payload.lat,
        lng: payload.lng,
        speed: payload.speed,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Rider toggles their online/offline availability.
   * Payload: { isAvailable: boolean }
   */
  @SubscribeMessage('rider:toggle-availability')
  async handleToggleAvailability(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { isAvailable: boolean },
  ): Promise<{ isAvailable: boolean }> {
    const { accountId } = client.data as { accountId: string };
    const result = await this.ridersService.updateAvailability(accountId, {
      isAvailable: payload.isAvailable,
    });
    return result;
  }

  // ─── Server → Client emission helpers ────────────────────

  /**
   * Emits an event to a specific account's private room.
   * Used by RidesService, ParcelsService, PaymentsService to push updates.
   */
  emitToAccount(accountId: string, event: string, data: unknown): void {
    this.server.to(`account:${accountId}`).emit(event, data);
  }

  /**
   * Broadcasts a new ride request to all connected, available riders.
   * In production this would be filtered by proximity (nearby riders).
   */
  emitNewRideRequest(rideData: unknown): void {
    this.server.to('riders').emit('ride:new-request', rideData);
  }

  /**
   * Broadcasts a new parcel request to all connected riders.
   */
  emitNewParcelRequest(parcelData: unknown): void {
    this.server.to('riders').emit('parcel:new-request', parcelData);
  }

  /**
   * Client subscribes to payment status updates for a specific payment.
   * Client joins a room named `payment:${paymentId}` to receive updates.
   */
  @SubscribeMessage('payment:subscribe')
  handlePaymentSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { paymentId: string },
  ): void {
    const { paymentId } = payload;
    client.join(`payment:${paymentId}`);
    this.logger.log(`Client ${client.id} subscribed to payment ${paymentId}`);
  }

  /**
   * Client unsubscribes from payment status updates.
   */
  @SubscribeMessage('payment:unsubscribe')
  handlePaymentUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { paymentId: string },
  ): void {
    const { paymentId } = payload;
    client.leave(`payment:${paymentId}`);
    this.logger.log(`Client ${client.id} unsubscribed from payment ${paymentId}`);
  }

  /**
   * Emits payment status update to all clients subscribed to a payment.
   * Called by PaymentsService when webhook arrives.
   */
  emitPaymentUpdate(paymentId: string, data: {
    status: string;
    amount?: number;
    mpesaReceiptNumber?: string | null;
    completedAt?: string;
  }): void {
    this.server.to(`payment:${paymentId}`).emit('payment:updated', data);
    this.logger.log(`Emitted payment update for ${paymentId}: ${data.status}`);
  }

  /**
   * Notifies passenger and rider (by account id) that a trip payment reached a terminal state.
   * Clients join `account:${accountId}` on connect — no extra subscribe step.
   */
  emitTripPaymentUpdate(
    accountId: string,
    data: {
      kind: 'ride' | 'parcel';
      entityId: string;
      paymentId: string;
      status: 'COMPLETED' | 'FAILED';
      mpesaReceiptNumber?: string | null;
      completedAt?: string | null;
    },
  ): void {
    this.server.to(`account:${accountId}`).emit('trip:payment', data);
    this.logger.log(
      `Emitted trip:payment (${data.status}) for ${data.kind} ${data.entityId} → account ${accountId}`,
    );
  }
}
