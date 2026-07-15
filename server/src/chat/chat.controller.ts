import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { ChatService } from './chat.service';
import { SendMessageDto, StartConversationDto } from './chat.dto';

@ApiTags('Chat') @ApiBearerAuth() @UseGuards(JwtGuard) @Controller('chat')
export class ChatController {
  constructor(private readonly service: ChatService) {}
  @Get('conversations') list(@CurrentUser() user: { sub: string }) { return this.service.list(user.sub); }
  @Post('conversations') start(@CurrentUser() user: { sub: string }, @Body() dto: StartConversationDto) { return this.service.start(user.sub, dto.userId); }
  @Get('conversations/:id/messages') messages(@Param('id') id: string, @CurrentUser() user: { sub: string }) { return this.service.messages(id, user.sub); }
  @Post('conversations/:id/messages') send(@Param('id') id: string, @CurrentUser() user: { sub: string }, @Body() dto: SendMessageDto) { return this.service.send(id, user.sub, dto.content, dto.idempotencyKey); }
  @Patch('conversations/:id/read') read(@Param('id') id: string, @CurrentUser() user: { sub: string }) { return this.service.read(id, user.sub); }
}
