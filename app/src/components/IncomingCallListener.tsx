import { useEffect, useRef } from 'react';
import { realtime } from '../api/realtime';
import { navigate, navigationRef } from '../navigation/navigationRef';

function currentRouteName(): string | undefined {
  if (!navigationRef.isReady()) return undefined;
  return navigationRef.getCurrentRoute()?.name;
}

function peerTitle(call: any, role: 'caller' | 'vendor' = 'caller') {
  if (role === 'vendor') {
    return (
      call?.peerNames?.vendor ??
      call?.vendor?.user?.profile?.displayName ??
      call?.vendorName ??
      (call?.callType === 'VIDEO' ? 'Video call' : 'Voice call')
    );
  }
  return (
    call?.peerNames?.caller ??
    call?.caller?.profile?.displayName ??
    call?.callerName ??
    (call?.callType === 'VIDEO' ? 'Video call' : 'Voice call')
  );
}

/**
 * Global realtime bridge so both parties open the call UI together.
 * - Callee: IncomingCall on request
 * - Both: ActiveCall on accept (Messenger-style simultaneous join)
 */
export function IncomingCallListener() {
  const activeCallId = useRef<string | undefined>(undefined);

  useEffect(() => {
    let client: any;
    let cancelled = false;

    const openActive = (call: any, title: string) => {
      const id = call?.id;
      if (!id) return;
      if (activeCallId.current === id && currentRouteName() === 'ActiveCall') return;
      activeCallId.current = id;
      navigate('ActiveCall', {
        callId: id,
        title,
        callType: call?.callType,
      });
    };

    const onRequest = (call: any) => {
      if (!call?.id) return;
      // Auto-accepted calls skip the ring UI and go straight to the room.
      if (call.status === 'ACCEPTED' || call.status === 'CONNECTING' || call.status === 'ACTIVE') {
        openActive(call, peerTitle(call, 'caller'));
        return;
      }
      if (currentRouteName() === 'IncomingCall' || currentRouteName() === 'ActiveCall') return;
      navigate('IncomingCall', { callId: call.id });
    };

    const onAccepted = (call: any) => {
      if (!call?.id) return;
      // Caller is often on OutgoingCall — that screen also handles accept.
      // Still open ActiveCall here as a backup for both roles.
      const route = currentRouteName();
      if (route === 'OutgoingCall') return;
      openActive(call, peerTitle(call, route === 'IncomingCall' ? 'caller' : 'vendor'));
    };

    const onEnded = (call: any) => {
      if (call?.id && activeCallId.current === call.id) {
        activeCallId.current = undefined;
      }
    };

    void realtime().then((value) => {
      if (cancelled) return;
      client = value;
      client?.on('call:request', onRequest);
      client?.on('call:accepted', onAccepted);
      client?.on('call:rejected', onEnded);
      client?.on('call:cancelled', onEnded);
      client?.on('call:ended', onEnded);
    });

    return () => {
      cancelled = true;
      client?.off('call:request', onRequest);
      client?.off('call:accepted', onAccepted);
      client?.off('call:rejected', onEnded);
      client?.off('call:cancelled', onEnded);
      client?.off('call:ended', onEnded);
    };
  }, []);

  return null;
}
