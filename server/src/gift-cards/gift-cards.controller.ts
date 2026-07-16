import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtGuard } from "../common/guards/jwt.guard";
import { PurchaseGiftCardDto } from "./gift-cards.dto";
import { GiftCardsService } from "./gift-cards.service";
@ApiTags("Gift cards")
@Controller("gift-cards")
export class GiftCardsController {
  constructor(private readonly service: GiftCardsService) {}
  @Get() list() {
    return this.service.list();
  }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Get("owned/mine") mine(
    @CurrentUser() u: { sub: string },
  ) {
    return this.service.mine(u.sub);
  }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Post("owned/:id/activate") activate(
    @CurrentUser() u: { sub: string },
    @Param("id") id: string,
  ) {
    return this.service.activate(u.sub, id);
  }
  @Get(":id") detail(@Param("id") id: string) {
    return this.service.detail(id);
  }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Post(":id/purchase") purchase(
    @CurrentUser() u: { sub: string },
    @Param("id") id: string,
    @Body() d: PurchaseGiftCardDto,
  ) {
    return this.service.purchase(u.sub, id, d);
  }
}
