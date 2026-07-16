import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;
@Injectable()
export class ModerationService {
  constructor(private readonly db: PrismaService) {}
  async assertMessageAllowed(tx: Tx, userId: string, content: string) {
    const normalized = content.toLowerCase();
    const rules = [
      { category: 'PHONE_NUMBER', regex: /(?:\+?88)?01[3-9]\d{8}/i, message: 'Phone numbers cannot be shared in chat' },
      { category: 'EMAIL', regex: /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i, message: 'Email addresses cannot be shared in chat' },
      { category: 'EXTERNAL_PAYMENT', regex: /(?:send\s*money|pay\s*(?:me|outside)|bkash|nagad|paypal|wise).{0,30}(?:number|account|outside|direct)/i, message: 'Requests for payment outside SocialConnect are prohibited' },
      { category: 'SUSPICIOUS_LINK', regex: /https?:\/\/|(?:wa\.me|t\.me|imo\.im)\//i, message: 'External links cannot be shared in chat' },
    ];
    const blockedTerms = await tx.blockedTerm.findMany({ where: { active: true }, select: { term: true, category: true, severity: true } });
    const match = rules.find(rule => rule.regex.test(content));
    const term = blockedTerms.find(item => normalized.includes(item.term.toLowerCase()));
    if (!match && !term) return;
    const category = match?.category ?? term!.category;
    await tx.moderationEvent.create({ data: { userId, entityType: 'MESSAGE_ATTEMPT', category, severity: term?.severity ?? 'BLOCK', matchedText: term?.term, action: 'BLOCKED', metadata: { contentLength: content.length } } });
    throw new ForbiddenException(match?.message ?? 'This message violates community safety rules');
  }
}
