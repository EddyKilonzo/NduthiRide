import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreateRideDto {
  @ApiProperty({ example: -1.2921, description: 'Pickup latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat: number;

  @ApiProperty({ example: 36.8219, description: 'Pickup longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng: number;

  @ApiProperty({ example: 'Westlands, Nairobi' })
  @IsString()
  @IsNotEmpty()
  pickupAddress: string;

  @ApiProperty({ example: -1.3031, description: 'Dropoff latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  dropoffLat: number;

  @ApiProperty({ example: 36.7073, description: 'Dropoff longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  dropoffLng: number;

  @ApiProperty({ example: 'Karen, Nairobi' })
  @IsString()
  @IsNotEmpty()
  dropoffAddress: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.MPESA })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    example: '0712345678',
    description: 'M-Pesa phone (defaults to account phone)',
  })
  @IsString()
  @IsOptional()
  mpesaPhone?: string;
}
