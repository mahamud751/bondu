const { ConflictException } = require('@nestjs/common');
const { CallsService } = require('../dist/src/calls/calls.service');

describe('Call participant events',()=>{
  it('persists an allowed event only for an active participant',async()=>{
    const db={callSession:{findUnique:jest.fn().mockResolvedValue({id:'call',callerId:'caller',status:'ACTIVE',vendor:{userId:'vendor'}})},callParticipantEvent:{create:jest.fn().mockResolvedValue({id:'event'})}};
    const service=new CallsService(db,{}, {}, {},{});await expect(service.participantEvent('call','caller','MUTED',{source:'native'})).resolves.toEqual({id:'event'});expect(db.callParticipantEvent.create).toHaveBeenCalledWith({data:{callId:'call',userId:'caller',eventType:'MUTED',metadata:{source:'native'}}});
  });
  it('rejects state events after a call is complete',async()=>{
    const db={callSession:{findUnique:jest.fn().mockResolvedValue({id:'call',callerId:'caller',status:'COMPLETED',vendor:{userId:'vendor'}})},callParticipantEvent:{create:jest.fn()}};const service=new CallsService(db,{}, {}, {},{});await expect(service.participantEvent('call','caller','MUTED')).rejects.toBeInstanceOf(ConflictException);expect(db.callParticipantEvent.create).not.toHaveBeenCalled();
  });
  it('returns call details only to a participant and includes a safe caller profile',async()=>{
    const call={id:'call',callerId:'caller',vendor:{userId:'vendor'}};const db={callSession:{findUnique:jest.fn().mockResolvedValue(call)},user:{findUnique:jest.fn().mockResolvedValue({id:'caller',profile:{displayName:'Member'}})}};const service=new CallsService(db,{}, {}, {},{});
    await expect(service.detail('call','vendor')).resolves.toMatchObject({id:'call',caller:{profile:{displayName:'Member'}}});
    await expect(service.detail('call','outsider')).rejects.toBeDefined();
  });
});
