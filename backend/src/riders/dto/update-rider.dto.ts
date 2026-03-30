import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateRiderAvailabilityDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Whether the rider is accepting requests',
  })
  @IsBoolean()
  isAvailable: boolean;
}

export class UpdateRiderLocationDto {
  @ApiPropertyOptional({ example: -1.2921, description: 'Latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiPropertyOptional({ example: 36.8219, description: 'Longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiPropertyOptional({
    example: 45.5,
    description: 'Speed in km/h (optional)',
  })
  @IsNumber()
  @IsOptional()
  speed?: number;
}

export class UpdateRiderProfileDto {
  @ApiPropertyOptional({ example: 'Honda CB125F' })
  @IsString()
  @IsOptional()
  bikeModel?: string;

  @ApiPropertyOptional({ example: 'KBX 123A' })
  @IsString()
  @IsOptional()
  bikeRegistration?: string;

  @ApiPropertyOptional({ example: 'DL123456' })
  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @ApiPropertyOptional({ description: 'Cloudinary URL of the profile photo' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Cloudinary URL of the license image' })
  @IsString()
  @IsOptional()
  licenseImageUrl?: string;

  @ApiPropertyOptional({ description: 'Cloudinary URL of the ID front image' })
  @IsString()
  @IsOptional()
  idFrontImageUrl?: string;

  @ApiPropertyOptional({ description: 'Cloudinary URL of the ID back image' })
  @IsString()
  @IsOptional()
  idBackImageUrl?: string;

  @ApiPropertyOptional({ description: 'Cloudinary URL of the logbook image' })
  @IsString()
  @IsOptional()
  logbookImageUrl?: string;
}
