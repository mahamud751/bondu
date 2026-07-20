import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { StartLiveDto } from './live.dto';
import { LiveService } from './live.service';

@ApiTags('Live streaming')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('live')
export class LiveController {
  constructor(private readonly service: LiveService) {}
  @Get() list() { return this.service.list(); }
  @Post('start') start(@CurrentUser() user: { sub: string }, @Body() dto: StartLiveDto) { return this.service.start(user.sub, dto.title); }
  @Post(':id/end') end(@Param('id') id: string, @CurrentUser() user: { sub: string }) { return this.service.end(id, user.sub); }
  @Post(':id/join') join(@Param('id') id: string, @CurrentUser() user: { sub: string }) { return this.service.join(id, user.sub); }
  @Post(':id/leave') leave(@Param('id') id: string, @CurrentUser() user: { sub: string }) { return this.service.leave(id, user.sub); }
}
