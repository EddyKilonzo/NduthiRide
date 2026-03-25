import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'YourCurrentPass123!' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewSecurePass123!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  newPassword: string;
}
