import { IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class EstimateParcelDto {
  @ApiProperty({ example: -1.2921 })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  pickupLat: number;

  @ApiProperty({ example: 36.8219 })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  pickupLng: number;

  @ApiProperty({ example: -1.3031 })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  dropoffLat: number;

  @ApiProperty({ example: 36.7073 })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  dropoffLng: number;

  @ApiProperty({ example: 1.5 })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  weightKg: number;
}
