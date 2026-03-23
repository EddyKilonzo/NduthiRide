import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RateRideDto {
  @ApiProperty({ example: 5, description: 'Rating score from 1 to 5' })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @ApiProperty({ example: 'Great ride, very safe!', required: false })
  @IsString()
  @IsOptional()
  comment?: string;
}
