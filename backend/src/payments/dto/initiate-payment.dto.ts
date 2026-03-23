import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class InitiatePaymentDto {
  /** Either rideId or parcelId must be provided */
  @ApiPropertyOptional({
    example: 'clx123abc',
    description: 'Ride ID to pay for',
  })
  @IsString()
  @IsOptional()
  rideId?: string;

  @ApiPropertyOptional({
    example: 'clx456def',
    description: 'Parcel ID to pay for',
  })
  @IsString()
  @IsOptional()
  parcelId?: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({
    example: '0712345678',
    description:
      'M-Pesa phone (required for MPESA). Format: 07XX, +2547XX, or 2547XX',
  })
  @IsString()
  @IsOptional()
  mpesaPhone?: string;
}
