const argon2 = require('argon2');
const { BadRequestException } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { AuthService } = require('../dist/src/auth/auth.service');
const { EmailService } = require('../dist/src/notifications/email.service');

describe('Email authentication', () => {
  it('keeps outbound email disabled unless a provider is configured', () => {
    const service = new EmailService(new ConfigService({ EMAIL_PROVIDER: 'disabled' }));
    expect(service.configured()).toBe(false);
  });

  it('creates a hashed development verification code without storing plaintext', async () => {
    const db = { emailCode: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({}) } };
    const email = { configured: jest.fn().mockReturnValue(false), send: jest.fn() };
    const service = new AuthService(db, {}, new ConfigService({ NODE_ENV: 'development' }), {}, {}, email);
    const result = await service.sendEmailCode(' Member@Example.com ', 'REGISTER');
    expect(result.developmentCode).toMatch(/^\d{6}$/);
    const data = db.emailCode.create.mock.calls[0][0].data;
    expect(data.email).toBe('member@example.com');
    expect(data.codeHash).not.toContain(result.developmentCode);
    await expect(argon2.verify(data.codeHash, result.developmentCode)).resolves.toBe(true);
  });

  it('increments attempts for an incorrect code and rejects it', async () => {
    const db = { emailCode: { findFirst: jest.fn().mockResolvedValue({ id: 'code', attempts: 0, expiresAt: new Date(Date.now()+60_000), codeHash: await argon2.hash('123456') }), update: jest.fn().mockResolvedValue({}) } };
    const service = new AuthService(db, {}, new ConfigService({}), {}, {}, {});
    await expect(service.verifyEmailCode('member@example.com', 'REGISTER', '654321')).rejects.toBeInstanceOf(BadRequestException);
    expect(db.emailCode.update).toHaveBeenCalledWith({ where: { id: 'code' }, data: { attempts: { increment: 1 } } });
  });
});
