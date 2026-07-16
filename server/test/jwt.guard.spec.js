const {
  ForbiddenException,
  UnauthorizedException,
} = require('@nestjs/common');
const { JwtGuard } = require('../dist/src/common/guards/jwt.guard');

const context = (request = { headers: { authorization: 'Bearer token' } }) => ({
  getHandler: () => 'handler',
  getClass: () => 'class',
  switchToHttp: () => ({ getRequest: () => request }),
});

describe('JwtGuard account state', () => {
  const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user', role: 'USER' }) };

  it('uses the current database role instead of a stale token role', async () => {
    const request = { headers: { authorization: 'Bearer token' } };
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user',
          role: 'VENDOR',
          status: 'ACTIVE',
        }),
      },
    };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const guard = new JwtGuard(jwt, db, reflector);

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request.user.role).toBe('VENDOR');
  });

  it('rejects a suspended account without masking it as a token error', async () => {
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user',
          role: 'USER',
          status: 'SUSPENDED',
        }),
      },
    };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const guard = new JwtGuard(jwt, db, reflector);

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a suspended account only on explicitly marked routes', async () => {
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user',
          role: 'USER',
          status: 'SUSPENDED',
        }),
      },
    };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const guard = new JwtGuard(jwt, db, reflector);

    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('rejects a token whose account was deleted', async () => {
    const db = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const reflector = { getAllAndOverride: jest.fn() };
    const guard = new JwtGuard(jwt, db, reflector);

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
