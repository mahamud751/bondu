import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { RestrictionType, Role, StaffPermissionKey } from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtGuard } from "../common/guards/jwt.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { PrismaService } from "../prisma/prisma.service";
import { RestrictionsService } from "./restrictions.service";
class ApplyRestrictionDto {
  @IsUUID() userId!: string;
  @IsEnum(RestrictionType) type!: RestrictionType;
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}
@ApiTags("Restrictions")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("restrictions")
export class RestrictionsController {
  constructor(private readonly service: RestrictionsService) {}
  @Get() mine(@CurrentUser() user: { sub: string }) {
    return this.service.list(user.sub);
  }
}
@ApiTags("Admin restrictions")
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
@RequirePermissions(StaffPermissionKey.MODERATE_CONTENT)
@Controller("admin/restrictions")
export class AdminRestrictionsController {
  constructor(private readonly db: PrismaService) {}
  @Get() list() {
    return this.db.userRestriction.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
  }
  @Post() async apply(
    @Body() dto: ApplyRestrictionDto,
    @CurrentUser() actor: { sub: string; role: string },
  ) {
    const restriction = await this.db.userRestriction.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        reason: dto.reason.trim(),
        sourceType: "MODERATION",
        sourceId: randomUUID(),
        appliedBy: actor.sub,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    await this.db.auditLog.create({
      data: {
        actorId: actor.sub,
        actorRole: actor.role,
        action: "USER_RESTRICTION_APPLIED",
        entityType: "USER_RESTRICTION",
        entityId: restriction.id,
        newValue: {
          userId: dto.userId,
          type: dto.type,
          reason: dto.reason,
          expiresAt: dto.expiresAt,
        },
      },
    });
    return restriction;
  }
  @Patch(":id/revoke") async revoke(
    @Param("id") id: string,
    @CurrentUser() actor: { sub: string; role: string },
  ) {
    const result = await this.db.userRestriction.update({
      where: { id },
      data: { revokedAt: new Date(), revokedBy: actor.sub },
    });
    await this.db.auditLog.create({
      data: {
        actorId: actor.sub,
        actorRole: actor.role,
        action: "USER_RESTRICTION_REVOKED",
        entityType: "USER_RESTRICTION",
        entityId: id,
      },
    });
    return result;
  }
}
