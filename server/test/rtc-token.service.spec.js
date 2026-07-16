const { RtcTokenService } = require('../dist/src/rtc/rtc-token.service');
describe('RtcTokenService', () => {
  test('labels credential-free tokens as development only', () => { const service = new RtcTokenService({ get: key => key === 'RTC_DEVELOPMENT_SECRET' ? 'test-secret' : undefined }); const access = service.issue('call-1', 'user-1', 60); expect(access.provider).toBe('DEVELOPMENT'); expect(access.appId).toBeNull(); expect(access.channelName).toBe('call_call-1'); expect(access.token).toMatch(/^[a-f0-9]{64}$/); });
  test('generates an Agora access token when credentials exist', () => { const config = { get: key => ({ AGORA_APP_ID: '0'.repeat(32), AGORA_APP_CERTIFICATE: '1'.repeat(32) })[key] }; const access = new RtcTokenService(config).issue('call-2', 'user-2', 60); expect(access.provider).toBe('AGORA'); expect(access.appId).toBe('0'.repeat(32)); expect(access.token.length).toBeGreaterThan(100); expect(access.userAccount).toBe('user-2'); });
});
