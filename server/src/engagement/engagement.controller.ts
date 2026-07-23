import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { EngagementService } from './engagement.service';

class CreateClubDto {
  @IsOptional() @IsString() @MaxLength(40) name?: string;
}

class ClaimTaskDto {
  @IsString() code!: string;
}

class BeautyDto {
  @IsOptional() @IsInt() @Min(0) @Max(100) smooth?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) whiten?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) slim?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) bigEye?: number;
  @IsOptional() @IsString() @MaxLength(40) filterId?: string;
}

class LocaleDto {
  @IsIn(['en', 'bn']) locale!: 'en' | 'bn';
}

@ApiTags('Engagement')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller()
export class EngagementController {
  constructor(private readonly service: EngagementService) {}

  @Get('levels/me')
  myLevels(@CurrentUser() user: { sub: string }) {
    return this.service.getLevels(user.sub);
  }

  @Get('tasks')
  tasks(@CurrentUser() user: { sub: string }) {
    return this.service.listTasks(user.sub);
  }

  @Post('tasks/claim')
  claimTask(@CurrentUser() user: { sub: string }, @Body() dto: ClaimTaskDto) {
    return this.service.claimTask(user.sub, dto.code);
  }

  @Get('leaderboards')
  leaderboards(
    @Query('scope') scope?: 'wealth' | 'charm' | 'host' | 'gifts',
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : 20;
    return this.service.leaderboards(scope ?? 'wealth', Number.isFinite(n) ? n : 20);
  }

  @Get('events')
  events() {
    return this.service.activeEvents();
  }

  @Get('fan-clubs/:ownerId')
  fanClub(
    @Param('ownerId') ownerId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.service.fanClubForOwner(ownerId, user.sub);
  }

  @Post('fan-clubs/mine')
  createMine(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateClubDto,
  ) {
    return this.service.getOrCreateFanClub(user.sub, dto.name);
  }

  @Post('fan-clubs/:ownerId/join')
  join(
    @Param('ownerId') ownerId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.service.joinFanClub(ownerId, user.sub);
  }

  @Get('super-fans/:hostId')
  superFan(
    @Param('hostId') hostId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.service.superFanStatus(hostId, user.sub);
  }

  @Post('super-fans/:hostId/join')
  joinSuper(
    @Param('hostId') hostId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.service.joinSuperFan(hostId, user.sub);
  }

  @Get('beauty/me')
  beauty(@CurrentUser() user: { sub: string }) {
    return this.service.getBeauty(user.sub);
  }

  @Post('beauty/me')
  saveBeauty(@CurrentUser() user: { sub: string }, @Body() dto: BeautyDto) {
    return this.service.saveBeauty(user.sub, dto);
  }

  @Get('coach-tip')
  coach(
    @CurrentUser() user: { sub: string },
    @Query('viewers') viewers?: string,
    @Query('locale') locale?: string,
  ) {
    const n = viewers ? Number(viewers) : 0;
    return this.service.coachTip(
      Number.isFinite(n) ? n : 0,
      locale === 'bn' ? 'bn' : 'en',
    );
  }

  @Get('locale/me')
  getLocale(@CurrentUser() user: { sub: string }) {
    return this.service.getLocale(user.sub);
  }

  @Post('locale/me')
  setLocale(@CurrentUser() user: { sub: string }, @Body() dto: LocaleDto) {
    return this.service.setLocale(user.sub, dto.locale);
  }
}
