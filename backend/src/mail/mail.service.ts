import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly appUrl: string;
  private readonly fromName: string;
  private readonly fromAddress: string;
  private readonly year = new Date().getFullYear();

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {
    this.appUrl =
      this.config.get<string>('app.frontendUrl') ?? 'http://localhost:4200';
    this.fromName = this.config.get<string>('mail.fromName') ?? 'NduthiRide';
    this.fromAddress =
      this.config.get<string>('mail.fromAddress') ??
      'no-reply@nduthiride.co.ke';
  }

  // ─── Auth emails ─────────────────────────────────────────────────

  async sendWelcomeUser(opts: {
    to: string;
    fullName: string;
    email?: string;
  }): Promise<void> {
    await this.send({
      to: opts.to,
      subject: 'Welcome to NduthiRide! 🏍',
      template: 'welcome-user',
      context: {
        fullName: opts.fullName,
        email: opts.email,
        appUrl: this.appUrl,
        recipientEmail: opts.to,
        year: this.year,
      },
    });
  }

  async sendWelcomeRider(opts: {
    to: string;
    fullName: string;
    licenseNumber: string;
    bikeRegistration: string;
    bikeModel?: string;
  }): Promise<void> {
    await this.send({
      to: opts.to,
      subject: 'Rider Application Received — NduthiRide',
      template: 'welcome-rider',
      context: {
        fullName: opts.fullName,
        licenseNumber: opts.licenseNumber,
        bikeRegistration: opts.bikeRegistration,
        bikeModel: opts.bikeModel,
        appUrl: this.appUrl,
        recipientEmail: opts.to,
        year: this.year,
      },
    });
  }

  async sendEmailVerificationOtp(opts: {
    to: string;
    fullName: string;
    otp: string;
    expiresMins: number;
  }): Promise<void> {
    await this.send({
      to: opts.to,
      subject: `${opts.otp} is your NduthiRide verification code`,
      template: 'verify-email',
      context: {
        fullName: opts.fullName,
        otp: opts.otp,
        expiresMins: opts.expiresMins,
        recipientEmail: opts.to,
        year: this.year,
      },
    });
  }

  async sendPasswordReset(opts: {
    to: string;
    fullName: string;
    resetToken: string;
    expiresMins: number;
  }): Promise<void> {
    const resetUrl = `${this.appUrl}/auth/reset-password?token=${opts.resetToken}`;
    await this.send({
      to: opts.to,
      subject: 'Reset your NduthiRide password',
      template: 'password-reset',
      context: {
        fullName: opts.fullName,
        resetUrl,
        expiresMins: opts.expiresMins,
        recipientEmail: opts.to,
        year: this.year,
      },
    });
  }

  // ─── Ride emails ──────────────────────────────────────────────────

  async sendRideConfirmed(opts: {
    to: string;
    userName: string;
    rideId: string;
    pickupAddress: string;
    dropoffAddress: string;
    distanceKm: number;
    estimatedMins: number;
    estimatedFare: number;
    paymentMethod: string;
  }): Promise<void> {
    const trackUrl = `${this.appUrl}/user/rides/${opts.rideId}`;
    await this.send({
      to: opts.to,
      subject: 'Ride booked — NduthiRide',
      template: 'ride-confirmed',
      context: {
        ...opts,
        distanceKm: opts.distanceKm.toFixed(1),
        trackUrl,
        recipientEmail: opts.to,
        year: this.year,
      },
    });
  }

  async sendRiderAccepted(opts: {
    to: string;
    userName: string;
    rideId: string;
    pickupAddress: string;
    dropoffAddress: string;
    estimatedFare: number;
    riderName: string;
    riderPhone: string;
    bikeModel: string;
    bikeRegistration: string;
    ratingAverage: number;
  }): Promise<void> {
    const trackUrl = `${this.appUrl}/user/rides/${opts.rideId}`;
    await this.send({
      to: opts.to,
      subject: `${opts.riderName} is on the way! — NduthiRide`,
      template: 'rider-accepted',
      context: {
        ...opts,
        ratingAverage: opts.ratingAverage.toFixed(1),
        trackUrl,
        recipientEmail: opts.to,
        year: this.year,
      },
    });
  }

  async sendRideCompleted(opts: {
    to: string;
    userName: string;
    rideId: string;
    pickupAddress: string;
    dropoffAddress: string;
    distanceKm: number;
    finalFare: number;
    riderName: string;
    paymentMethod: string;
    mpesaReceipt?: string;
  }): Promise<void> {
    const rateUrl = `${this.appUrl}/user/rides/${opts.rideId}`;
    await this.send({
      to: opts.to,
      subject: 'Your ride is complete — NduthiRide receipt',
      template: 'ride-completed',
      context: {
        ...opts,
        distanceKm: opts.distanceKm.toFixed(1),
        rateUrl,
        recipientEmail: opts.to,
        year: this.year,
      },
    });
  }

  // ─── Parcel emails ────────────────────────────────────────────────

  async sendParcelConfirmed(opts: {
    to: string;
    userName: string;
    parcelId: string;
    itemDescription: string;
    weightKg: number;
    pickupAddress: string;
    dropoffAddress: string;
    distanceKm: number;
    deliveryFee: number;
    recipientName: string;
    recipientPhone: string;
    paymentMethod: string;
  }): Promise<void> {
    const trackUrl = `${this.appUrl}/user/parcels/${opts.parcelId}`;
    await this.send({
      to: opts.to,
      subject: 'Parcel order placed — NduthiRide',
      template: 'parcel-confirmed',
      context: {
        ...opts,
        distanceKm: opts.distanceKm.toFixed(1),
        trackUrl,
        recipientEmail: opts.to,
        year: this.year,
      },
    });
  }

  async sendParcelDelivered(opts: {
    to: string;
    userName: string;
    parcelId: string;
    itemDescription: string;
    dropoffAddress: string;
    deliveryFee: number;
    recipientName: string;
    riderName: string;
    paymentMethod: string;
    proofImageUrl?: string;
    mpesaReceipt?: string;
  }): Promise<void> {
    const rateUrl = `${this.appUrl}/user/parcels/${opts.parcelId}`;
    await this.send({
      to: opts.to,
      subject: 'Parcel delivered! — NduthiRide',
      template: 'parcel-delivered',
      context: {
        ...opts,
        rateUrl,
        recipientEmail: opts.to,
        year: this.year,
      },
    });
  }

  // ─── Payment receipt ──────────────────────────────────────────────

  async sendPaymentReceipt(opts: {
    to: string;
    userName: string;
    amount: number;
    paymentMethod: string;
    description: string;
    mpesaReceipt?: string;
    date: string;
  }): Promise<void> {
    await this.send({
      to: opts.to,
      subject: `Payment receipt — KES ${opts.amount} — NduthiRide`,
      template: 'payment-receipt',
      context: {
        ...opts,
        recipientEmail: opts.to,
        year: this.year,
      },
    });
  }

  // ─── Admin / rider verification emails ───────────────────────────

  async sendRiderVerified(opts: {
    to: string;
    fullName: string;
    licenseNumber: string;
    bikeModel: string;
    bikeRegistration: string;
  }): Promise<void> {
    await this.send({
      to: opts.to,
      subject: 'Account approved — Welcome to NduthiRide! 🎉',
      template: 'rider-verified',
      context: {
        ...opts,
        appUrl: this.appUrl,
        recipientEmail: opts.to,
        year: this.year,
      },
    });
  }

  async sendRiderRejected(opts: {
    to: string;
    fullName: string;
    reason?: string;
  }): Promise<void> {
    await this.send({
      to: opts.to,
      subject: 'Your NduthiRide application — Update',
      template: 'rider-rejected',
      context: {
        ...opts,
        recipientEmail: opts.to,
        year: this.year,
      },
    });
  }

  // ─── Private send helper ─────────────────────────────────────────

  private async send(opts: {
    to: string;
    subject: string;
    template: string;
    context: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.mailer.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: opts.to,
        subject: opts.subject,
        template: opts.template,
        context: opts.context,
      });
      this.logger.log(`Email sent [${opts.template}] → ${opts.to}`);
    } catch (error) {
      // Log but don't throw — a failed email should not break the main flow
      this.logger.error(
        `Failed to send email [${opts.template}] → ${opts.to}`,
        error,
      );
    }
  }
}
