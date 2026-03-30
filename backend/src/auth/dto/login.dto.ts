import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'jane@example.com or 0712345678',
    description: 'Registered email or phone number',
  })
  @IsString()
  @ValidateIf((o: LoginDto) => !o.email)
  @IsNotEmpty()
  credential: string;

  @ApiPropertyOptional({
    example: 'jane@example.com',
    description: 'Deprecated alias for credential (kept for backward compatibility)',
  })
  @IsString()
  @ValidateIf((o: LoginDto) => !o.credential)
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
