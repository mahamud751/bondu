import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class ChatService {
  constructor(private readonly db: PrismaService, private readonly wallets: WalletService) {}
  list(userId: string) {
    return this.db.conversation.findMany({
      where: { active: true, OR: [{ userOneId: userId }, { userTwoId: userId }] },
      include: { userOne: { select: { profile: true } }, userTwo: { select: { profile: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    });
  }
  async start(userId: string, otherId: string) {
    if (userId === otherId) throw new ConflictException('Cannot message yourself');
    const other = await this.db.user.findUnique({ where: { id: otherId }, select: { id: true, status: true } });
    if (!other || other.status !== 'ACTIVE') throw new NotFoundException('User not found');
    await this.assertNotBlocked(userId, otherId);
    const [userOneId, userTwoId] = [userId, otherId].sort();
    const vendor = await this.db.vendorProfile.findUnique({ where: { userId: otherId } });
    return this.db.conversation.upsert({ where: { userOneId_userTwoId: { userOneId, userTwoId } }, create: { userOneId, userTwoId, vendorId: vendor?.id }, update: { active: true } });
  }
  async messages(id: string, userId: string) {
    await this.assertParticipant(id, userId);
    return this.db.message.findMany({ where: { conversationId: id, deletedAt: null }, orderBy: { createdAt: 'asc' }, take: 200 });
  }
  async send(id: string, senderId: string, content: string, idempotencyKey: string) {
    return this.wallets.transaction(async tx => {
      const scopedKey = `${senderId}:${idempotencyKey}`;
      const prior = await tx.message.findUnique({ where: { idempotencyKey: scopedKey } });
      if (prior) return prior;
      const conversation = await tx.conversation.findUnique({ where: { id }, include: { userOne: true, userTwo: true } });
      if (!conversation || ![conversation.userOneId, conversation.userTwoId].includes(senderId)) throw new ForbiddenException();
      const receiverId = conversation.userOneId === senderId ? conversation.userTwoId : conversation.userOneId;
      const blocked = await tx.block.findFirst({ where: { OR: [{ blockerId: senderId, blockedUserId: receiverId }, { blockerId: receiverId, blockedUserId: senderId }] } });
      if (blocked) throw new ForbiddenException('Messaging is blocked');
      const receiverVendor = await tx.vendorProfile.findUnique({ where: { userId: receiverId } });
      const cost = receiverVendor?.status === 'APPROVED' ? receiverVendor.paidChatRate : 0;
      const chatPackage = cost > 0 ? await tx.userPackage.findFirst({ where: { userId: senderId, active: true, expiresAt: { gt: new Date() }, remainingMessages: { gt: 0 } }, orderBy: { expiresAt: 'asc' } }) : null;
      const vendorAmount = receiverVendor ? Math.floor(cost * receiverVendor.commissionPercent / 100) : 0;
      if (chatPackage) await tx.userPackage.update({ where: { id: chatPackage.id }, data: { remainingMessages: { decrement: 1 } } });
      else if (cost > 0) await this.wallets.debitPurchased(tx, { userId: senderId, type: 'CHAT_CHARGE', direction: 'DEBIT', amount: cost, referenceType: 'MESSAGE', referenceId: scopedKey, description: 'Paid chat message', idempotencyKey: `message:${scopedKey}:charge` });
      const message = await tx.message.create({ data: { conversationId: id, senderId, receiverId, content: content.trim(), idempotencyKey: scopedKey, pointCost: cost, vendorAmount, platformAmount: cost - vendorAmount } });
      if (vendorAmount > 0) {
        await this.wallets.creditPendingEarning(tx, receiverId, vendorAmount, message.id, 'CHAT');
        await tx.earning.create({ data: { vendorId: receiverVendor!.id, sourceType: 'CHAT', sourceId: message.id, grossAmount: cost, vendorAmount, platformAmount: cost - vendorAmount, availableAt: new Date(Date.now() + 7 * 86400000) } });
      }
      await tx.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } });
      await tx.notification.create({ data: { userId: receiverId, type: 'MESSAGE', title: 'New message', body: content.trim().slice(0, 120), data: { conversationId: id, messageId: message.id } } });
      return message;
    });
  }
  async read(id: string, userId: string) {
    await this.assertParticipant(id, userId);
    return this.db.message.updateMany({ where: { conversationId: id, receiverId: userId, readAt: null }, data: { readAt: new Date(), status: 'READ' } });
  }
  private async assertParticipant(id: string, userId: string) {
    const conversation = await this.db.conversation.findUnique({ where: { id } });
    if (!conversation || ![conversation.userOneId, conversation.userTwoId].includes(userId)) throw new ForbiddenException();
    return conversation;
  }
  private async assertNotBlocked(one: string, two: string) {
    const blocked = await this.db.block.findFirst({ where: { OR: [{ blockerId: one, blockedUserId: two }, { blockerId: two, blockedUserId: one }] } });
    if (blocked) throw new ForbiddenException('Messaging is blocked');
  }
}
