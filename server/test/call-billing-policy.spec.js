const { billableSeconds, settingNumber } = require('../dist/src/calls/call-billing-policy');

describe('call billing policy',()=>{
  it('supports each documented rounding method',()=>{
    expect(billableSeconds(61,300,'EXACT_SECOND')).toBe(61);
    expect(billableSeconds(61,300,'UP_30_SECONDS')).toBe(90);
    expect(billableSeconds(61,300,'UP_FULL_MINUTE')).toBe(120);
    expect(billableSeconds(12,300,'MINIMUM_ONE_MINUTE')).toBe(60);
  });
  it('never bills beyond the reserved maximum',()=>expect(billableSeconds(299,300,'UP_FULL_MINUTE')).toBe(300));
  it('does not charge a call that never connected',()=>expect(billableSeconds(0,300,'MINIMUM_ONE_MINUTE')).toBe(0));
  it('bounds numeric admin settings',()=>{expect(settingNumber({days:120},'days',7,0,90)).toBe(90);expect(settingNumber({},'days',7,0,90)).toBe(7)});
});
