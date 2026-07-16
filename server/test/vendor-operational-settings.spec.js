const { VendorsController } = require('../dist/src/vendors/vendors.controller');

describe('Vendor operational settings',()=>{
  it('forces a creator offline while on break and normalizes an unlimited daily cap',async()=>{
    const db={vendorProfile:{update:jest.fn().mockResolvedValue({breakActive:true,availableForCall:false})}};
    const controller=new VendorsController(db,{});
    await controller.operationalSettings({sub:'vendor-user'},{breakActive:true,autoAcceptCalls:false,maximumDailyCalls:0,minimumCallerBalance:250});
    expect(db.vendorProfile.update).toHaveBeenCalledWith(expect.objectContaining({where:{userId:'vendor-user'},data:{breakActive:true,autoAcceptCalls:false,maximumDailyCalls:null,minimumCallerBalance:250,availableForCall:false}}));
  });

  it('clears break mode when a creator explicitly goes online',async()=>{
    const db={vendorProfile:{update:jest.fn().mockResolvedValue({availableForCall:true})}};
    const controller=new VendorsController(db,{});
    await controller.availability({sub:'vendor-user'},{available:true});
    expect(db.vendorProfile.update).toHaveBeenCalledWith({where:{userId:'vendor-user'},data:{availableForCall:true,breakActive:false}});
  });
});
