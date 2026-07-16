const { ChatService } = require('../dist/src/chat/chat.service');

describe('ChatService replies', () => {
  it('hydrates quoted messages without exposing unrelated records', async () => {
    const message = { id: 'new', conversationId: 'conversation', replyToId: 'old', content: 'Reply', reactions: [] };
    const db = {
      conversation: { findUnique: jest.fn().mockResolvedValue({ id: 'conversation', userOneId: 'user', userTwoId: 'other' }) },
      message: { findMany: jest.fn().mockResolvedValueOnce([message]).mockResolvedValueOnce([{ id: 'old', senderId: 'other', content: 'Original', type: 'TEXT', deletedAt: null }]) },
    };
    const service = new ChatService(db, {}, {}, {});
    await expect(service.messages('conversation', 'user')).resolves.toEqual([expect.objectContaining({ id: 'new', replyTo: expect.objectContaining({ id: 'old', content: 'Original' }) })]);
    expect(db.message.findMany.mock.calls[1][0].where).toEqual({ id: { in: ['old'] } });
  });
});
