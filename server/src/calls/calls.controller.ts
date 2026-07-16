import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CallParticipantEventDto, EndCallDto, HeartbeatDto, RequestCallDto } from './calls.dto';
import { CallsService } from './calls.service';

@ApiTags('Voice and video calls')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('calls')
export class CallsController {
  constructor(private readonly service:CallsService){}
  @Post('request')request(@CurrentUser()user:{sub:string},@Body()dto:RequestCallDto){return this.service.request(user.sub,dto)}
  @Post(':id/accept')accept(@Param('id')id:string,@CurrentUser()user:{sub:string}){return this.service.accept(id,user.sub)}
  @Post(':id/reject')reject(@Param('id')id:string,@CurrentUser()user:{sub:string}){return this.service.reject(id,user.sub)}
  @Post(':id/cancel')cancel(@Param('id')id:string,@CurrentUser()user:{sub:string}){return this.service.cancel(id,user.sub)}
  @Post(':id/join-token')token(@Param('id')id:string,@CurrentUser()user:{sub:string}){return this.service.joinToken(id,user.sub)}
  @Post(':id/connected')connected(@Param('id')id:string,@CurrentUser()user:{sub:string}){return this.service.connected(id,user.sub)}
  @Post(':id/heartbeat')heartbeat(@Param('id')id:string,@CurrentUser()user:{sub:string},@Body()dto:HeartbeatDto){return this.service.heartbeat(id,user.sub,dto.connectedSeconds)}
  @Post(':id/events')event(@Param('id')id:string,@CurrentUser()user:{sub:string},@Body()dto:CallParticipantEventDto){return this.service.participantEvent(id,user.sub,dto.eventType,dto.metadata)}
  @Post(':id/end')end(@Param('id')id:string,@CurrentUser()user:{sub:string},@Body()dto:EndCallDto){return this.service.end(id,user.sub,dto.connectedSeconds)}
  @Get('history')history(@CurrentUser()user:{sub:string}){return this.service.history(user.sub)}
  @Get(':id')detail(@Param('id')id:string,@CurrentUser()user:{sub:string}){return this.service.detail(id,user.sub)}
}
