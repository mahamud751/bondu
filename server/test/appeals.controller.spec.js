const { ConflictException } = require('@nestjs/common');
const { AppealsController, AdminAppealsController } = require('../dist/src/moderation/appeals.controller');

describe('Moderation appeals', () => {
  it('limits unresolved appeals to prevent queue spam', async () => {
    const controller = new AppealsController({ moderationAppeal: { count: jest.fn().mockResolvedValue(3) } });
    await expect(controller.create({ sub: 'user' }, { targetType: 'ACCOUNT', reason: 'This is a sufficiently detailed appeal reason.' })).rejects.toBeInstanceOf(ConflictException);
  });
  it('notifies the user and audits a staff decision atomically', async () => {
    const tx = { moderationAppeal: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'appeal', userId: 'user', status: 'OPEN' }), update: jest.fn().mockResolvedValue({ id: 'appeal', status: 'ACCEPTED' }) }, notification: { create: jest.fn().mockResolvedValue({}) }, auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const controller = new AdminAppealsController({ $transaction: callback => callback(tx) });
    await controller.decide('appeal', { status: 'ACCEPTED', resolution: 'The appeal was accepted after independent review.' }, { sub: 'moderator', role: 'MODERATOR' });
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'user' }) }));
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});
