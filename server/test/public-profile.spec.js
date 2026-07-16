const { publicProfile } = require('../dist/src/common/utilities/public-profile');

describe('publicProfile', () => {
  it('removes internal privacy policy fields and hidden presence/location', () => {
    const result=publicProfile({username:'safe',city:'Dhaka',country:'BD',online:true,lastSeenAt:new Date('2026-01-01'),hideOnline:true,hideLastSeen:true,hideAge:true,hideLocation:true,discoverable:true,messagesFromEveryone:false,callsFromEveryone:false});
    expect(result).toMatchObject({username:'safe',city:null,country:null,online:false,lastSeenAt:null});
    expect(result).not.toHaveProperty('hideOnline');expect(result).not.toHaveProperty('messagesFromEveryone');expect(result).not.toHaveProperty('callsFromEveryone');
  });
  it('preserves consented public fields',()=>{expect(publicProfile({city:'Dhaka',country:'BD',online:true,lastSeenAt:'now',hideOnline:false,hideLocation:false})).toMatchObject({city:'Dhaka',country:'BD',online:true,lastSeenAt:'now'})});
  it('allows online visibility while hiding last seen independently',()=>{expect(publicProfile({online:true,lastSeenAt:'now',hideOnline:false,hideLastSeen:true})).toMatchObject({online:true,lastSeenAt:null})});
});
