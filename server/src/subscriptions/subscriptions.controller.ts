import { Body, ConflictException, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
class SubscribeDto { @IsString() @MaxLength(100) idempotencyKey!: string; }
@ApiTags('Memberships') @Controller('memberships')
export class SubscriptionsController {
  constructor(private readonly db: PrismaService, private readonly wallets: WalletService) {}
  @Get() plans() { return this.db.membershipPlan.findMany({ where: { active: true }, orderBy: { displayOrder: 'asc' } }); }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Get('mine') mine(@CurrentUser() user: { sub: string }) { return this.db.userSubscription.findMany({ where: { userId: user.sub }, include: { plan: true }, orderBy: { createdAt: 'desc' } }); }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Post(':id/subscribe') subscribe(@Param('id') id: string, @CurrentUser() user: { sub: string }, @Body() dto: SubscribeDto) {
    return this.wallets.transaction(async tx => {
      const key = `membership:${user.sub}:${dto.idempotencyKey}`, prior = await tx.walletLedger.findUnique({ where: { idempotencyKey: key } });
      if (prior) return tx.userSubscription.findUnique({ where: { id: prior.referenceId }, include: { plan: true } });
      const plan = await tx.membershipPlan.findFirst({ where: { id, active: true } }); if (!plan) throw new ConflictException('Membership is unavailable');
      await tx.userSubscription.updateMany({ where: { userId: user.sub, status: 'ACTIVE', expiresAt: { gt: new Date() } }, data: { status: 'REPLACED' } });
      const subscription = await tx.userSubscription.create({ data: { userId: user.sub, planId: plan.id, expiresAt: new Date(Date.now() + plan.durationDays * 86400000) } });
      await this.wallets.debitPurchased(tx, { userId: user.sub, type: 'PACKAGE_PURCHASE', direction: 'DEBIT', amount: plan.price, referenceType: 'MEMBERSHIP', referenceId: subscription.id, description: `Subscribed to ${plan.name}`, idempotencyKey: key });
      const benefits = plan.benefits as { bonusPoints?: number }; if ((benefits.bonusPoints ?? 0) > 0) await this.wallets.creditPromotional(tx, { userId: user.sub, type: 'PROMOTIONAL_BONUS', direction: 'CREDIT', amount: benefits.bonusPoints!, referenceType: 'MEMBERSHIP', referenceId: subscription.id, description: `${plan.name} membership bonus`, idempotencyKey: `${key}:bonus` });
      return { ...subscription, plan };
    });
  }
}
