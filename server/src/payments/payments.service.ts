import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import {
  CreateCheckoutDto,
  RefundPaymentDto,
  SubmitPaymentDto,
} from "./payments.dto";
import { ReferralsService } from "../referrals/referrals.service";
import { SslCommerzIpn, SslCommerzService } from "./sslcommerz.service";

@Injectable()
export class PaymentsService {
  private readonly stripe?: Stripe;
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly wallets: WalletService,
    private readonly referrals: ReferralsService,
    private readonly sslcommerz: SslCommerzService,
  ) {
    const key = config.get<string>("STRIPE_SECRET_KEY");
    if (key) this.stripe = new Stripe(key);
  }
  async instructions() {
    const conversion=await this.conversion();
    return {
      currency: conversion.currency,
      currencyMinorUnitsPerPoint:conversion.minorPerPoint,
      gateways: [
        {
          gateway: "BKASH",
          receiverNumber: this.config.get("BKASH_RECEIVER_NUMBER"),
          steps: [
            "Open bKash app",
            "Choose Send Money",
            "Send exact amount",
            "Copy transaction ID",
          ],
        },
        {
          gateway: "NAGAD",
          receiverNumber: this.config.get("NAGAD_RECEIVER_NUMBER"),
          steps: [
            "Open Nagad app",
            "Choose Send Money",
            "Send exact amount",
            "Copy transaction ID",
          ],
        },
      ],
      cardPaymentsAvailable: Boolean(this.stripe),
      sslcommerzAvailable: this.sslcommerz.configured,
      notice:
        "Manual transfers are credited only after staff verification. Card payments are credited only from a signed provider webhook.",
    };
  }
  async submit(userId: string, dto: SubmitPaymentDto) {
    if (!["BKASH", "NAGAD"].includes(dto.gateway))
      throw new BadRequestException("Use checkout for online gateways");
    const receiver = this.config.get(`${dto.gateway}_RECEIVER_NUMBER`);
    if (!receiver) throw new BadRequestException("Gateway is unavailable");
    const conversion=await this.conversion();
    try {
      return await this.db.payment.create({
        data: {
          userId,
          gateway: dto.gateway,
          receiverNumber: receiver,
          senderNumber: dto.senderNumber,
          amount: dto.amount,
          currency:conversion.currency,
          currencyAmountMinor:dto.amount*conversion.minorPerPoint,
          conversionMinorPerPoint:conversion.minorPerPoint,
          transactionId: dto.transactionId.trim().toUpperCase(),
        },
      });
    } catch {
      throw new ConflictException("This transaction ID was already submitted");
    }
  }
  async createStripeCheckout(userId: string, dto: CreateCheckoutDto) {
    if (!this.stripe)
      throw new ServiceUnavailableException("Card payments are not configured");
    const orderReference = `SC-${randomUUID()}`;
    const conversion=await this.conversion();
    const payment = await this.db.payment.create({
      data: {
        userId,
        gateway: "STRIPE",
        amount: dto.amount,
        currency:conversion.currency,
        currencyAmountMinor:dto.amount*conversion.minorPerPoint,
        conversionMinorPerPoint:conversion.minorPerPoint,
        transactionId: orderReference,
        orderReference,
        status: "SUBMITTED",
      },
    });
    try {
      const intent = await this.stripe.paymentIntents.create(
        {
          amount: payment.currencyAmountMinor,
          currency: payment.currency.toLowerCase(),
          automatic_payment_methods: { enabled: true },
          metadata: { paymentId: payment.id, orderReference, userId },
          description: `${dto.amount} SocialConnect points`,
        },
        { idempotencyKey: orderReference },
      );
      await this.db.payment.update({
        where: { id: payment.id },
        data: { gatewayIntentId: intent.id, transactionId: intent.id },
      });
      return {
        paymentId: payment.id,
        orderReference,
        clientSecret: intent.client_secret,
        publishableKey: this.config.get("STRIPE_PUBLISHABLE_KEY"),
      };
    } catch (error) {
      await this.db.payment.update({
        where: { id: payment.id },
        data: {
          status: "REJECTED",
          rejectionReason: "Provider checkout creation failed",
        },
      });
      throw error;
    }
  }
  async createSslCommerzCheckout(userId: string, dto: CreateCheckoutDto) {
    if (!this.sslcommerz.configured)
      throw new ServiceUnavailableException("SSLCommerz is not configured");
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });
    const conversion=await this.conversion(),transactionId = `SCZ-${randomUUID()}`,
      payment = await this.db.payment.create({
        data: {
          userId,
          gateway: "SSLCOMMERZ",
          amount: dto.amount,
          currency:conversion.currency,
          currencyAmountMinor:dto.amount*conversion.minorPerPoint,
          conversionMinorPerPoint:conversion.minorPerPoint,
          transactionId,
          orderReference: transactionId,
          status: "SUBMITTED",
        },
      });
    try {
      const session = await this.sslcommerz.createSession({
        transactionId,
        amount: payment.currencyAmountMinor/100,
        customerName: user.profile?.displayName ?? "SocialConnect member",
        phone: user.phone,
        email: user.email,
      });
      await this.db.payment.update({
        where: { id: payment.id },
        data: { gatewayIntentId: session.sessionKey },
      });
      return {
        paymentId: payment.id,
        orderReference: transactionId,
        checkoutUrl: session.checkoutUrl,
      };
    } catch (error) {
      await this.db.payment.update({
        where: { id: payment.id },
        data: {
          status: "REJECTED",
          rejectionReason: "Provider checkout creation failed",
        },
      });
      throw error;
    }
  }
  async sslCommerzIpn(ipn: SslCommerzIpn) {
    const transactionId = String(ipn.tran_id ?? ""),
      status = String(ipn.status ?? "").toUpperCase();
    if (!transactionId || !status)
      throw new BadRequestException("Invalid SSLCommerz notification");
    const payment = await this.db.payment.findUnique({
      where: {
        gateway_transactionId: { gateway: "SSLCOMMERZ", transactionId },
      },
    });
    if (!payment) throw new NotFoundException("Payment order not found");
    const eventId = String(ipn.val_id || `${transactionId}:${status}`),
      prior = await this.db.paymentWebhook.findUnique({
        where: { gateway_eventId: { gateway: "SSLCOMMERZ", eventId } },
      });
    if (prior?.processedAt) return { received: true, duplicate: true };
    const webhook =
      prior ??
      (await this.db.paymentWebhook.create({
        data: {
          gateway: "SSLCOMMERZ",
          eventId,
          eventType: `IPN_${status}`,
          paymentId: payment.id,
          payload: ipn as Prisma.InputJsonObject,
        },
      }));
    try {
      if (["VALID", "VALIDATED"].includes(status)) {
        const validation = await this.sslcommerz.validate(
          String(ipn.val_id ?? ""),
        );
        if (
          validation.tran_id !== transactionId ||
          validation.currency?.toUpperCase() !== payment.currency ||
          Math.round(Number(validation.amount) * 100) !== payment.currencyAmountMinor
        )
          throw new ConflictException(
            "SSLCommerz amount, currency, or transaction mismatch",
          );
        if (String(validation.risk_level) === "1")
          await this.db.payment.updateMany({
            where: {
              id: payment.id,
              status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
            },
            data: {
              status: "UNDER_REVIEW",
              rejectionReason:
                validation.risk_title ?? "Gateway marked payment as risky",
            },
          });
        else await this.settleSslCommerzPayment(payment.id);
      } else if (["FAILED", "CANCELLED"].includes(status)) {
        const remote = await this.sslcommerz.query(transactionId);
        if (
          String(remote.tran_id) !== transactionId ||
          String(remote.status).toUpperCase() !== status
        )
          throw new ConflictException(
            "SSLCommerz notification status mismatch",
          );
        await this.db.payment.updateMany({
          where: {
            id: payment.id,
            status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
          },
          data: {
            status: "REJECTED",
            rejectionReason: `SSLCommerz payment ${status.toLowerCase()}`,
          },
        });
      }
      await this.db.paymentWebhook.update({
        where: { id: webhook.id },
        data: { processedAt: new Date(), error: null },
      });
      return { received: true, duplicate: false };
    } catch (error) {
      await this.db.paymentWebhook.update({
        where: { id: webhook.id },
        data: {
          error:
            error instanceof Error ? error.message : "Unknown processing error",
        },
      });
      throw error;
    }
  }
  private settleSslCommerzPayment(paymentId: string) {
    return this.wallets.transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment || payment.gateway !== "SSLCOMMERZ")
        throw new NotFoundException("Payment order not found");
      if (payment.status === "APPROVED") return payment;
      if (!["SUBMITTED", "UNDER_REVIEW"].includes(payment.status))
        throw new ConflictException("Payment is not payable");
      await this.wallets.creditPurchased(tx, {
        userId: payment.userId,
        type: "DEPOSIT",
        direction: "CREDIT",
        amount: payment.amount,
        referenceType: "PAYMENT",
        referenceId: payment.id,
        description: "Verified SSLCommerz deposit",
        idempotencyKey: `payment:${payment.id}:approve`,
      });
      await this.referrals.qualifyFirstPayment(tx, payment.userId, payment.id);
      return tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });
    });
  }
  async stripeWebhook(rawBody: Buffer, signature: string) {
    if (!this.stripe)
      throw new ServiceUnavailableException("Stripe is not configured");
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret)
      throw new ServiceUnavailableException("Stripe webhook is not configured");
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new BadRequestException("Invalid webhook signature");
    }
    const prior = await this.db.paymentWebhook.findUnique({
      where: { gateway_eventId: { gateway: "STRIPE", eventId: event.id } },
    });
    if (prior?.processedAt) return { received: true, duplicate: true };
    const disputeEvent = event.type.startsWith("charge.dispute."),
      object = event.data.object as Stripe.PaymentIntent,
      dispute = disputeEvent
        ? (event.data.object as Stripe.Dispute)
        : undefined;
    const paymentId = dispute
      ? await this.stripeDisputePaymentId(dispute)
      : object.metadata?.paymentId;
    const webhook =
      prior ??
      (await this.db.paymentWebhook.create({
        data: {
          gateway: "STRIPE",
          eventId: event.id,
          eventType: event.type,
          paymentId: paymentId || null,
          payload: event as unknown as Prisma.InputJsonObject,
        },
      }));
    try {
      if (event.type === "payment_intent.succeeded")
        await this.settleOnlinePayment(
          paymentId,
          object.id,
          object.amount_received,
          object.currency,
        );
      else if (event.type === "payment_intent.payment_failed" && paymentId)
        await this.db.payment.updateMany({
          where: {
            id: paymentId,
            status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
          },
          data: {
            status: "REJECTED",
            rejectionReason:
              object.last_payment_error?.message ?? "Payment failed",
          },
        });
      else if (dispute && paymentId)
        await this.handleStripeDispute(paymentId, dispute, event.type);
      await this.db.paymentWebhook.update({
        where: { id: webhook.id },
        data: { processedAt: new Date(), error: null },
      });
      return { received: true };
    } catch (error) {
      await this.db.paymentWebhook.update({
        where: { id: webhook.id },
        data: {
          error:
            error instanceof Error ? error.message : "Unknown processing error",
        },
      });
      throw error;
    }
  }
  private async stripeDisputePaymentId(dispute: Stripe.Dispute) {
    if (!this.stripe) return undefined;
    const charge =
      typeof dispute.charge === "string"
        ? await this.stripe.charges.retrieve(dispute.charge)
        : dispute.charge;
    const intentId =
      typeof charge?.payment_intent === "string"
        ? charge.payment_intent
        : charge?.payment_intent?.id;
    if (!intentId)
      throw new NotFoundException("Disputed payment intent not found");
    return (
      await this.db.payment.findUnique({
        where: { gatewayIntentId: intentId },
        select: { id: true },
      })
    )?.id;
  }
  private async handleStripeDispute(
    paymentId: string,
    dispute: Stripe.Dispute,
    eventType: string,
  ) {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException("Disputed payment not found");
    if (dispute.currency.toUpperCase() !== payment.currency)
      throw new ConflictException("Dispute currency mismatch");
    const status =
        eventType === "charge.dispute.closed" && dispute.status === "lost"
          ? "LOST"
          : eventType === "charge.dispute.closed" && dispute.status === "won"
            ? "WON"
            : dispute.status.toUpperCase(),
      amount = Math.ceil(dispute.amount / 100);
    await this.db.$transaction(async (tx) => {
      await tx.paymentDispute.upsert({
        where: { gatewayDisputeId: dispute.id },
        create: {
          paymentId,
          gatewayDisputeId: dispute.id,
          amount,
          currency: dispute.currency.toUpperCase(),
          reason: dispute.reason,
          status,
          evidenceDueAt: dispute.evidence_details?.due_by
            ? new Date(dispute.evidence_details.due_by * 1000)
            : null,
          resolvedAt: ["WON", "LOST"].includes(status) ? new Date() : null,
          metadata: dispute.metadata as Prisma.InputJsonObject,
        },
        update: {
          status,
          reason: dispute.reason,
          resolvedAt: ["WON", "LOST"].includes(status) ? new Date() : null,
          metadata: dispute.metadata as Prisma.InputJsonObject,
        },
      });
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status:
            status === "LOST"
              ? "CHARGEBACK"
              : status === "WON"
                ? "APPROVED"
                : "DISPUTED",
          rejectionReason:
            status === "LOST"
              ? "Payment lost to chargeback"
              : status === "WON"
                ? null
                : "Payment is under dispute",
        },
      });
      if (status === "LOST") {
        await tx.fraudAssessment.create({
          data: {
            userId: payment.userId,
            context: "CHARGEBACK",
            referenceId: dispute.id,
            score: 100,
            reasons: ["PAYMENT_CHARGEBACK"],
            action: "RESTRICT_CALLING",
            metadata: { paymentId, amount },
          },
        });
        for (const type of ["CALL", "WITHDRAWAL"] as const)
          await tx.userRestriction.upsert({
            where: { sourceType_sourceId_type: { sourceType: "STRIPE_DISPUTE", sourceId: dispute.id, type } },
            create: { userId: payment.userId, type, reason: "Payment chargeback requires account review", sourceType: "STRIPE_DISPUTE", sourceId: dispute.id },
            update: { revokedAt: null, revokedBy: null },
          });
      }
      if (status === "WON") await tx.userRestriction.updateMany({ where: { sourceType: "STRIPE_DISPUTE", sourceId: dispute.id, revokedAt: null }, data: { revokedAt: new Date(), revokedBy: "SYSTEM" } });
      await tx.auditLog.create({
        data: {
          action: "PAYMENT_DISPUTE_UPDATED",
          entityType: "PAYMENT",
          entityId: paymentId,
          newValue: { disputeId: dispute.id, status, amount },
        },
      });
    });
  }
  private settleOnlinePayment(
    paymentId: string | undefined,
    gatewayIntentId: string,
    receivedMinor: number,
    currency: string,
  ) {
    if (!paymentId)
      throw new BadRequestException("Webhook is missing payment metadata");
    return this.wallets.transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment || payment.gateway !== "STRIPE")
        throw new NotFoundException("Payment order not found");
      if (payment.status === "APPROVED") return payment;
      if (!["SUBMITTED", "UNDER_REVIEW"].includes(payment.status))
        throw new ConflictException("Payment is not payable");
      if (
        currency.toUpperCase() !== payment.currency ||
        receivedMinor !== payment.currencyAmountMinor
      )
        throw new ConflictException("Webhook amount or currency mismatch");
      await this.wallets.creditPurchased(tx, {
        userId: payment.userId,
        type: "DEPOSIT",
        direction: "CREDIT",
        amount: payment.amount,
        referenceType: "PAYMENT",
        referenceId: payment.id,
        description: "Verified Stripe deposit",
        idempotencyKey: `payment:${payment.id}:approve`,
      });
      await this.referrals.qualifyFirstPayment(tx, payment.userId, payment.id);
      return tx.payment.update({
        where: { id: payment.id },
        data: { status: "APPROVED", gatewayIntentId, reviewedAt: new Date() },
      });
    });
  }
  listMine(userId: string) {
    return this.db.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }
  listPending() {
    return this.db.payment.findMany({
      where: {
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
        gateway: { in: ["BKASH", "NAGAD"] },
      },
      include: { user: { select: { phone: true, profile: true } } },
      orderBy: { createdAt: "asc" },
    });
  }
  listAdminPayments() {
    return this.db.payment.findMany({
      include: {
        user: { select: { phone: true, profile: true } },
        refunds: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
  }
  async approve(id: string, reviewer: string) {
    return this.wallets.transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) throw new NotFoundException();
      if (!["BKASH", "NAGAD"].includes(payment.gateway))
        throw new ConflictException("Online payments are webhook-controlled");
      if (!["SUBMITTED", "UNDER_REVIEW"].includes(payment.status))
        throw new ConflictException("Payment already processed");
      await this.wallets.creditPurchased(tx, {
        userId: payment.userId,
        type: "DEPOSIT",
        direction: "CREDIT",
        amount: payment.amount,
        referenceType: "PAYMENT",
        referenceId: payment.id,
        description: `Verified ${payment.gateway} deposit`,
        idempotencyKey: `payment:${payment.id}:approve`,
      });
      await this.referrals.qualifyFirstPayment(tx, payment.userId, payment.id);
      return tx.payment.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedBy: reviewer,
          reviewedAt: new Date(),
        },
      });
    });
  }
  async reject(id: string, reviewer: string, reason: string) {
    const payment = await this.db.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException();
    if (!["SUBMITTED", "UNDER_REVIEW"].includes(payment.status))
      throw new ConflictException("Payment already processed");
    return this.db.payment.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        reviewedBy: reviewer,
        reviewedAt: new Date(),
      },
    });
  }
  async refund(id: string, actorId: string, dto: RefundPaymentDto) {
    const prepared = await this.wallets.transaction(async (tx) => {
      const existing = await tx.paymentRefund.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return { refund: existing, duplicate: true };
      const payment = await tx.payment.findUnique({
        where: { id },
        include: {
          refunds: { where: { status: { in: ["PROCESSING", "COMPLETED"] } } },
        },
      });
      if (
        !payment ||
        !["APPROVED", "PARTIALLY_REFUNDED"].includes(payment.status)
      )
        throw new ConflictException("Payment is not refundable");
      const refunded = payment.refunds.reduce(
          (sum, item) => sum + item.amount,
          0,
        ),
        amount = dto.amount ?? payment.amount - refunded;
      if (amount <= 0 || refunded + amount > payment.amount)
        throw new ConflictException(
          "Refund exceeds remaining refundable amount",
        );
      const refund = await tx.paymentRefund.create({
        data: {
          paymentId: id,
          amount,
          reason: dto.reason.trim(),
          idempotencyKey: dto.idempotencyKey,
          requestedBy: actorId,
          status: "PROCESSING",
        },
      });
      await this.wallets.debitPurchased(tx, {
        userId: payment.userId,
        type: "REFUND",
        direction: "DEBIT",
        amount,
        referenceType: "PAYMENT_REFUND",
        referenceId: refund.id,
        description: "Points held for payment refund",
        idempotencyKey: `refund:${refund.id}:debit`,
      });
      return { refund, payment, duplicate: false };
    });
    if (prepared.duplicate || !prepared.payment) return prepared.refund;
    const { refund, payment } = prepared;
    if (payment.gateway !== "STRIPE") return refund;
    if (!this.stripe)
      throw new ServiceUnavailableException("Stripe is not configured");
    try {
      const result = await this.stripe.refunds.create(
        {
          payment_intent: payment.gatewayIntentId!,
          amount: refund.amount * payment.conversionMinorPerPoint,
          reason: "requested_by_customer",
          metadata: {
            refundId: refund.id,
            paymentId: payment.id,
            internalReason: refund.reason,
          },
        },
        { idempotencyKey: refund.idempotencyKey },
      );
      return this.db.$transaction(async (tx) => {
        const completed = await tx.paymentRefund.update({
            where: { id: refund.id },
            data: {
              status: "COMPLETED",
              gatewayRefundId: result.id,
              processedAt: new Date(),
            },
          }),
          aggregate = await tx.paymentRefund.aggregate({
            where: { paymentId: payment.id, status: "COMPLETED" },
            _sum: { amount: true },
          });
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status:
              (aggregate._sum.amount ?? 0) >= payment.amount
                ? "REFUNDED"
                : "PARTIALLY_REFUNDED",
          },
        });
        return completed;
      });
    } catch (error) {
      await this.wallets.transaction(async (tx) => {
        await this.wallets.creditPurchased(tx, {
          userId: payment.userId,
          type: "REFUND",
          direction: "CREDIT",
          amount: refund.amount,
          referenceType: "PAYMENT_REFUND",
          referenceId: refund.id,
          description: "Released failed refund hold",
          idempotencyKey: `refund:${refund.id}:release`,
        });
        await tx.paymentRefund.update({
          where: { id: refund.id },
          data: {
            status: "FAILED",
            error:
              error instanceof Error ? error.message : "Provider refund failed",
          },
        });
      });
      throw error;
    }
  }
  async reconcileStripe(limit = 100) {
    if (!this.stripe)
      return { checked: 0, discrepancies: 0, configured: false };
    const payments = await this.db.payment.findMany({
      where: { gateway: "STRIPE", gatewayIntentId: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: Math.min(limit, 500),
    });
    let discrepancies = 0;
    for (const payment of payments) {
      try {
        const intent = await this.stripe.paymentIntents.retrieve(
            payment.gatewayIntentId!,
          ),
          amountMatches = intent.amount === payment.currencyAmountMinor,
          statusMatches = [
            "APPROVED",
            "PARTIALLY_REFUNDED",
            "REFUNDED",
            "DISPUTED",
            "CHARGEBACK",
          ].includes(payment.status)
            ? intent.status === "succeeded"
            : intent.status !== "succeeded",
          discrepancy = !amountMatches
            ? "AMOUNT_MISMATCH"
            : !statusMatches
              ? "STATUS_MISMATCH"
              : null;
        if (discrepancy) discrepancies++;
        await this.db.paymentReconciliation.create({
          data: {
            paymentId: payment.id,
            gatewayStatus: intent.status,
            localStatus: payment.status,
            amountMatches,
            statusMatches,
            discrepancy,
          },
        });
      } catch (error) {
        discrepancies++;
        await this.db.paymentReconciliation.create({
          data: {
            paymentId: payment.id,
            gatewayStatus: "ERROR",
            localStatus: payment.status,
            amountMatches: false,
            statusMatches: false,
            discrepancy:
              error instanceof Error ? error.message : "RECONCILIATION_ERROR",
          },
        });
      }
    }
    return { checked: payments.length, discrepancies, configured: true };
  }
  async reconcileSslCommerz(limit = 100) {
    if (!this.sslcommerz.configured)
      return { checked: 0, discrepancies: 0, configured: false };
    const payments = await this.db.payment.findMany({
      where: {
        gateway: "SSLCOMMERZ",
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(limit, 500),
    });
    let discrepancies = 0;
    for (const payment of payments) {
      try {
        const remote = await this.sslcommerz.query(payment.transactionId),
          remotePaid = ["VALID", "VALIDATED"].includes(remote.status ?? ""),
          amountMatches =
            Math.round(Number(remote.amount) * 100) === payment.currencyAmountMinor,
          statusMatches = remotePaid
            ? payment.status === "APPROVED"
            : payment.status !== "APPROVED";
        let discrepancy =
          !amountMatches && remotePaid
            ? "AMOUNT_MISMATCH"
            : !statusMatches
              ? "STATUS_MISMATCH"
              : null;
        if (
          remotePaid &&
          amountMatches &&
          String(remote.risk_level) !== "1" &&
          payment.status !== "APPROVED"
        ) {
          await this.settleSslCommerzPayment(payment.id);
          discrepancy = "AUTO_RECOVERED_MISSED_IPN";
        }
        if (discrepancy) discrepancies++;
        await this.db.paymentReconciliation.create({
          data: {
            paymentId: payment.id,
            gatewayStatus: remote.status ?? "UNKNOWN",
            localStatus: payment.status,
            amountMatches,
            statusMatches,
            discrepancy,
          },
        });
      } catch (error) {
        discrepancies++;
        await this.db.paymentReconciliation.create({
          data: {
            paymentId: payment.id,
            gatewayStatus: "ERROR",
            localStatus: payment.status,
            amountMatches: false,
            statusMatches: false,
            discrepancy:
              error instanceof Error ? error.message : "RECONCILIATION_ERROR",
          },
        });
      }
    }
    return { checked: payments.length, discrepancies, configured: true };
  }
  async reconcileAll(limit = 100) {
    const [stripe, sslcommerz] = await Promise.all([
      this.reconcileStripe(limit),
      this.reconcileSslCommerz(limit),
    ]);
    return {
      stripe,
      sslcommerz,
      checked: stripe.checked + sslcommerz.checked,
      discrepancies: stripe.discrepancies + sslcommerz.discrepancies,
    };
  }
  listRefunds() {
    return this.db.paymentRefund.findMany({
      include: {
        payment: {
          include: { user: { select: { phone: true, profile: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
  }
  listDisputes() {
    return this.db.paymentDispute.findMany({
      include: {
        payment: {
          include: { user: { select: { phone: true, profile: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
  }
  reconciliationIssues() {
    return this.db.paymentReconciliation.findMany({
      where: { discrepancy: { not: null } },
      include: { payment: true },
      orderBy: { checkedAt: "desc" },
      take: 250,
    });
  }
  private async conversion(){
    const setting=await this.db.setting.findUnique({where:{key:'POINT_CONVERSION'},select:{value:true}}),value=setting?.value as Record<string,unknown>|undefined,minor=value?.currencyMinorUnitsPerPoint,currency=value?.currency;
    return{minorPerPoint:typeof minor==='number'&&Number.isSafeInteger(minor)&&minor>0?minor:100,currency:typeof currency==='string'&&/^[A-Z]{3}$/.test(currency)?currency:'BDT'};
  }
}
