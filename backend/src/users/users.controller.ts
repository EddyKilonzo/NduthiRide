import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { Account } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Returns the account profile' })
  getMyProfile(@CurrentUser() user: Account) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Returns the updated profile' })
  @ApiResponse({ status: 409, description: 'Phone number already in use' })
  updateMyProfile(@CurrentUser() user: Account, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('fcm-token')
  @ApiOperation({
    summary: 'Update the authenticated user FCM token for push notifications',
  })
  @ApiResponse({ status: 200, description: 'Token updated successfully' })
  updateFcmToken(@CurrentUser() user: Account, @Body('token') token: string) {
    return this.usersService.updateFcmToken(user.id, token);
  }
}
