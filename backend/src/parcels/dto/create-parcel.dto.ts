import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreateParcelDto {
  @ApiProperty({
    example: 'iPhone 14 Pro in box',
    description: 'Brief description of the item',
  })
  @IsString()
  @IsNotEmpty()
  itemDescription: string;

  @ApiProperty({ example: 0.8, description: 'Weight in kilograms' })
  @IsNumber()
  @Min(0.1)
  @Max(50)
  weightKg: number;

  // Pickup
  @ApiProperty({ example: -1.2921 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat: number;
  @ApiProperty({ example: 36.8219 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng: number;
  @ApiProperty({ example: 'Westlands, Nairobi' })
  @IsString()
  @IsNotEmpty()
  pickupAddress: string;

  // Dropoff
  @ApiProperty({ example: -1.3031 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  dropoffLat: number;
  @ApiProperty({ example: 36.7073 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  dropoffLng: number;
  @ApiProperty({ example: 'Karen, Nairobi' })
  @IsString()
  @IsNotEmpty()
  dropoffAddress: string;

  // Recipient
  @ApiProperty({ example: 'John Kamau' })
  @IsString()
  @IsNotEmpty()
  recipientName: string;

  @ApiProperty({ example: '0712345678' })
  @IsString()
  @Matches(/^(\+254|0)(7|1)\d{8}$/, {
    message: 'Recipient phone must be a valid Kenyan number',
  })
  recipientPhone: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.MPESA })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: '0712345678' })
  @IsString()
  @IsOptional()
  mpesaPhone?: string;
}
