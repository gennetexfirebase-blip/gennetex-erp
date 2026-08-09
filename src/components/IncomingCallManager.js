import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import VideoCallModal from './VideoCallModal';
import CallScreen from './CallScreen';
import * as callApi from '../services/callService';
import { startIncomingCallAlert, stopIncomingCallAlert } from '../services/callAlertService';
import {
  isNativeIncomingCallAvailable,
  showNativeIncomingCall,
  hideNativeIncomingCall,
} from '../services/nativeIncomingCallService';
import { incomingCallBridge } from '../lib/incomingCallBridge';

export default function IncomingCallManager() {
  const { isCloud, currentUser } = useApp();
  const [incoming, setIncoming] = useState(null);
  const [inCall, setInCall] = useState(null);
  const incomingRef = useRef(null);
  const useNative = isNativeIncomingCallAvailable();

  useEffect(() => {
    incomingRef.current = incoming;
  }, [incoming]);

  // Supabase realtime — над руу ирж буй дуудлага
  useEffect(() => {
    if (!isCloud || !currentUser?.id) return;
    const unsub = callApi.subscribeIncomingCalls(currentUser.id, async (call) => {
      if (call.status !== 'ringing') return;
      const fresh = Date.now() - new Date(call.created_at).getTime() < 60000;
      if (!fresh) return;
      setIncoming(call);
      if (useNative) {
        // Утасны жинхэнэ дуудлагын дэлгэц (өөрийн ringtone-той)
        showNativeIncomingCall(call);
      } else {
        await startIncomingCallAlert(call.caller_name);
      }
    });
    return () => {
      unsub();
      stopIncomingCallAlert();
    };
  }, [isCloud, currentUser?.id, useNative]);

  // Native дуудлагын дэлгэцээс ирэх answer / decline / timeout
  useEffect(() => {
    const unsub = incomingCallBridge.subscribe(({ type, data }) => {
      // incomingRef хоосон байвал (push-аар ирсэн) payload-оос сэргээнэ
      const call =
        incomingRef.current ||
        (data?.callId
          ? { id: data.callId, room: data.room, caller_id: data.callerId, caller_name: data.callerName }
          : null);
      if (!call) return;
      if (type === 'answer') {
        acceptCall(call);
      } else {
        declineCall(call, type === 'timeout' ? 'ended' : 'declined');
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!incoming) stopIncomingCallAlert();
  }, [incoming]);

  const acceptCall = async (call) => {
    if (!call) return;
    await stopIncomingCallAlert();
    hideNativeIncomingCall();
    try {
      await callApi.setCallStatus(call.id, 'accepted');
    } catch (e) {}
    setInCall(call);
    setIncoming(null);
  };

  const declineCall = async (call, status = 'declined') => {
    if (!call) return;
    await stopIncomingCallAlert();
    hideNativeIncomingCall();
    try {
      await callApi.setCallStatus(call.id, status);
    } catch (e) {}
    setIncoming(null);
  };

  const endCall = async () => {
    if (inCall) {
      try {
        await callApi.setCallStatus(inCall.id, 'ended');
      } catch (e) {}
    }
    setInCall(null);
  };

  const caller = incoming?.caller_name || 'Ажилтан';

  return (
    <>
      {/* Native ажиллахгүй үед (iOS г.м) л апп доторх дуудлагын дэлгэц харуулна */}
      {!useNative ? (
        <CallScreen
          visible={!!incoming}
          mode="incoming"
          name={caller}
          video
          onAccept={() => acceptCall(incoming)}
          onDecline={() => declineCall(incoming, 'declined')}
        />
      ) : null}

      <VideoCallModal
        visible={!!inCall}
        room={inCall ? `gennetex-${inCall.room}` : ''}
        name={currentUser?.name}
        onClose={endCall}
      />
    </>
  );
}
