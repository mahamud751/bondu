import { BadRequestException, Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { PaymentGateway, RestrictionType } from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsInt, IsString, Matches, MaxLength, Min } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtGuard } from "../common/guards/jwt.guard";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { FraudService } from "../fraud/fraud.service";
import { PayoutCryptoService } from "../security/payout-crypto.service";
import { RestrictionsService } from "../restrictions/restrictions.service";

class WithdrawalDto {
  @IsInt() @Min(1) amount!: number;
  @IsEnum(PaymentGateway) method!: PaymentGateway;
  @Matches(/^01\d{9}$/) accountNumber!: string;
  @IsString() @MaxLength(100) idempotencyKey!:string;
}

@ApiTags("Withdrawals")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("withdrawals")
export class WithdrawalsController {
  constructor(
    private readonly db: PrismaService,
    private readonly wallets: WalletService,
    private readonly fraud: FraudService,
    private readonly crypto: PayoutCryptoService,
    private readonly restrictions: RestrictionsService,
  ) {}

  @Get()
  async list(@CurrentUser() user: { sub: string }) {
    const records = await this.db.withdrawal.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: "desc" },
    });
    return records.map(({ accountDetailsEncrypted: _secret, ...record }) => ({
      ...record,
      netAmount:record.amount-record.fee,
      accountNumber: this.crypto.mask(record.accountLast4),
    }));
  }

  @Post()
  async create(
    @CurrentUser() user: { sub: string },
    @Body() dto: WithdrawalDto,
  ) {
    await this.restrictions.assertAllowed(user.sub, RestrictionType.WITHDRAWAL);
    const idempotencyKey=`withdrawal:${user.sub}:${dto.idempotencyKey}`,prior=await this.db.withdrawal.findUnique({where:{idempotencyKey}});
    if(prior){const{accountDetailsEncrypted:_secret,...safe}=prior;return{...safe,netAmount:prior.amount-prior.fee,accountNumber:this.crypto.mask(prior.accountLast4),duplicate:true}}
    const setting=await this.db.setting.findUnique({where:{key:'WITHDRAWAL_RULES'},select:{value:true}}),value=(setting?.value??{}) as Record<string,unknown>,number=(key:string,fallback:number)=>typeof value[key]==='number'&&Number.isSafeInteger(value[key])?Number(value[key]):fallback,minimum=number('minimum',500),maximumDaily=number('maximumDaily',50_000),fee=Math.min(dto.amount-1,Math.max(0,number('feePoints',0))),accountAgeDays=Math.max(0,number('requiredAccountAgeDays',0)),requiredCalls=Math.max(0,number('requiredCompletedCalls',0));
    if(dto.amount<minimum)throw new BadRequestException(`Minimum withdrawal is ${minimum} points`);
    const [account,recent]=await Promise.all([this.db.user.findUniqueOrThrow({where:{id:user.sub},include:{vendor:{select:{id:true,status:true,identityStatus:true}}}}),this.db.withdrawal.aggregate({where:{userId:user.sub,createdAt:{gt:new Date(Date.now()-86400000)},status:{notIn:['REJECTED','CANCELLED','FAILED','REVERSED']}},_sum:{amount:true}})]);
    if((recent._sum.amount??0)+dto.amount>maximumDaily)throw new BadRequestException(`Daily withdrawal limit is ${maximumDaily} points`);
    if(Date.now()-account.createdAt.getTime()<accountAgeDays*86400000)throw new BadRequestException(`Account must be at least ${accountAgeDays} days old`);
    if(value.requiredIdentityVerification===true&&account.vendor?.identityStatus!=='VERIFIED')throw new BadRequestException('Identity verification is required for withdrawals');
    if(requiredCalls>0){const completed=await this.db.callSession.count({where:{vendorId:account.vendor?.id??'',status:'COMPLETED'}});if(completed<requiredCalls)throw new BadRequestException(`${requiredCalls} completed calls are required before withdrawal`)}
    const risk = await this.fraud.assessWithdrawal(user.sub, dto.amount);
    // Auto-complete low-risk small withdrawals (no SSL/Twilio dependency).
    // Manual review still required when fraud signals fire or amount is high.
    const autoCompleteMax = number("autoCompleteMax", 2000);
    const canAuto =
      risk.action !== "MANUAL_REVIEW" &&
      dto.amount <= autoCompleteMax &&
      value.autoCompleteEnabled !== false;

    return this.wallets.transaction(async (tx) => {
      let withdrawal = await tx.withdrawal.create({
        data: {
          userId: user.sub,
          amount: dto.amount,
          fee,
          method: dto.method,
          accountDetailsEncrypted: this.crypto.encrypt(dto.accountNumber),
          accountLast4: dto.accountNumber.slice(-4),
          idempotencyKey,
          status: risk.action === "MANUAL_REVIEW" ? "UNDER_REVIEW" : "PENDING",
        },
      });
      await tx.fraudAssessment.update({
        where: { id: risk.id },
        data: { referenceId: withdrawal.id },
      });
      await this.wallets.holdWithdrawal(
        tx,
        user.sub,
        dto.amount,
        withdrawal.id,
      );

      if (canAuto) {
        if (fee > 0) {
          await this.wallets.platformCommission(
            tx,
            fee,
            "WITHDRAWAL",
            withdrawal.id,
            "Withdrawal processing fee",
          );
        }
        await this.wallets.completeWithdrawal(
          tx,
          user.sub,
          dto.amount,
          withdrawal.id,
          fee,
        );
        withdrawal = await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: { status: "COMPLETED" },
        });
        await tx.notification.create({
          data: {
            userId: user.sub,
            type: "WITHDRAWAL_APPROVED",
            title: "Withdrawal completed",
            body: `Your withdrawal of ${dto.amount - fee} points was auto-completed.`,
            data: { withdrawalId: withdrawal.id, auto: true },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.sub,
            actorRole: "SYSTEM",
            action: "WITHDRAWAL_AUTO_COMPLETED",
            entityType: "WITHDRAWAL",
            entityId: withdrawal.id,
            newValue: { amount: dto.amount, fee, autoCompleteMax },
          },
        });
      }

      const { accountDetailsEncrypted: _secret, ...safe } = withdrawal;
      return {
        ...safe,
        netAmount: withdrawal.amount - withdrawal.fee,
        accountNumber: this.crypto.mask(withdrawal.accountLast4),
        autoCompleted: canAuto,
      };
    });
  }
}
