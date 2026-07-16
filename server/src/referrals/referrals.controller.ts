import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { ReferralsService } from './referrals.service';
class ApplyReferralDto { @IsString() @MinLength(4) @MaxLength(30) code!: string; }
@ApiTags('Referrals') @ApiBearerAuth() @UseGuards(JwtGuard) @Controller('referrals')
export class ReferralsController { constructor(private readonly referrals: ReferralsService) {} @Get('code') code(@CurrentUser() user: { sub: string }) { return this.referrals.code(user.sub); } @Post('apply') apply(@CurrentUser() user: { sub: string }, @Body() dto: ApplyReferralDto) { return this.referrals.apply(user.sub, dto.code); } @Get('summary') summary(@CurrentUser() user: { sub: string }) { return this.referrals.summary(user.sub); } }
