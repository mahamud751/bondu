import { useEffect } from 'react';
import { realtime } from '../api/realtime';
import { navigate } from '../navigation/navigationRef';

export function IncomingCallListener() {
  useEffect(() => {
    let client: any;
    const incoming = (call: any) => {
      const title =
        call?.caller?.profile?.displayName ??
        call?.callerName ??
        (call.callType === 'VIDEO' ? 'Video call' : 'Voice call');
      if (call.status === 'ACCEPTED') {
        navigate('ActiveCall', { callId: call.id, title });
      } else {
        navigate('IncomingCall', { callId: call.id });
      }
    };
    void realtime().then((value) => {
      client = value;
      client?.on('call:request', incoming);
      client?.on('call:accepted', (call: any) => {
        if (call?.id) {
          navigate('ActiveCall', {
            callId: call.id,
            title:
              call?.vendor?.user?.profile?.displayName ??
              call?.vendorName ??
              (call.callType === 'VIDEO' ? 'Video call' : 'Voice call'),
          });
        }
      });
    });
    return () => {
      client?.off('call:request', incoming);
      client?.off('call:accepted');
    };
  }, []);
  return null;
}
