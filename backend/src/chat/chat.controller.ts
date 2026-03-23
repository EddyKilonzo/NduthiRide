import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { Account } from '@prisma/client';

import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversation/ride/:rideId')
  @ApiOperation({
    summary: 'Get conversation for a ride (with last 30 messages)',
  })
  getConversationByRide(@Param('rideId') rideId: string) {
    return this.chatService.getConversationByRideOrParcel(rideId, undefined);
  }

  @Get('conversation/parcel/:parcelId')
  @ApiOperation({ summary: 'Get conversation for a parcel delivery' })
  getConversationByParcel(@Param('parcelId') parcelId: string) {
    return this.chatService.getConversationByRideOrParcel(undefined, parcelId);
  }

  @Get('messages')
  @ApiOperation({ summary: 'Fetch paginated message history (cursor-based)' })
  @ApiQuery({ name: 'conversationId', required: true })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Last message ID from previous page',
  })
  @ApiQuery({ name: 'limit', required: false, example: 30 })
  getMessages(
    @CurrentUser() user: Account,
    @Query('conversationId') conversationId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getMessages(user.id, conversationId, cursor, limit);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message via REST (WebSocket fallback)' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  sendMessage(
    @CurrentUser() user: Account,
    @Query('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.id, conversationId, dto);
  }

  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete own message within 5 minutes' })
  deleteMessage(
    @Param('messageId') messageId: string,
    @CurrentUser() user: Account,
  ) {
    return this.chatService.deleteMessage(messageId, user.id);
  }
}
