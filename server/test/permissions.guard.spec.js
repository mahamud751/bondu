const { ForbiddenException } = require('@nestjs/common');
const { StaffPermissionKey } = require('@prisma/client');
const { PermissionsGuard } = require('../dist/src/common/guards/permissions.guard');

const context = (user) => ({
  getHandler: () => 'handler',
  getClass: () => 'class',
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
});

describe('PermissionsGuard', () => {
  const reflector = (required) => ({ getAllAndOverride: jest.fn().mockReturnValue(required) });

  it('allows a role default when no override exists', async () => {
    const db = { staffPermission: { findMany: jest.fn().mockResolvedValue([]) } };
    const guard = new PermissionsGuard(reflector([StaffPermissionKey.MANAGE_FINANCE]), db);
    await expect(guard.canActivate(context({ sub: 'finance', role: 'FINANCE' }))).resolves.toBe(true);
  });

  it('honours an explicit revocation over a role default', async () => {
    const db = { staffPermission: { findMany: jest.fn().mockResolvedValue([{ permission: StaffPermissionKey.MANAGE_FINANCE, allowed: false }]) } };
    const guard = new PermissionsGuard(reflector([StaffPermissionKey.MANAGE_FINANCE]), db);
    await expect(guard.canActivate(context({ sub: 'finance', role: 'FINANCE' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('honours an explicit grant outside the role defaults', async () => {
    const db = { staffPermission: { findMany: jest.fn().mockResolvedValue([{ permission: StaffPermissionKey.EXPORT_DATA, allowed: true }]) } };
    const guard = new PermissionsGuard(reflector([StaffPermissionKey.EXPORT_DATA]), db);
    await expect(guard.canActivate(context({ sub: 'moderator', role: 'MODERATOR' }))).resolves.toBe(true);
  });
});
