import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Role, RideStatus, ParcelStatus, PaymentStatus } from '@prisma/client';

/** Reusable pagination + search query used across most admin list endpoints */
export class PaginationDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number (starts at 1)' })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Results per page (max 100)',
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit: number = 20;

  @ApiPropertyOptional({
    example: 'jane',
    description: 'Search by name or phone',
  })
  @IsString()
  @IsOptional()
  search?: string;
}

export class ListAccountsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: Role })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ description: 'Filter by active/inactive status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    // Query params arrive as strings (e.g. "false"), so convert explicitly.
    if (value === true || value === false) return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return value;
  })
  isActive?: boolean;
}

export class ListRidesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RideStatus })
  @IsEnum(RideStatus)
  @IsOptional()
  status?: RideStatus;
}

export class ListParcelsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ParcelStatus })
  @IsEnum(ParcelStatus)
  @IsOptional()
  status?: ParcelStatus;
}

export class ListPaymentsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: ['MPESA', 'CASH'] })
  @IsEnum(['MPESA', 'CASH'])
  @IsOptional()
  method?: 'MPESA' | 'CASH';
}
