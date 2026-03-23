import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { MessageType } from '@prisma/client';

export class LocationPinDto {
  @IsNumber() lat: number;
  @IsNumber() lng: number;
  @IsString() @IsNotEmpty() address: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'On my way!' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  @ApiPropertyOptional({ enum: MessageType, default: MessageType.TEXT })
  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @ApiPropertyOptional({ description: 'Required when type = LOCATION' })
  @ValidateIf((o: SendMessageDto) => o.type === MessageType.LOCATION)
  @IsOptional()
  locationPin?: LocationPinDto;
}
