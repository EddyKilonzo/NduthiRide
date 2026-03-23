import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'The token received in the password-reset email',
  })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewSecurePass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
