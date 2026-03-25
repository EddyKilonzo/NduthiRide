import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane Wanjiru' })
  @IsString()
  @IsOptional()
  @MinLength(1, { message: 'Full name cannot be empty' })
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ example: '0712345678' })
  @IsString()
  @IsOptional()
  @Matches(/^(\+254|0)(7|1)\d{8}$/, {
    message: 'Phone must be a valid Kenyan number',
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description:
      'HTTPS image URL, or a data URL (e.g. JPEG/PNG) for a profile photo. Send null to remove.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(750_000)
  avatarUrl?: string | null;
}
