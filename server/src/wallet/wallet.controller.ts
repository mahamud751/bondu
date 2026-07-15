import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtGuard } from "../common/guards/jwt.guard";
import { PrismaService } from "../prisma/prisma.service";
@ApiTags("Wallet")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("wallet")
export class WalletController {
  constructor(private db: PrismaService) {}
  @Get() get(@CurrentUser() u: { sub: string }) {
    return this.db.wallet.findUnique({ where: { userId: u.sub } });
  }
  @Get("transactions") ledger(@CurrentUser() u: { sub: string }) {
    return this.db.walletLedger.findMany({
      where: { userId: u.sub },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
