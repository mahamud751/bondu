import { SetMetadata } from "@nestjs/common";
import { StaffPermissionKey } from "@prisma/client";

export const PERMISSIONS_KEY = "staff_permissions";
export const RequirePermissions = (...permissions: StaffPermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
