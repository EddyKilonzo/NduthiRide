import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RideStatus } from '@prisma/client';

export class RideQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  @Type(() => Number)
  limit: number = 10;

  @ApiPropertyOptional({ enum: RideStatus })
  @IsEnum(RideStatus)
  @IsOptional()
  status?: RideStatus;
}
