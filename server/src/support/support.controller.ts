import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Role, StaffPermissionKey } from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AllowSuspended } from "../common/decorators/account-state.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtGuard } from "../common/guards/jwt.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  CreateTicketDto,
  ReplyTicketDto,
  UpdateTicketDto,
} from "./support.dto";
import { SupportService } from "./support.service";
@ApiTags("Support")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@AllowSuspended()
@Controller("support")
export class SupportController {
  constructor(private readonly service: SupportService) {}
  @Post() create(
    @CurrentUser() u: { sub: string },
    @Body() d: CreateTicketDto,
  ) {
    return this.service.create(u.sub, d);
  }
  @Get() mine(@CurrentUser() u: { sub: string }) {
    return this.service.mine(u.sub);
  }
  @Post(":id/replies") reply(
    @CurrentUser() u: { sub: string },
    @Param("id") id: string,
    @Body() d: ReplyTicketDto,
  ) {
    return this.service.replyUser(u.sub, id, d);
  }
}
@ApiTags("Admin support")
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
@RequirePermissions(StaffPermissionKey.MODERATE_CONTENT)
@Controller("admin/support")
export class AdminSupportController {
  constructor(private readonly service: SupportService) {}
  @Get() queue() {
    return this.service.queue();
  }
  @Get(":id") detail(@Param("id") id: string) {
    return this.service.detail(id);
  }
  @Post(":id/replies") reply(
    @CurrentUser() u: { sub: string; role: string },
    @Param("id") id: string,
    @Body() d: ReplyTicketDto,
  ) {
    return this.service.replyStaff(u, id, d);
  }
  @Patch(":id") update(
    @CurrentUser() u: { sub: string; role: string },
    @Param("id") id: string,
    @Body() d: UpdateTicketDto,
  ) {
    return this.service.update(u, id, d);
  }
}
