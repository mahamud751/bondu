import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import {
  InviteGuestDto,
  LiveBanDto,
  LiveChatDto,
  LiveChatMuteDto,
  GameGuessDto,
  GameStartDto,
  GameStrokeDto,
  MicDecideDto,
  MicRequestDto,
  PkChallengeDto,
  PkRespondDto,
  SeatControlDto,
  SeatsOpenDto,
  StartLiveDto,
  TranslateDto,
  VirtualModeDto,
} from './live.dto';
import { LiveService } from './live.service';

@ApiTags('Live streaming')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('live')
export class LiveController {
  constructor(private readonly service: LiveService) {}

  @Get()
  list(
    @Query('category') category?: string,
    @Query('mode') mode?: string,
    @Query('nearbyCountry') nearbyCountry?: string,
  ) {
    return this.service.list(category, mode, nearbyCountry);
  }

  @Post('start')
  start(@CurrentUser() user: { sub: string }, @Body() dto: StartLiveDto) {
    return this.service.start(user.sub, dto);
  }

  // Static PK paths before :id routes
  @Post('pk/:pkId/respond')
  pkRespond(
    @Param('pkId') pkId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: PkRespondDto,
  ) {
    return this.service.respondPk(pkId, user.sub, dto.decision);
  }

  @Get('pk/:pkId')
  pkGet(@Param('pkId') pkId: string) {
    return this.service.getPk(pkId);
  }

  @Get('history/pk')
  pkHistory(@CurrentUser() user: { sub: string }) {
    return this.service.pkHistory(user.sub);
  }

  @Post(':id/end')
  end(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.service.end(id, user.sub);
  }

  @Post(':id/join')
  join(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.service.join(id, user.sub);
  }

  @Post(':id/leave')
  leave(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.service.leave(id, user.sub);
  }

  @Get(':id/messages')
  messages(@Param('id') id: string) {
    return this.service.messages(id);
  }

  @Post(':id/chat')
  chat(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: LiveChatDto,
  ) {
    return this.service.chat(id, user.sub, dto.body, dto.translateTo);
  }

  @Post('translate')
  translate(@Body() dto: TranslateDto) {
    return this.service.translateText(dto.text, dto.target ?? 'bn');
  }

  @Post(':id/like')
  like(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.service.like(id, user.sub);
  }

  @Get(':id/ranking')
  ranking(@Param('id') id: string) {
    return this.service.ranking(id);
  }

  @Get(':id/seats')
  seats(@Param('id') id: string) {
    return this.service.seats(id);
  }

  @Post(':id/chat-mute')
  chatMute(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: LiveChatMuteDto,
  ) {
    return this.service.setChatMuted(id, user.sub, dto.muted);
  }

  @Post(':id/seats-open')
  seatsOpen(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: SeatsOpenDto,
  ) {
    return this.service.setSeatsOpen(id, user.sub, dto.open);
  }

  @Post(':id/ban')
  ban(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: LiveBanDto,
  ) {
    return this.service.banViewer(id, user.sub, dto.userId, dto.reason);
  }

  @Post(':id/mic/request')
  requestMic(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: MicRequestDto,
  ) {
    return this.service.requestMic(id, user.sub, dto.note);
  }

  @Post(':id/mic/cancel')
  cancelMic(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.service.cancelMic(id, user.sub);
  }

  @Get(':id/mic/requests')
  micRequests(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.service.listMicRequests(id, user.sub);
  }

  @Post(':id/mic/decide')
  decideMic(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: MicDecideDto,
  ) {
    return this.service.decideMic(
      id,
      user.sub,
      dto.requestId,
      dto.decision,
      dto.seatIndex,
    );
  }

  @Post(':id/invite')
  invite(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: InviteGuestDto,
  ) {
    return this.service.inviteGuest(id, user.sub, dto.userId, dto.seatIndex);
  }

  @Post(':id/seat/leave')
  leaveSeat(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.service.leaveSeat(id, user.sub);
  }

  @Post(':id/seat/kick')
  kick(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: SeatControlDto,
  ) {
    return this.service.kickGuest(id, user.sub, dto.userId);
  }

  @Post(':id/seat/control')
  seatControl(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: SeatControlDto,
  ) {
    return this.service.controlSeat(id, user.sub, dto.userId, {
      muted: dto.muted,
      cameraOff: dto.cameraOff,
    });
  }

  @Post(':id/pk/challenge')
  pkChallenge(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: PkChallengeDto,
  ) {
    return this.service.challengePk(
      id,
      user.sub,
      dto.opponentLiveId,
      dto.durationSeconds,
      dto.mode,
      dto.maxRounds,
    );
  }

  @Post(':id/dm')
  openDm(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.service.openHostChat(id, user.sub);
  }

  @Get(':id/coach-tip')
  coachTip(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.service.coachTip(id, user.sub);
  }

  @Post(':id/virtual-mode')
  virtualMode(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: VirtualModeDto,
  ) {
    return this.service.setVirtualMode(id, user.sub, dto.enabled, dto.avatar);
  }

  @Post(':id/game/start')
  gameStart(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: GameStartDto,
  ) {
    return this.service.startGame(id, user.sub, dto.maxRounds);
  }

  @Post(':id/game/stroke')
  gameStroke(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: GameStrokeDto,
  ) {
    return this.service.gameStroke(id, user.sub, dto.strokes);
  }

  @Post(':id/game/guess')
  gameGuess(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: GameGuessDto,
  ) {
    return this.service.gameGuess(id, user.sub, dto.guess);
  }

  @Post(':id/game/end')
  gameEnd(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.service.endGame(id, user.sub);
  }

  @Get(':id/game')
  gameGet(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.service.getGame(id, user.sub);
  }
}
