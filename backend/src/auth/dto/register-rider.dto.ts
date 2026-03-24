import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterRiderDto {
  @ApiProperty({
    example: 'James Mwangi',
    description: 'Full name of the rider',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    example: '0712345678',
    description: 'Phone number (used to log in)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+254|0)(7|1)\d{8}$/, {
    message:
      'Phone must be a valid Kenyan number (e.g. 0712345678 or +254712345678)',
  })
  phone: string;

  @ApiPropertyOptional({ example: 'james@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  // Rider-specific fields (Optional during initial registration)

  @ApiPropertyOptional({
    example: 'DL12345',
    description: "Rider's driving licence number",
  })
  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @ApiPropertyOptional({
    example: 'KDA 123A',
    description: 'Motorcycle registration plate',
  })
  @IsString()
  @IsOptional()
  bikeRegistration?: string;

  @ApiPropertyOptional({
    example: 'Honda CB125F',
    description: 'Bike make and model',
  })
  @IsString()
  @IsOptional()
  bikeModel?: string;
}
