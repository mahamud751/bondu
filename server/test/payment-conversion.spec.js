const { ConfigService } = require('@nestjs/config');
const { PaymentsService } = require('../dist/src/payments/payments.service');

describe('payment point conversion snapshot',()=>{
  it('reads a validated conversion setting and exposes it to checkout clients',async()=>{
    const db={setting:{findUnique:jest.fn().mockResolvedValue({value:{currencyMinorUnitsPerPoint:125,currency:'BDT'}})}};
    const service=new PaymentsService(db,new ConfigService({}),{}, {},{configured:false});
    await expect(service.conversion()).resolves.toEqual({minorPerPoint:125,currency:'BDT'});
    await expect(service.instructions()).resolves.toMatchObject({currency:'BDT',currencyMinorUnitsPerPoint:125});
  });
  it('uses a safe one-taka fallback for missing or malformed settings',async()=>{
    const db={setting:{findUnique:jest.fn().mockResolvedValue({value:{currencyMinorUnitsPerPoint:-1,currency:'bad'}})}};
    const service=new PaymentsService(db,new ConfigService({}),{}, {},{configured:false});
    await expect(service.conversion()).resolves.toEqual({minorPerPoint:100,currency:'BDT'});
  });
});
