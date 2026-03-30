import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ParcelStatus } from '@prisma/client';

export class ParcelQueryDto {
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

  @ApiPropertyOptional({ enum: ParcelStatus })
  @IsEnum(ParcelStatus)
  @IsOptional()
  status?: ParcelStatus;

  @ApiPropertyOptional({ example: -1.2921 })
  @IsOptional()
  @Type(() => Number)
  lat?: number;

  @ApiPropertyOptional({ example: 36.8219 })
  @IsOptional()
  @Type(() => Number)
  lng?: number;

  @ApiPropertyOptional({ example: 5, description: 'Radius in km' })
  @IsOptional()
  @Type(() => Number)
  radiusKm?: number;
}
