const { ConfigService } = require('@nestjs/config');
const { SmsService } = require('../dist/src/sms/sms.service');

describe('SmsService', () => {
  it('normalizes Bangladesh local numbers for providers', () => {
    const service = new SmsService(new ConfigService({ SMS_DEFAULT_COUNTRY_CODE: '+880' }));
    expect(service.normalize('01712345678')).toBe('+8801712345678');
    expect(service.normalize('+14155550100')).toBe('+14155550100');
  });

  it('keeps development delivery isolated from external providers', async () => {
    const service = new SmsService(new ConfigService({ SMS_PROVIDER: 'development' }));
    await expect(service.sendOtp('01712345678','123456',5)).resolves.toEqual({provider:'development',accepted:true});
  });
});
