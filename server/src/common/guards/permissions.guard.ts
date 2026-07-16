import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role, StaffPermissionKey } from "@prisma/client";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { PrismaService } from "../../prisma/prisma.service";

export const ROLE_PERMISSIONS: Record<Role, StaffPermissionKey[]> = {
  ADMIN: Object.values(StaffPermissionKey),
  FINANCE: [
    StaffPermissionKey.VIEW_DASHBOARD,
    StaffPermissionKey.MANAGE_FINANCE,
    StaffPermissionKey.EXPORT_DATA,
    StaffPermissionKey.REVIEW_RISK,
  ],
  MODERATOR: [
    StaffPermissionKey.VIEW_DASHBOARD,
    StaffPermissionKey.REVIEW_VENDORS,
    StaffPermissionKey.MODERATE_CONTENT,
    StaffPermissionKey.REVIEW_RISK,
  ],
  USER: [],
  VENDOR: [],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<StaffPermissionKey[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;
    const identity = context.switchToHttp().getRequest().user as
      { sub?: string; role?: Role } | undefined;
    if (!identity?.sub || !identity.role)
      throw new ForbiddenException("Staff permission required");
    const defaults = new Set(ROLE_PERMISSIONS[identity.role] ?? []);
    const overrides = await this.db.staffPermission.findMany({
      where: { userId: identity.sub, permission: { in: required } },
    });
    const effective = new Map(
      required.map((permission) => [permission, defaults.has(permission)]),
    );
    for (const override of overrides)
      effective.set(override.permission, override.allowed);
    if (required.some((permission) => !effective.get(permission)))
      throw new ForbiddenException("Staff permission required");
    return true;
  }
}
