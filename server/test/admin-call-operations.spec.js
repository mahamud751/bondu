const { AdminController } = require('../dist/src/admin/admin.controller');

describe('Admin call operations',()=>{
  it('terminates through the settlement service and writes an audit record',async()=>{
    const db={auditLog:{create:jest.fn().mockResolvedValue({})}},calls={terminateByAdmin:jest.fn().mockResolvedValue({id:'call',status:'TERMINATED',disconnectReason:'TERMINATED_BY_ADMIN'})};
    const controller=new AdminController(db,{}, {},calls);
    await expect(controller.terminateCall('call',{sub:'admin',role:'ADMIN'})).resolves.toMatchObject({status:'TERMINATED'});
    expect(calls.terminateByAdmin).toHaveBeenCalledWith('call','admin');
    expect(db.auditLog.create).toHaveBeenCalledWith({data:expect.objectContaining({actorId:'admin',action:'CALL_TERMINATED_BY_ADMIN',entityId:'call'})});
  });
});
