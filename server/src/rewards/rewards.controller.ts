import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { RewardsService } from './rewards.service';

@ApiTags('Rewards')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('rewards')
export class RewardsController {
  constructor(private readonly service: RewardsService) {}
  @Get('daily') status(@CurrentUser() user: { sub: string }) { return this.service.dailyStatus(user.sub); }
  @Post('daily/claim') claim(@CurrentUser() user: { sub: string }) { return this.service.claimDaily(user.sub); }
}
