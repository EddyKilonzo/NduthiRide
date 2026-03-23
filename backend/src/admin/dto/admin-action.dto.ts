import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/** Suspend or reactivate an account */
export class SetAccountStatusDto {
  @ApiProperty({
    example: false,
    description: 'Set to false to suspend, true to reactivate',
  })
  @IsBoolean()
  isActive: boolean;

  @ApiPropertyOptional({ example: 'Fraudulent activity reported' })
  @IsString()
  @IsOptional()
  reason?: string;
}

/** Approve or reject a rider's verification */
export class SetRiderVerificationDto {
  @ApiProperty({
    example: true,
    description: 'Set to true to verify, false to reject',
  })
  @IsBoolean()
  isVerified: boolean;

  @ApiPropertyOptional({ example: 'Documents verified by ops team' })
  @IsString()
  @IsOptional()
  notes?: string;
}
