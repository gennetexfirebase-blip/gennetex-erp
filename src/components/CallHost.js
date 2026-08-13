import React from 'react';
import { useCall } from '../context/CallContext';
import CallScreen from './CallScreen';
import ActiveCallScreen from './ActiveCallScreen';
import { CALL_STATE } from '../services/voipCallService';
import { isNativeIncomingCallAvailable } from '../services/nativeIncomingCallService';

/**
 * Дуудлагын дэлгэцүүдийг апп-ын хамгийн дээд түвшинд байрлуулна.
 *
 * Навигацийн модалуудаас ДЭЭР байх ёстой — эсрэгээр бол нээлттэй модал
 * дуудлагын дэлгэцийг халхлана.
 */
export default function CallHost() {
  const {
    call,
    incoming,
    localStream,
    remoteStream,
    muted,
    speakerOn,
    cameraOn,
    RTCView,
    answerCall,
    rejectCall,
    hangUp,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    switchCamera,
  } = useCall();

  // Android дээр системийн бүтэн дэлгэцийн дуудлага гардаг тул апп доторх
  // хувилбарыг давхар харуулбал хоёр дэлгэц харагдана.
  const showInAppIncoming = !isNativeIncomingCallAvailable();

  const outgoingRinging =
    call?.role === 'caller' &&
    (call.state === CALL_STATE.RINGING || call.state === CALL_STATE.INITIATING);

  return (
    <>
      {showInAppIncoming ? (
        <CallScreen
          visible={!!incoming}
          mode="incoming"
          name={incoming?.peer?.name || 'Ажилтан'}
          video={incoming?.type === 'video'}
          onAccept={() => answerCall(null)}
          onDecline={() => rejectCall(null)}
        />
      ) : null}

      {/* Дуудаж байх үеийн дэлгэц — цуцлах боломжтой */}
      <CallScreen
        visible={!!outgoingRinging}
        mode="outgoing"
        name={call?.peer?.name || 'Ажилтан'}
        status="Дуудаж байна..."
        video={call?.type === 'video'}
        onCancel={hangUp}
        onDecline={hangUp}
      />

      <ActiveCallScreen
        visible={!!call && !outgoingRinging}
        RTCView={RTCView}
        peerName={call?.peer?.name || 'Ажилтан'}
        peerAvatar={call?.peer?.avatar}
        video={call?.type === 'video'}
        state={call?.state || CALL_STATE.CONNECTING}
        localStream={localStream}
        remoteStream={remoteStream}
        muted={muted}
        speakerOn={speakerOn}
        cameraOn={cameraOn}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
        onToggleCamera={toggleCamera}
        onSwitchCamera={switchCamera}
        onEnd={hangUp}
      />
    </>
  );
}
