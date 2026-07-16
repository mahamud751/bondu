import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RestrictionType } from "@prisma/client";
import { RestrictionsService } from "../restrictions/restrictions.service";
import { WalletService } from "../wallet/wallet.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { ModerationService } from "../moderation/moderation.service";
import { SendMessageDto } from "./chat.dto";

@Injectable()
export class ChatService {
  constructor(
    private readonly db: PrismaService,
    private readonly wallets: WalletService,
    private readonly realtime: RealtimeGateway,
    private readonly moderation: ModerationService,
    private readonly restrictions: RestrictionsService,
  ) {}
  list(userId: string) {
    return this.db.conversation.findMany({
      where: {
        active: true,
        OR: [{ userOneId: userId }, { userTwoId: userId }],
      },
      include: {
        userOne: { select: { profile: true } },
        userTwo: { select: { profile: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
    });
  }
  async start(userId: string, otherId: string) {
    if (userId === otherId)
      throw new ConflictException("Cannot message yourself");
    const other = await this.db.user.findUnique({
      where: { id: otherId },
      select: {
        id: true,
        status: true,
        profile: { select: { messagesFromEveryone: true } },
      },
    });
    if (!other || other.status !== "ACTIVE")
      throw new NotFoundException("User not found");
    await this.assertNotBlocked(userId, otherId);
    if (other.profile?.messagesFromEveryone === false) {
      const connection = await this.db.connection.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { requesterId: userId, recipientId: otherId },
            { requesterId: otherId, recipientId: userId },
          ],
        },
        select: { id: true },
      });
      if (!connection)
        throw new ForbiddenException(
          "This user accepts messages from connections only",
        );
    }
    const [userOneId, userTwoId] = [userId, otherId].sort();
    const vendor = await this.db.vendorProfile.findUnique({
      where: { userId: otherId },
    });
    return this.db.conversation.upsert({
      where: { userOneId_userTwoId: { userOneId, userTwoId } },
      create: { userOneId, userTwoId, vendorId: vendor?.id },
      update: { active: true },
    });
  }
  async messages(id: string, userId: string) {
    await this.assertParticipant(id, userId);
    const messages = await this.db.message.findMany({
      where: {
        conversationId: id,
        deletedAt: null,
        hiddenFor: { none: { userId } },
      },
      include: { reactions: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    const replyIds = [
      ...new Set(
        messages
          .map((item) => item.replyToId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const replies = replyIds.length
      ? await this.db.message.findMany({
          where: { id: { in: replyIds } },
          select: {
            id: true,
            senderId: true,
            content: true,
            type: true,
            deletedAt: true,
          },
        })
      : [];
    const byId = new Map(replies.map((item) => [item.id, item]));
    return messages.map((message) => ({
      ...message,
      replyTo: message.replyToId
        ? (byId.get(message.replyToId) ?? {
            id: message.replyToId,
            deletedAt: new Date(),
          })
        : null,
    }));
  }
  async detail(id:string,userId:string){await this.assertParticipant(id,userId);return this.db.conversation.findUniqueOrThrow({where:{id},include:{userOne:{select:{id:true,profile:{select:{displayName:true,avatarUrl:true}}}},userTwo:{select:{id:true,profile:{select:{displayName:true,avatarUrl:true}}}}}})}
  async send(
    id: string,
    senderId: string,
    input: SendMessageDto,
    idempotencyKey: string,
  ) {
    await this.restrictions.assertAllowed(senderId, RestrictionType.CHAT);
    return this.wallets.transaction(async (tx) => {
      const scopedKey = `${senderId}:${idempotencyKey}`;
      const prior = await tx.message.findUnique({
        where: { idempotencyKey: scopedKey },
      });
      if (prior) return prior;
      const conversation = await tx.conversation.findUnique({
        where: { id },
        include: { userOne: true, userTwo: true },
      });
      if (
        !conversation ||
        ![conversation.userOneId, conversation.userTwoId].includes(senderId)
      )
        throw new ForbiddenException();
      const receiverId =
        conversation.userOneId === senderId
          ? conversation.userTwoId
          : conversation.userOneId;
      const blocked = await tx.block.findFirst({
        where: {
          OR: [
            { blockerId: senderId, blockedUserId: receiverId },
            { blockerId: receiverId, blockedUserId: senderId },
          ],
        },
      });
      if (blocked) throw new ForbiddenException("Messaging is blocked");
      const content = input.content?.trim();
      if (!content && !input.attachmentId)
        throw new ConflictException(
          "Message content or attachment is required",
        );
      if (content)
        await this.moderation.assertMessageAllowed(tx, senderId, content);
      const replyTo = input.replyToId
        ? await tx.message.findFirst({
            where: { id: input.replyToId, conversationId: id, deletedAt: null },
            select: { id: true, senderId: true, content: true, type: true },
          })
        : null;
      if (input.replyToId && !replyTo)
        throw new NotFoundException("Reply message not found");
      let attachment: { id: string; mimeType: string } | null = null;
      if (input.attachmentId) {
        attachment = await tx.fileAsset.findFirst({
          where: {
            id: input.attachmentId,
            ownerId: senderId,
            category: "CHAT",
            status: "READY",
          },
          select: { id: true, mimeType: true },
        });
        if (!attachment)
          throw new ForbiddenException("Attachment is unavailable");
        const valid =
          input.type === "IMAGE"
            ? attachment.mimeType.startsWith("image/")
            : input.type === "VOICE"
              ? attachment.mimeType.startsWith("audio/")
              : input.type === "VIDEO"
                ? attachment.mimeType.startsWith("video/")
                : false;
        if (!valid)
          throw new ConflictException(
            "Attachment type does not match message type",
          );
      }
      const receiverVendor = await tx.vendorProfile.findUnique({
        where: { userId: receiverId },
      });
      const baseCost =
          receiverVendor?.status === "APPROVED"
            ? receiverVendor.paidChatRate
            : 0,
        cost =
          baseCost > 0
            ? input.type === "VIDEO"
              ? Math.max(baseCost, 10)
              : ["IMAGE", "VOICE"].includes(input.type)
                ? Math.max(baseCost, 5)
                : baseCost
            : 0;
      const chatGift =
        cost > 0
          ? await tx.userGiftCard.findFirst({
              where: {
                recipientId: senderId,
                activatedAt: { not: null },
                status: { in: ["ACTIVE", "PARTIALLY_USED"] },
                expiresAt: { gt: new Date() },
                remainingMessages: { gt: 0 },
                OR: [{ vendorId: null }, { vendorId: receiverVendor?.id }],
              },
              orderBy: { expiresAt: "asc" },
            })
          : null;
      const chatPackage =
        cost > 0 && !chatGift
          ? await tx.userPackage.findFirst({
              where: {
                userId: senderId,
                active: true,
                expiresAt: { gt: new Date() },
                remainingMessages: { gt: 0 },
              },
              orderBy: { expiresAt: "asc" },
            })
          : null;
      const vendorAmount = receiverVendor
        ? Math.floor((cost * receiverVendor.commissionPercent) / 100)
        : 0;
      if (chatGift) {
        const remaining = chatGift.remainingMessages - 1;
        await tx.userGiftCard.update({
          where: { id: chatGift.id },
          data: {
            remainingMessages: remaining,
            status:
              remaining === 0 && chatGift.remainingVoiceSeconds === 0
                ? "FULLY_USED"
                : "PARTIALLY_USED",
          },
        });
      } else if (chatPackage)
        await tx.userPackage.update({
          where: { id: chatPackage.id },
          data: { remainingMessages: { decrement: 1 } },
        });
      else if (cost > 0)
        await this.wallets.debitPurchased(tx, {
          userId: senderId,
          type: "CHAT_CHARGE",
          direction: "DEBIT",
          amount: cost,
          referenceType: "MESSAGE",
          referenceId: scopedKey,
          description: "Paid chat message",
          idempotencyKey: `message:${scopedKey}:charge`,
        });
      const message = await tx.message.create({
        data: {
          conversationId: id,
          senderId,
          receiverId,
          content,
          attachmentUrl: attachment?.id,
          replyToId: replyTo?.id,
          type: input.type,
          idempotencyKey: scopedKey,
          pointCost: cost,
          vendorAmount,
          platformAmount: cost - vendorAmount,
        },
      });
        if (vendorAmount > 0) {
          const holdSetting=await tx.setting.findUnique({where:{key:'EARNING_HOLD_DAYS'},select:{value:true}}),holdValue=holdSetting?.value as Record<string,unknown>|undefined,configuredDays=holdValue?.days,holdDays=typeof configuredDays==='number'&&Number.isSafeInteger(configuredDays)?Math.min(90,Math.max(0,configuredDays)):7;
        await this.wallets.creditPendingEarning(
          tx,
          receiverId,
          vendorAmount,
          message.id,
          "CHAT",
        );
        await tx.earning.create({
          data: {
            vendorId: receiverVendor!.id,
            sourceType: "CHAT",
            sourceId: message.id,
            grossAmount: cost,
            vendorAmount,
            platformAmount: cost - vendorAmount,
            availableAt: new Date(Date.now() + holdDays * 86400000),
          },
        });
      }
      await this.wallets.platformCommission(
        tx,
        cost - vendorAmount,
        "MESSAGE",
        message.id,
        "Paid chat commission",
      );
      await tx.conversation.update({
        where: { id },
        data: { lastMessageAt: new Date() },
      });
      await tx.notification.create({
        data: {
          userId: receiverId,
          type: "MESSAGE",
          title: "New message",
          body:
            content?.slice(0, 120) ?? `New ${input.type.toLowerCase()} message`,
          data: { conversationId: id, messageId: message.id },
        },
      });
      const result = { ...message, replyTo };
      this.realtime.users([senderId, receiverId], "message:new", result);
      return result;
    });
  }
  async read(id: string, userId: string) {
    const conversation = await this.assertParticipant(id, userId);
    const result = await this.db.message.updateMany({
      where: { conversationId: id, receiverId: userId, readAt: null },
      data: { readAt: new Date(), status: "READ" },
    });
    const otherId =
      conversation.userOneId === userId
        ? conversation.userTwoId
        : conversation.userOneId;
    this.realtime.user(otherId, "message:read", {
      conversationId: id,
      readBy: userId,
      at: new Date(),
    });
    return result;
  }
  async react(messageId: string, userId: string, emoji: string) {
    const message = await this.db.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (
      !message ||
      message.deletedAt ||
      ![
        message.conversation.userOneId,
        message.conversation.userTwoId,
      ].includes(userId)
    )
      throw new NotFoundException("Message not found");
    const existing = await this.db.messageReaction.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });
    const reaction =
      existing?.emoji === emoji
        ? await this.db.messageReaction
            .delete({ where: { messageId_userId: { messageId, userId } } })
            .then(() => null)
        : await this.db.messageReaction.upsert({
            where: { messageId_userId: { messageId, userId } },
            create: { messageId, userId, emoji },
            update: { emoji },
          });
    const reactions = await this.db.messageReaction.findMany({
      where: { messageId },
      orderBy: { createdAt: "asc" },
    });
    this.realtime.users(
      [message.senderId, message.receiverId],
      "message:reaction",
      { messageId, reactions },
    );
    return { reaction, reactions };
  }
  async remove(messageId: string, userId: string, mode: "SELF" | "EVERYONE") {
    const message = await this.db.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (
      !message ||
      ![
        message.conversation.userOneId,
        message.conversation.userTwoId,
      ].includes(userId)
    )
      throw new NotFoundException("Message not found");
    if (mode === "SELF") {
      await this.db.messageHidden.upsert({
        where: { messageId_userId: { messageId, userId } },
        create: { messageId, userId },
        update: { hiddenAt: new Date() },
      });
      this.realtime.user(userId, "message:deleted", { messageId, mode });
      return { deleted: true, mode };
    }
    if (message.senderId !== userId)
      throw new ForbiddenException("Only the sender can delete for everyone");
    if (Date.now() - message.createdAt.getTime() > 15 * 60 * 1000)
      throw new ConflictException(
        "Delete for everyone is available for 15 minutes",
      );
    await this.db.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        status: "DELETED",
        content: null,
        attachmentUrl: null,
      },
    });
    this.realtime.users(
      [message.senderId, message.receiverId],
      "message:deleted",
      { messageId, mode },
    );
    return { deleted: true, mode };
  }
  private async assertParticipant(id: string, userId: string) {
    const conversation = await this.db.conversation.findUnique({
      where: { id },
    });
    if (
      !conversation ||
      ![conversation.userOneId, conversation.userTwoId].includes(userId)
    )
      throw new ForbiddenException();
    return conversation;
  }
  private async assertNotBlocked(one: string, two: string) {
    const blocked = await this.db.block.findFirst({
      where: {
        OR: [
          { blockerId: one, blockedUserId: two },
          { blockerId: two, blockedUserId: one },
        ],
      },
    });
    if (blocked) throw new ForbiddenException("Messaging is blocked");
  }
}
