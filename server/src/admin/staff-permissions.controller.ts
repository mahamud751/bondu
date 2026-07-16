import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import { Role, StaffPermissionKey } from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtGuard } from "../common/guards/jwt.guard";
import {
  PermissionsGuard,
  ROLE_PERMISSIONS,
} from "../common/guards/permissions.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

class PermissionOverrideDto {
  @IsEnum(StaffPermissionKey) permission!: StaffPermissionKey;
  @IsBoolean() allowed!: boolean;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

@ApiTags("Admin staff permissions")
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN)
@RequirePermissions(StaffPermissionKey.MANAGE_STAFF)
@Controller("admin/staff")
export class StaffPermissionsController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  async list() {
    const staff = await this.db.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.FINANCE, Role.MODERATOR] },
        status: { not: "DELETED" },
      },
      select: {
        id: true,
        phone: true,
        email: true,
        role: true,
        status: true,
        profile: { select: { displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const overrides = await this.db.staffPermission.findMany({
      where: { userId: { in: staff.map((item) => item.id) } },
    });
    return staff.map((member) => ({
      ...member,
      permissions: Object.values(StaffPermissionKey).map((permission) => {
        const override = overrides.find(
          (item) => item.userId === member.id && item.permission === permission,
        );
        return {
          permission,
          allowed:
            override?.allowed ??
            ROLE_PERMISSIONS[member.role].includes(permission),
          overridden: Boolean(override),
          reason: override?.reason,
        };
      }),
    }));
  }

  @Put(":id/permissions")
  async update(
    @Param("id") id: string,
    @Body() dto: PermissionOverrideDto,
    @CurrentUser() actor: { sub: string; role: string },
  ) {
    const target = await this.db.user.findUniqueOrThrow({
      where: { id },
      select: { role: true, status: true },
    });
    if (
      !new Set<Role>([Role.ADMIN, Role.FINANCE, Role.MODERATOR]).has(
        target.role,
      )
    )
      throw new BadRequestException(
        "Permissions can only be assigned to staff",
      );
    if (
      id === actor.sub &&
      dto.permission === StaffPermissionKey.MANAGE_STAFF &&
      !dto.allowed
    )
      throw new BadRequestException(
        "You cannot revoke your own staff-management permission",
      );
    const previous = await this.db.staffPermission.findUnique({
      where: { userId_permission: { userId: id, permission: dto.permission } },
    });
    const override = await this.db.$transaction(async (tx) => {
      const result = await tx.staffPermission.upsert({
        where: {
          userId_permission: { userId: id, permission: dto.permission },
        },
        create: {
          userId: id,
          permission: dto.permission,
          allowed: dto.allowed,
          reason: dto.reason?.trim(),
          grantedBy: actor.sub,
        },
        update: {
          allowed: dto.allowed,
          reason: dto.reason?.trim(),
          grantedBy: actor.sub,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          actorRole: actor.role,
          action: "STAFF_PERMISSION_CHANGED",
          entityType: "USER",
          entityId: id,
          oldValue: previous
            ? {
                permission: previous.permission,
                allowed: previous.allowed,
                reason: previous.reason,
              }
            : undefined,
          newValue: {
            permission: dto.permission,
            allowed: dto.allowed,
            reason: dto.reason,
          },
        },
      });
      return result;
    });
    return override;
  }
}
