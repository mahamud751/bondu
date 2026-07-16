import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { PurchaseGiftCardDto } from "./gift-cards.dto";
@Injectable()
export class GiftCardsService {
  constructor(
    private readonly db: PrismaService,
    private readonly wallets: WalletService,
  ) {}
  list() {
    return this.db.giftCard.findMany({
      where: { active: true },
      orderBy: { price: "asc" },
    });
  }
  detail(id: string) {
    return this.db.giftCard.findFirst({ where: { id, active: true } });
  }
  mine(userId: string) {
    return this.db.userGiftCard.findMany({
      where: { recipientId: userId },
      include: { giftCard: true },
      orderBy: { createdAt: "desc" },
    });
  }
  async purchase(userId: string, id: string, d: PurchaseGiftCardDto) {
    return this.wallets.transaction(async (tx) => {
      const key = `gift-card:${userId}:${d.idempotencyKey}`,
        prior = await tx.walletLedger.findUnique({
          where: { idempotencyKey: key },
        });
      if (prior)
        return tx.userGiftCard.findUnique({
          where: { id: prior.referenceId },
          include: { giftCard: true },
        });
      const card = await tx.giftCard.findUnique({ where: { id } });
      if (!card || !card.active)
        throw new NotFoundException("Gift card not found");
      if (!card.transferable && d.recipientId !== userId)
        throw new ForbiddenException("This gift card is not transferable");
      if (card.vendorSpecific && !d.vendorId)
        throw new ConflictException("Select a vendor for this gift card");
      if (d.vendorId) {
        const vendor = await tx.vendorProfile.findUnique({
          where: { id: d.vendorId },
        });
        if (!vendor || vendor.status !== "APPROVED")
          throw new NotFoundException("Vendor not found");
      }
      const recipient = await tx.user.findUnique({
        where: { id: d.recipientId },
      });
      if (!recipient || recipient.status !== "ACTIVE")
        throw new NotFoundException("Recipient not found");
      const owned = await tx.userGiftCard.create({
        data: {
          giftCardId: id,
          purchaserId: userId,
          recipientId: d.recipientId,
          vendorId: d.vendorId,
          remainingVoiceSeconds: card.voiceSeconds,
          remainingVideoSeconds: card.videoSeconds,
          remainingMessages: card.messageCount,
          expiresAt: new Date(Date.now() + card.validityDays * 86400000),
        },
      });
      await this.wallets.debitPurchased(tx, {
        userId,
        type: "GIFT_PURCHASE",
        direction: "DEBIT",
        amount: card.price,
        referenceType: "USER_GIFT_CARD",
        referenceId: owned.id,
        description: `Purchased ${card.name}`,
        idempotencyKey: key,
      });
      await tx.notification.create({
        data: {
          userId: d.recipientId,
          type: "GIFT_CARD",
          title: "Gift card received",
          body: `You received ${card.name}.`,
          data: { userGiftCardId: owned.id },
        },
      });
      return owned;
    });
  }
  async activate(userId: string, id: string) {
    const card = await this.db.userGiftCard.findUnique({ where: { id } });
    if (!card || card.recipientId !== userId) throw new ForbiddenException();
    if (
      !["ACTIVE", "PARTIALLY_USED"].includes(card.status) ||
      card.expiresAt <= new Date()
    )
      throw new ConflictException("Gift card is unavailable");
    return this.db.userGiftCard.update({
      where: { id },
      data: { activatedAt: card.activatedAt ?? new Date() },
    });
  }
}
