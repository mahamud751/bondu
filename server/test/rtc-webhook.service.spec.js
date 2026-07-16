const { createHmac } = require('crypto');
const { ForbiddenException } = require('@nestjs/common');
const { RtcWebhookService } = require('../dist/src/rtc/rtc-webhook.service');

describe('RtcWebhookService', () => {
  const config = { get: key => ({ AGORA_WEBHOOK_SECRET: 'webhook-secret', AGORA_END_EVENT_TYPES: '104,channel_destroyed' })[key] };
  it('verifies the Agora v2 HMAC signature', () => {
    const service = new RtcWebhookService(config, {}, {}), body = Buffer.from('{"noticeId":"one"}');
    const signature = createHmac('sha256', 'webhook-secret').update(body).digest('hex');
    expect(() => service.verify(body, signature)).not.toThrow();
    expect(() => service.verify(body, '0'.repeat(64))).toThrow(ForbiddenException);
  });
  it('settles configured end events once and acknowledges duplicates', async () => {
    const record = { id: 'event', processedAt: null }, db = { rtcWebhookEvent: { upsert: jest.fn().mockResolvedValue(record), update: jest.fn().mockResolvedValue({}) } }, calls = { providerEnded: jest.fn().mockResolvedValue({}) }, service = new RtcWebhookService(config, db, calls);
    await expect(service.receive({ noticeId: 'notice', eventType: 104, payload: { channelName: 'call_123' } })).resolves.toEqual({ accepted: true, duplicate: false });
    expect(calls.providerEnded).toHaveBeenCalledWith('call_123');
    db.rtcWebhookEvent.upsert.mockResolvedValue({ ...record, processedAt: new Date() });
    await expect(service.receive({ noticeId: 'notice', eventType: 104, payload: { channelName: 'call_123' } })).resolves.toEqual({ accepted: true, duplicate: true });
    expect(calls.providerEnded).toHaveBeenCalledTimes(1);
  });
});
