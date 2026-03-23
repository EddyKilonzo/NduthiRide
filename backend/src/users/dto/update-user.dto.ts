import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane Wanjiru' })
  @IsString()
  @IsOptional()
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

  @ApiPropertyOptional({ description: 'Cloudinary URL of the profile photo' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
