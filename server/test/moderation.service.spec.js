const { ForbiddenException } = require('@nestjs/common');
const { ModerationService } = require('../dist/src/moderation/moderation.service');
const tx = () => ({ blockedTerm: { findMany: jest.fn().mockResolvedValue([]) }, moderationEvent: { create: jest.fn().mockResolvedValue({}) } });
describe('ModerationService', () => {
  const service = new ModerationService({});
  test('allows ordinary conversation', async () => { const client = tx(); await expect(service.assertMessageAllowed(client, 'user-1', 'Hello, how was your day?')).resolves.toBeUndefined(); expect(client.moderationEvent.create).not.toHaveBeenCalled(); });
  test('blocks phone-number sharing and records evidence metadata', async () => { const client = tx(); await expect(service.assertMessageAllowed(client, 'user-1', 'Call me on 01712345678')).rejects.toBeInstanceOf(ForbiddenException); expect(client.moderationEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ category: 'PHONE_NUMBER', action: 'BLOCKED' }) })); });
  test('blocks configured terms case-insensitively', async () => { const client = tx(); client.blockedTerm.findMany.mockResolvedValue([{ term: 'outside deal', category: 'EXTERNAL_PAYMENT', severity: 'BLOCK' }]); await expect(service.assertMessageAllowed(client, 'user-1', 'Let us make an OUTSIDE DEAL')).rejects.toBeInstanceOf(ForbiddenException); });
});
