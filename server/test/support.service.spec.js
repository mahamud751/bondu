const { ForbiddenException,NotFoundException } = require('@nestjs/common');
const { SupportService } = require('../dist/src/support/support.service');

describe('SupportService',()=>{
  it('does not reveal tickets owned by another user',async()=>{const db={supportTicket:{findUnique:jest.fn().mockResolvedValue({id:'ticket',userId:'other',status:'OPEN'})}};const service=new SupportService(db);await expect(service.replyUser('me','ticket',{body:'A valid support reply'})).rejects.toBeInstanceOf(NotFoundException)});
  it('rejects evidence that is not an owned ready private report asset',async()=>{const db={fileAsset:{count:jest.fn().mockResolvedValue(0)}};const service=new SupportService(db);await expect(service.create('me',{subject:'Payment issue',category:'PAYMENT',body:'My payment did not arrive.',evidenceIds:['11111111-1111-4111-8111-111111111111']})).rejects.toBeInstanceOf(ForbiddenException);expect(db.fileAsset.count).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({ownerId:'me',category:'REPORT',status:'READY',visibility:'PRIVATE'})}))});
  it('always excludes internal staff notes from the user thread',async()=>{const db={supportTicket:{findMany:jest.fn().mockResolvedValue([])}};const service=new SupportService(db);await service.mine('me');expect(db.supportTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({include:{messages:expect.objectContaining({where:{internal:false}})}}))});
});
