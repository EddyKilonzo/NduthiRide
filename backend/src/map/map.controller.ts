import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { MapService } from './map.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class GeocodeQueryDto {
  @ApiProperty({ example: 'Westlands Nairobi' })
  @IsString()
  q: string;
}

class DirectionsQueryDto {
  @ApiProperty({ example: -1.2921 })
  @IsNumber()
  @Type(() => Number)
  originLat: number;
  @ApiProperty({ example: 36.8219 })
  @IsNumber()
  @Type(() => Number)
  originLng: number;
  @ApiProperty({ example: -1.3031 })
  @IsNumber()
  @Type(() => Number)
  destLat: number;
  @ApiProperty({ example: 36.7073 })
  @IsNumber()
  @Type(() => Number)
  destLng: number;
}

class ReverseGeocodeQueryDto {
  @ApiProperty({ example: -1.2921 })
  @IsNumber()
  @Type(() => Number)
  lat: number;
  @ApiProperty({ example: 36.8219 })
  @IsNumber()
  @Type(() => Number)
  lng: number;
}

@ApiTags('Map')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('geocode')
  @ApiOperation({ summary: 'Forward geocode an address to coordinates' })
  geocode(@Query() query: GeocodeQueryDto) {
    return this.mapService.geocode(query.q);
  }

  @Get('reverse-geocode')
  @ApiOperation({ summary: 'Reverse geocode coordinates to an address' })
  async reverseGeocode(@Query() query: ReverseGeocodeQueryDto) {
    const address = await this.mapService.reverseGeocode(query.lat, query.lng);
    return {
      full_address: address,
      lat: query.lat,
      lng: query.lng,
    };
  }

  @Get('directions')
  @ApiOperation({
    summary: 'Get route between two points (distance, duration, geometry)',
  })
  getDirections(@Query() query: DirectionsQueryDto) {
    return this.mapService.getDirections(
      { lat: query.originLat, lng: query.originLng },
      { lat: query.destLat, lng: query.destLng },
    );
  }

  @Get('eta')
  @ApiOperation({
    summary: 'Get ETA in minutes from rider position to destination',
  })
  getETA(@Query() query: DirectionsQueryDto) {
    return this.mapService.getETA(
      { lat: query.originLat, lng: query.originLng },
      { lat: query.destLat, lng: query.destLng },
    );
  }
}
