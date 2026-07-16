const { AdminController } = require('../dist/src/admin/admin.controller');

describe('Admin notification campaigns',()=>{
  it('creates queued notifications and an audit event in one transaction',async()=>{
    const tx={notificationCampaign:{create:jest.fn().mockResolvedValue({id:'campaign',recipientCount:2})},notification:{createMany:jest.fn().mockResolvedValue({count:2})},auditLog:{create:jest.fn().mockResolvedValue({})}},db={user:{findMany:jest.fn().mockResolvedValue([{id:'one'},{id:'two'}])},$transaction:callback=>callback(tx)},controller=new AdminController(db,{},{});
    await expect(controller.campaign({title:'A useful update',body:'A clear message for the community.',type:'PROMOTIONAL_OFFER'},{sub:'admin',role:'ADMIN'})).resolves.toMatchObject({id:'campaign'});
    expect(tx.notification.createMany).toHaveBeenCalledWith({data:expect.arrayContaining([expect.objectContaining({userId:'one',data:{campaignId:'campaign'}})])});expect(tx.auditLog.create).toHaveBeenCalled();
  });
});
