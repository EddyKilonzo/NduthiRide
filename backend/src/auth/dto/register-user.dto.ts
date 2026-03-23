import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterUserDto {
  @ApiProperty({
    example: 'Jane Wanjiru',
    description: 'Full name of the user',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  /**
   * Kenyan phone format: starts with 07, 01, or +254
   * This is the primary login identifier.
   */
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

  @ApiPropertyOptional({ example: 'jane@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: 'StrongPass123!',
    description: 'Minimum 8 characters',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
