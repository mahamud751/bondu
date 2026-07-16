import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { StaffPermissionKey } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtGuard } from "../common/guards/jwt.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  CreateCheckoutDto,
  RefundPaymentDto,
  RejectPaymentDto,
  SubmitPaymentDto,
} from "./payments.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("Payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly service: PaymentsService, private readonly config: ConfigService) {}
  private assertFinance(role: string) {
    if (!["ADMIN", "FINANCE"].includes(role)) throw new ForbiddenException();
  }
  @Get("instructions") instructions() {
    return this.service.instructions();
  }
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Post("manual")
  submit(@CurrentUser() user: { sub: string }, @Body() dto: SubmitPaymentDto) {
    return this.service.submit(user.sub, dto);
  }
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Post("checkout/stripe")
  checkout(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.service.createStripeCheckout(user.sub, dto);
  }
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Post("checkout/sslcommerz")
  sslcommerz(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.service.createSslCommerzCheckout(user.sub, dto);
  }
  @Post("sslcommerz/ipn")
  sslcommerzIpn(@Body() body: Record<string, string>) {
    return this.service.sslCommerzIpn(body);
  }
  @Post("sslcommerz/return/:result")
  sslcommerzReturn(@Param("result") result: string, @Res() response: Response) {
    const safe = ["success", "fail", "cancel"].includes(result)
      ? result
      : "fail";
    const base = this.config.get<string>("MOBILE_PAYMENT_RETURN_URL") ?? "socialconnect://payment";
    return response.redirect(`${base.replace(/\/$/, "")}/${safe}`);
  }
  @Post("webhooks/stripe")
  stripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature?: string,
  ) {
    if (!signature || !request.rawBody)
      throw new ForbiddenException("Missing webhook signature");
    return this.service.stripeWebhook(request.rawBody, signature);
  }
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Get("mine")
  mine(@CurrentUser() user: { sub: string }) {
    return this.service.listMine(user.sub);
  }
  @ApiBearerAuth()
  @UseGuards(JwtGuard, PermissionsGuard)
  @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE)
  @Get("admin/pending")
  pending(@CurrentUser() user: { role: string }) {
    this.assertFinance(user.role);
    return this.service.listPending();
  }
  @ApiBearerAuth()
  @UseGuards(JwtGuard, PermissionsGuard)
  @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE)
  @Get("admin/all")
  all(@CurrentUser() user: { role: string }) {
    this.assertFinance(user.role);
    return this.service.listAdminPayments();
  }
  @ApiBearerAuth()
  @UseGuards(JwtGuard, PermissionsGuard)
  @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE)
  @Post("admin/:id/approve")
  approve(
    @Param("id") id: string,
    @CurrentUser() user: { sub: string; role: string },
  ) {
    this.assertFinance(user.role);
    return this.service.approve(id, user.sub);
  }
  @ApiBearerAuth()
  @UseGuards(JwtGuard, PermissionsGuard)
  @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE)
  @Post("admin/:id/reject")
  reject(
    @Param("id") id: string,
    @CurrentUser() user: { sub: string; role: string },
    @Body() dto: RejectPaymentDto,
  ) {
    this.assertFinance(user.role);
    return this.service.reject(id, user.sub, dto.reason);
  }
  @ApiBearerAuth()
  @UseGuards(JwtGuard, PermissionsGuard)
  @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE)
  @Post("admin/:id/refund")
  refund(
    @Param("id") id: string,
    @CurrentUser() user: { sub: string; role: string },
    @Body() dto: RefundPaymentDto,
  ) {
    this.assertFinance(user.role);
    return this.service.refund(id, user.sub, dto);
  }
  @ApiBearerAuth()
  @UseGuards(JwtGuard, PermissionsGuard)
  @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE)
  @Get("admin/refunds")
  refunds(@CurrentUser() user: { role: string }) {
    this.assertFinance(user.role);
    return this.service.listRefunds();
  }
  @ApiBearerAuth()
  @UseGuards(JwtGuard, PermissionsGuard)
  @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE)
  @Get("admin/disputes")
  disputes(@CurrentUser() user: { role: string }) { this.assertFinance(user.role); return this.service.listDisputes(); }
  @ApiBearerAuth()
  @UseGuards(JwtGuard, PermissionsGuard)
  @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE)
  @Get("admin/reconciliation-issues")
  issues(@CurrentUser() user: { role: string }) {
    this.assertFinance(user.role);
    return this.service.reconciliationIssues();
  }
  @ApiBearerAuth()
  @UseGuards(JwtGuard, PermissionsGuard)
  @RequirePermissions(StaffPermissionKey.MANAGE_FINANCE)
  @Post("admin/reconcile")
  reconcile(@CurrentUser() user: { role: string }) {
    this.assertFinance(user.role);
    return this.service.reconcileAll(500);
  }
}
