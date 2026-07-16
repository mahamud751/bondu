const { BadRequestException } = require('@nestjs/common');
const { AdminController } = require('../dist/src/admin/admin.controller');

describe('Admin financial setting validation',()=>{
  const controller=new AdminController({}, {}, {});
  it('accepts every supported call rounding policy',()=>{
    for(const method of ['EXACT_SECOND','UP_30_SECONDS','UP_FULL_MINUTE','MINIMUM_ONE_MINUTE'])expect(()=>controller.validateSetting('BILLING_ROUNDING',{method})).not.toThrow();
  });
  it('rejects unsafe commission and hold configurations',()=>{
    expect(()=>controller.validateSetting('DEFAULT_VENDOR_COMMISSION',{percent:101})).toThrow(BadRequestException);
    expect(()=>controller.validateSetting('EARNING_HOLD_DAYS',{days:-1})).toThrow(BadRequestException);
  });
  it('requires integer minor-unit conversion and a currency code',()=>expect(()=>controller.validateSetting('POINT_CONVERSION',{currencyMinorUnitsPerPoint:100.5,currency:'taka'})).toThrow(BadRequestException));
  it('rejects a withdrawal maximum below its minimum',()=>expect(()=>controller.validateSetting('WITHDRAWAL_RULES',{minimum:500,maximumDaily:100,feePoints:0,requiredAccountAgeDays:0,requiredCompletedCalls:0,requiredIdentityVerification:false})).toThrow(BadRequestException));
});
