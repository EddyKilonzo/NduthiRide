import { IsNumber, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EstimateRideDto {
  @ApiProperty({ example: -1.2921 })
  @IsNumber()
  @IsNotEmpty()
  pickupLat: number;

  @ApiProperty({ example: 36.8219 })
  @IsNumber()
  @IsNotEmpty()
  pickupLng: number;

  @ApiProperty({ example: -1.3031 })
  @IsNumber()
  @IsNotEmpty()
  dropoffLat: number;

  @ApiProperty({ example: 36.7073 })
  @IsNumber()
  @IsNotEmpty()
  dropoffLng: number;
}
