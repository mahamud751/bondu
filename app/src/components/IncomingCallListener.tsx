import{useEffect}from'react';
import{realtime}from'../api/realtime';
import{navigate}from'../navigation/navigationRef';
export function IncomingCallListener(){useEffect(()=>{let client:any;const incoming=(call:any)=>navigate(call.status==='ACCEPTED'?'ActiveCall':'IncomingCall',call.status==='ACCEPTED'?{callId:call.id,title:call.callType==='VIDEO'?'Video call':'Voice call'}:{callId:call.id});void realtime().then(value=>{client=value;client?.on('call:request',incoming)});return()=>client?.off('call:request',incoming)},[]);return null}
