import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FraudService {
  constructor(private readonly db: PrismaService) {}
  async assessWithdrawal(userId: string, amount: number) {
    const [user, sessions, failedPayments, recentWithdrawals, vendor] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: userId } }),
      this.db.deviceSession.findMany({ where: { userId, revokedAt: null }, select: { deviceId: true } }),
      this.db.payment.count({ where: { userId, status: 'REJECTED', createdAt: { gt: new Date(Date.now() - 30 * 86400000) } } }),
      this.db.withdrawal.aggregate({ where: { userId, createdAt: { gt: new Date(Date.now() - 86400000) }, status: { notIn: ['REJECTED', 'CANCELLED', 'FAILED'] } }, _sum: { amount: true }, _count: true }),
      this.db.vendorProfile.findUnique({ where: { userId } }),
    ]);
    let score = 0; const reasons: string[] = [];
    if (!vendor || vendor.status !== 'APPROVED') { score += 100; reasons.push('VENDOR_NOT_APPROVED'); }
    if (Date.now() - user.createdAt.getTime() < 7 * 86400000) { score += 25; reasons.push('NEW_ACCOUNT'); }
    if (failedPayments >= 3) { score += 25; reasons.push('REPEATED_FAILED_PAYMENTS'); }
    if (recentWithdrawals._count >= 3 || (recentWithdrawals._sum.amount ?? 0) + amount > 50_000) { score += 40; reasons.push('DAILY_WITHDRAWAL_VELOCITY'); }
    if (sessions.length) { const linked = await this.db.deviceSession.groupBy({ by: ['deviceId'], where: { deviceId: { in: sessions.map(item => item.deviceId) }, userId: { not: userId } }, _count: { userId: true } }); if (linked.length) { score += 35; reasons.push('SHARED_DEVICE_WITH_OTHER_ACCOUNTS'); } }
    const action = score >= 75 ? 'RESTRICT_WITHDRAWAL' : score >= 40 ? 'MANUAL_REVIEW' : score >= 20 ? 'MONITOR' : 'ALLOW';
    const assessment = await this.db.fraudAssessment.create({ data: { userId, context: 'WITHDRAWAL', score, reasons, action, metadata: { amount } } });
    if (action === 'RESTRICT_WITHDRAWAL') throw new ForbiddenException(`Withdrawal requires review (${assessment.id})`);
    return assessment;
  }
}
