const { ConfigService } = require('@nestjs/config');
const { UnauthorizedException } = require('@nestjs/common');
const { createHash } = require('crypto');
const { ProviderAuthService } = require('../dist/src/auth/provider-auth.service');

describe('ProviderAuthService nonce enforcement',()=>{
  it('issues a random nonce while persisting only its hash',async()=>{const db={oAuthNonce:{create:jest.fn().mockResolvedValue({})}},service=new ProviderAuthService(db,new ConfigService({})),result=await service.issueNonce();expect(result.nonce).toHaveLength(43);expect(db.oAuthNonce.create).toHaveBeenCalledWith({data:expect.objectContaining({hash:createHash('sha256').update(result.nonce).digest('hex')})});expect(JSON.stringify(db.oAuthNonce.create.mock.calls)).not.toContain(result.nonce)});
  it('atomically consumes a valid provider nonce once',async()=>{const db={oAuthNonce:{updateMany:jest.fn().mockResolvedValue({count:1})}},service=new ProviderAuthService(db,new ConfigService({})),raw='one-time-value',claim=createHash('sha256').update(raw).digest('hex');await expect(service.consumeNonce(raw,claim)).resolves.toBeUndefined();expect(db.oAuthNonce.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({usedAt:null})}))});
  it('allows Google challenges without a token nonce claim but still consumes them',async()=>{const db={oAuthNonce:{updateMany:jest.fn().mockResolvedValue({count:1})}},service=new ProviderAuthService(db,new ConfigService({}));await expect(service.consumeNonce('google-challenge',undefined,false)).resolves.toBeUndefined();expect(db.oAuthNonce.updateMany).toHaveBeenCalledTimes(1)});
  it('rejects replayed or mismatched nonces',async()=>{const db={oAuthNonce:{updateMany:jest.fn().mockResolvedValue({count:0})}},service=new ProviderAuthService(db,new ConfigService({}));await expect(service.consumeNonce('raw','wrong')).rejects.toBeInstanceOf(UnauthorizedException);await expect(service.consumeNonce('raw',createHash('sha256').update('raw').digest('hex'))).rejects.toBeInstanceOf(UnauthorizedException)});
});
