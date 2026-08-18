import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { useApp } from './AppContext';
import { isExpoGo } from '../lib/runtimeEnv';
import * as voip from '../services/voipCallService';
import { CALL_STATE, CALL_TEXT, isTerminal, toUiState } from '../services/voipCallService';
import {
  isWebRtcAvailable,
  openSignaling,
  createCallSession,
  hasTurn,
} from '../services/webrtcService';
import { startIncomingCallAlert, stopIncomingCallAlert } from '../services/callAlertService';
import {
  isNativeIncomingCallAvailable,
  showNativeIncomingCall,
  hideNativeIncomingCall,
} from '../services/nativeIncomingCallService';
import { incomingCallBridge } from '../lib/incomingCallBridge';
import { navigationRef } from '../lib/navigationRef';

/**
 * Дуудлагын нэгдсэн удирдлага.
 *
 * ЯАГААД ДЭЛГЭЦ БҮР ӨӨРӨӨ БИШ, ЭНД ТӨВЛӨРСӨН:
 *   Дуудлага нь дэлгэцээс АМЬД. Хэрэглэгч чатаас залгаад өөр цэс рүү орж
 *   болно; ирж буй дуудлага нь аль ч дэлгэц дээр гарах ёстой. Хэрэв
 *   төлөвийг дэлгэц эзэмшвэл дэлгэц unmount болоход микрофон нээлттэй
 *   үлдэж, дуудлага "агаарт" үлдэнэ.
 *
 * НЭГ ЛЕ ДУУДЛАГА: `callRef` нэг л дуудлага барина. Сервер тал ч мөн
 *   `call_start` дотор завгүй эсэхийг шалгадаг — хоёр давхар хамгаалалт.
 */

const CallContext = createContext(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall-ийг CallProvider дотор ашиглана');
  return ctx;
}

/** Дуудлага хариулаагүй бол автоматаар таслах хугацаа. */
const RING_TIMEOUT_MS = 45_000;

/**
 * Аваагүй дуудлагын мэдэгдэл.
 *
 * Дуудлагын суваг (`calls`) нь дуугарах зориулалттай тул энд ашиглахгүй —
 * аваагүй дуудлага дахин дуугарах ёсгүй, зөвхөн жагсаалтад үлдэнэ.
 */
async function notifyMissedCall(name, type) {
  const Notifications = require('expo-notifications');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Аваагүй дуудлага',
      body: `${name || 'Ажилтан'} ${type === 'video' ? 'видео' : 'дуут'} дуудлага хийсэн`,
      data: { type: 'missed_call', screen: 'CallHistory' },
      sound: null,
    },
    trigger: null,
  });
}

function inCallManager() {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line global-require
    return require('react-native-incall-manager').default;
  } catch (e) {
    return null;
  }
}

export function CallProvider({ children }) {
  const { currentUser, isCloud } = useApp();
  const meId = currentUser?.id;

  const [call, setCall] = useState(null);      // { id, role, peer, type, state }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);

  const sessionRef = useRef(null);     // createCallSession()-ийн үр дүн
  const signalRef = useRef(null);      // openSignaling()-ийн үр дүн
  const callRef = useRef(null);        // одоогийн дуудлага (callback дотор шинэ утга авах)
  const updatesRef = useRef(null);     // subscribeCall unsubscribe
  const timeoutRef = useRef(null);
  const rtcRef = useRef(null);         // RTCView компонент

  const useNativeUi = isNativeIncomingCallAvailable();

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  // RTCView-г нэг л удаа ачаална — native модуль байхгүй бол null үлдэнэ.
  if (rtcRef.current === null && isWebRtcAvailable()) {
    try {
      // eslint-disable-next-line global-require
      rtcRef.current = require('react-native-webrtc').RTCView;
    } catch (e) {
      rtcRef.current = false;
    }
  }

  // -------------------------------------------------------------------------
  // Цэвэрлэгээ
  // -------------------------------------------------------------------------

  /**
   * Бүх нөөцийг суллана.
   *
   * Дараалал чухал: эхлээд дуу зогсоох, дараа нь media track хаах. Эсрэгээр
   * хийвэл богино хугацаанд микрофон нээлттэй, гэрэл асаалттай үлдэнэ.
   */
  const teardown = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopIncomingCallAlert();
    hideNativeIncomingCall();

    const icm = inCallManager();
    try {
      icm?.stopRingtone?.();
      icm?.stopRingback?.();
      icm?.stop?.();
    } catch (e) {}

    try {
      sessionRef.current?.close();
    } catch (e) {}
    sessionRef.current = null;

    try {
      signalRef.current?.close();
    } catch (e) {}
    signalRef.current = null;

    if (updatesRef.current) {
      updatesRef.current();
      updatesRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setSpeakerOn(false);
    setCameraOn(true);
  }, []);

  /** Дуудлагыг дуусгаад дэлгэцээс алга болгоно. */
  const finish = useCallback(
    (state, message) => {
      teardown();
      setCall(null);
      callRef.current = null;
      if (message) Alert.alert('Дуудлага', message);
      else if (state && state !== CALL_STATE.ENDED && CALL_TEXT[state]) {
        Alert.alert('Дуудлага', CALL_TEXT[state]);
      }
    },
    [teardown]
  );

  useEffect(() => teardown, [teardown]);

  // -------------------------------------------------------------------------
  // WebRTC session
  // -------------------------------------------------------------------------

  const buildSession = useCallback(
    async (callId, video, signaling) => {
      const session = await createCallSession({
        video,
        signaling,
        onRemoteStream: (stream) => setRemoteStream(stream),
        onStateChange: (connState) => {
          if (connState === 'connected') {
            setCall((c) => (c ? { ...c, state: CALL_STATE.CONNECTED } : c));
            const icm = inCallManager();
            try {
              icm?.stopRingback?.();
              // Видео бол чанга яригч анхдагч, дуут бол чихэвч —
              // утас чихэнд байхад чанга яригч руу гарах нь эвгүй.
              icm?.setForceSpeakerphoneOn?.(video);
            } catch (e) {}
            setSpeakerOn(video);
          } else if (connState === 'failed') {
            // ICE restart аль хэдийн оролдсон. Энд хүрсэн бол сүлжээ
            // бүрэн тасарсан — хэрэглэгчийг чимээгүй хүлээлгэхгүй.
            voip.failCall(callId, 'ice_failed').catch(() => {});
            finish(CALL_STATE.FAILED, 'Сүлжээний холболт тасарлаа.');
          }
        },
      });
      sessionRef.current = session;
      setLocalStream(session.localStream);
      return session;
    },
    [finish]
  );

  // -------------------------------------------------------------------------
  // Гарах дуудлага
  // -------------------------------------------------------------------------

  const placeCall = useCallback(
    async (peer, type = 'audio') => {
      if (!isCloud) {
        Alert.alert('Дуудлага', 'Дуудлага хийхэд интернэт холболт шаардлагатай.');
        return;
      }
      if (!peer?.id) {
        Alert.alert('Дуудлага', 'Хэн рүү залгахаа олсонгүй.');
        return;
      }
      if (callRef.current) {
        Alert.alert('Дуудлага', 'Та аль хэдийн дуудлага дээр байна.');
        return;
      }
      if (!isWebRtcAvailable()) {
        // Expo Go бол Expo-гийн БЭЛЭН апп — танай төслийн native хэсгүүд
        // (WebRTC) түүн дотор байхгүй. Энэ нь алдаа биш, зарчмын
        // хязгаарлалт тул юу хийхийг нь тодорхой хэлнэ.
        Alert.alert(
          'Дуудлага',
          isExpoGo
            ? 'Expo Go дээр дуудлага ажиллахгүй.\n\n'
              + 'Дуудлага нь native модуль (WebRTC) шаарддаг бөгөөд Expo Go '
              + 'дотор тэр байдаггүй.\n\n'
              + 'Шийдэл: суулгасан APK-гаа ашиглах, эсвэл нэг удаа\n'
              + '"npx expo run:android" ажиллуулж development build хийх.'
            : 'Дуудлагын модуль энэ хувилбарт байхгүй байна.\n\n'
              + 'APK эсвэл development build суулгана уу.'
        );
        return;
      }

      const video = type === 'video';
      let started;
      try {
        started = await voip.startCall(peer.id, type);
      } catch (e) {
        Alert.alert('Дуудлага', e.message || 'Залгахад алдаа гарлаа.');
        return;
      }

      const row = started.call;
      const state = {
        id: row.id,
        role: 'caller',
        peer,
        type,
        state: CALL_STATE.RINGING,
      };
      setCall(state);
      callRef.current = state;

      // Хүлээн авагчид ямар ч төхөөрөмж бүртгэлгүй бол шууд мэдэгдэнэ
      if (started.notify?.reason === 'unreachable') {
        finish(CALL_STATE.FAILED, 'Хэрэглэгч холбогдох боломжгүй байна.');
        return;
      }

      const icm = inCallManager();
      try {
        icm?.start?.({ media: video ? 'video' : 'audio', auto: true });
        icm?.startRingback?.('_BUNDLE_');
      } catch (e) {}

      // --- Signaling ---
      // Хүлээн авагч "бэлэн" гэж мэдэгдмэгц offer илгээнэ. Ингэснээр offer
      // нь хэн ч сонсоогүй байхад алдагдахгүй. Мэдэгдэл давхардвал (сүлжээ
      // тасарч дахин холбогдох г.м) хоёр дахь offer үүсгэхгүй.
      let offerSent = false;
      const signaling = openSignaling(row.id, {
        onRinging: async () => {
          if (offerSent) return;
          offerSent = true;
          try {
            const session = sessionRef.current || (await buildSession(row.id, video, signaling));
            await session.createOffer();
          } catch (e) {
            offerSent = false;
            voip.failCall(row.id, 'offer_failed').catch(() => {});
            finish(CALL_STATE.FAILED, 'Дуудлага эхлүүлэхэд алдаа гарлаа.');
          }
        },
        onAnswer: async (payload) => {
          try {
            await sessionRef.current?.acceptAnswer(payload);
          } catch (e) {}
        },
        onIceCandidate: (payload) => {
          sessionRef.current?.addIceCandidate(payload?.candidate);
        },
      });
      signalRef.current = signaling;

      // --- Серверийн төлөв сонсох ---
      updatesRef.current = voip.subscribeCall(row.id, (updated) => {
        const ui = toUiState(updated.status);
        if (updated.status === 'accepted') {
          setCall((c) => (c ? { ...c, state: CALL_STATE.CONNECTING } : c));
          return;
        }
        if (isTerminal(updated.status)) {
          finish(ui);
        }
      });

      // --- Хариулаагүй бол таслах ---
      timeoutRef.current = setTimeout(() => {
        voip.cancelCall(row.id).catch(() => {});
        finish(CALL_STATE.MISSED, 'Хэрэглэгч хариулсангүй.');
      }, RING_TIMEOUT_MS);

      if (!hasTurn()) {
        // Чимээгүй бүтэлгүйтэхээс сэргийлж бүртгэлд үлдээнэ.
        console.warn('[call] TURN тохируулаагүй — хатуу NAT ард холбогдохгүй байж болно.');
      }
    },
    [isCloud, buildSession, finish]
  );

  // -------------------------------------------------------------------------
  // Ирэх дуудлага
  // -------------------------------------------------------------------------

  const [incoming, setIncoming] = useState(null);
  const incomingRef = useRef(null);
  useEffect(() => {
    incomingRef.current = incoming;
  }, [incoming]);

  useEffect(() => {
    if (!isCloud || !meId) return undefined;

    const unsub = voip.subscribeIncoming(meId, async (row) => {
      // Хуучирсан дуудлагыг гаргахгүй — background-аас сэрэхэд өнгөрсөн
      // дуудлагууд цуварч ирж болно.
      const age = Date.now() - new Date(row.created_at).getTime();
      if (age > RING_TIMEOUT_MS) return;
      if (callRef.current || incomingRef.current) {
        // Аль хэдийн дуудлага дээр байна — сервер `busy` тавина
        voip.declineCall(row.id).catch(() => {});
        return;
      }

      const peer = await voip.fetchPeer(row.caller_id);
      const next = { id: row.id, peer, type: row.type || 'audio' };
      setIncoming(next);
      incomingRef.current = next;

      if (useNativeUi) {
        showNativeIncomingCall({
          id: row.id,
          caller_id: row.caller_id,
          caller_name: peer.name,
          type: next.type,
        });
      } else {
        await startIncomingCallAlert(peer.name);
      }

      // Дуудагч цуцалсныг мэдэж дуугаралт зогсооно, мөн өөр төхөөрөмж дээр
      // хариулсан тохиолдолд ч энэ утас дуугарсаар байх ёсгүй.
      updatesRef.current = voip.subscribeCall(row.id, (updated) => {
        if (isTerminal(updated.status) || updated.status === 'accepted') {
          if (!callRef.current) {
            stopIncomingCallAlert();
            hideNativeIncomingCall();
            setIncoming(null);
            incomingRef.current = null;
            if (updatesRef.current) {
              updatesRef.current();
              updatesRef.current = null;
            }

            // Аваагүй дуудлагыг мөрөө үлдээлгүй алга болгож болохгүй —
            // хэрэглэгч хэн залгасныг мэдэх ёстой. Өөрөө татгалзсан
            // тохиолдолд мэдэгдэл гаргах нь утгагүй тул зөвхөн
            // хариулаагүй/цуцлагдсан үед.
            if (updated.status === 'missed' || updated.status === 'cancelled') {
              notifyMissedCall(peer.name, next.type).catch(() => {});
            }
          }
        }
      });
    });

    return () => {
      unsub();
      stopIncomingCallAlert();
    };
  }, [isCloud, meId, useNativeUi]);

  const answerCall = useCallback(
    async (payload) => {
      const target = payload || incomingRef.current;
      if (!target) return;

      stopIncomingCallAlert();
      hideNativeIncomingCall();
      setIncoming(null);
      incomingRef.current = null;

      if (updatesRef.current) {
        updatesRef.current();
        updatesRef.current = null;
      }

      if (!isWebRtcAvailable()) {
        voip.failCall(target.id, 'no_webrtc').catch(() => {});
        Alert.alert('Дуудлага', 'Дуудлагын модуль байхгүй тул хариулах боломжгүй.');
        return;
      }

      const video = target.type === 'video';
      try {
        await voip.acceptCall(target.id);
      } catch (e) {
        Alert.alert('Дуудлага', e.message || 'Хариулахад алдаа гарлаа.');
        return;
      }

      const state = {
        id: target.id,
        role: 'callee',
        peer: target.peer,
        type: target.type,
        state: CALL_STATE.CONNECTING,
      };
      setCall(state);
      callRef.current = state;

      const icm = inCallManager();
      try {
        icm?.start?.({ media: video ? 'video' : 'audio', auto: true });
      } catch (e) {}

      // Дуудагч руу "бэлэн" гэж мэдэгдэхээс ӨМНӨ микрофон/камер нээгдсэн
      // байх ёстой. Эсрэгээр бол offer нь session бэлдэж дуусаагүй байхад
      // ирж, хоёр session зэрэг үүсэх эрсдэлтэй.
      let subscribed = false;
      let mediaReady = false;
      const announceReady = () => {
        if (subscribed && mediaReady) signalRef.current?.send('call:ringing', { ready: true });
      };

      const signaling = openSignaling(target.id, {
        onOffer: async (payloadOffer) => {
          try {
            await sessionRef.current?.acceptOffer(payloadOffer);
          } catch (e) {
            voip.failCall(target.id, 'answer_failed').catch(() => {});
            finish(CALL_STATE.FAILED, 'Дуудлагад холбогдоход алдаа гарлаа.');
          }
        },
        onIceCandidate: (p) => sessionRef.current?.addIceCandidate(p?.candidate),
        onStatus: (status) => {
          if (status === 'SUBSCRIBED') {
            subscribed = true;
            announceReady();
          }
        },
      });
      signalRef.current = signaling;

      try {
        await buildSession(target.id, video, signaling);
        mediaReady = true;
        announceReady();
      } catch (e) {
        voip.failCall(target.id, 'media_failed').catch(() => {});
        finish(CALL_STATE.FAILED, 'Микрофон/камер нээх боломжгүй байна.');
        return;
      }

      updatesRef.current = voip.subscribeCall(target.id, (updated) => {
        if (isTerminal(updated.status)) finish(toUiState(updated.status));
      });
    },
    [buildSession, finish]
  );

  const rejectCall = useCallback(async (payload) => {
    const target = payload || incomingRef.current;
    stopIncomingCallAlert();
    hideNativeIncomingCall();
    setIncoming(null);
    incomingRef.current = null;
    if (updatesRef.current) {
      updatesRef.current();
      updatesRef.current = null;
    }
    if (target?.id) await voip.declineCall(target.id).catch(() => {});
  }, []);

  /** Идэвхтэй дуудлагыг таслах, эсвэл дуудаж байгааг цуцлах. */
  const hangUp = useCallback(async () => {
    const active = callRef.current;
    if (!active) return;
    const ringing = active.state === CALL_STATE.RINGING || active.state === CALL_STATE.INITIATING;
    teardown();
    setCall(null);
    callRef.current = null;
    try {
      if (ringing && active.role === 'caller') await voip.cancelCall(active.id);
      else await voip.endCall(active.id);
    } catch (e) {}
  }, [teardown]);

  // Native дуудлагын дэлгэц (Android full-screen) → энэ context
  useEffect(() => {
    const unsub = incomingCallBridge.subscribe(({ type, data }) => {
      /**
       * Jitsi горимын дуудлага — залгагч тал native WebRTC-гүй орчинд
       * (Expo Go) байгаа тул WebRTC сесс огт байхгүй. Хариулбал зүгээр
       * ижил Jitsi өрөө рүү оруулна.
       */
      /**
       * ⚠️ `jitsiRoom` нь native дэлгэцийн payload-д ҮЛДДЭГГҮЙ:
       *    `buildPayload()` нь зөвхөн callId, room, callerId, callerName,
       *    callType-ийг дамжуулдаг. Тиймээс `room`-оор ч шалгана.
       */
      const jitsiRoom = data?.jitsiRoom || data?.room;
      const hasRealCall = data?.callId && !String(data.callId).startsWith('tmp_');
      if (jitsiRoom && !hasRealCall) {
        hideNativeIncomingCall();
        if (type === 'answer') {
          navigationRef.navigate('Conversation', {
            conversationId: jitsiRoom,
            title: data.callerName || 'Дуудлага',
            autoJoinCall: true,
          });
        }
        return;
      }

      const target =
        incomingRef.current ||
        (data?.callId
          ? {
              id: data.callId,
              type: data.callType || 'audio',
              peer: { id: data.callerId, name: data.callerName || 'Ажилтан' },
            }
          : null);
      if (!target) return;
      if (type === 'answer') answerCall(target);
      else rejectCall(target);
    });
    return unsub;
  }, [answerCall, rejectCall]);

  // Апп background-аас сэрэхэд серверийн төлөвтэй тааруулна — push
  // хоцорсон эсвэл realtime тасарсан үед дэлгэц "өлгөөтэй" үлдэхгүй.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active') return;
      const active = callRef.current || incomingRef.current;
      if (!active?.id) return;
      try {
        const fresh = await voip.fetchCall(active.id);
        if (!fresh || isTerminal(fresh.status)) {
          if (callRef.current) finish(toUiState(fresh?.status));
          else rejectCall(null);
        }
      } catch (e) {}
    });
    return () => sub.remove();
  }, [finish, rejectCall]);

  // -------------------------------------------------------------------------
  // Хяналт
  // -------------------------------------------------------------------------

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      sessionRef.current?.setMuted(!m);
      return !m;
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((s) => {
      try {
        inCallManager()?.setForceSpeakerphoneOn?.(!s);
      } catch (e) {}
      return !s;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraOn((c) => {
      sessionRef.current?.setCameraEnabled(!c);
      return !c;
    });
  }, []);

  const switchCamera = useCallback(() => {
    sessionRef.current?.switchCamera();
  }, []);

  const value = useMemo(
    () => ({
      call,
      incoming,
      localStream,
      remoteStream,
      muted,
      speakerOn,
      cameraOn,
      RTCView: rtcRef.current || null,
      callingAvailable: isWebRtcAvailable(),
      placeCall,
      answerCall,
      rejectCall,
      hangUp,
      toggleMute,
      toggleSpeaker,
      toggleCamera,
      switchCamera,
    }),
    [
      call,
      incoming,
      localStream,
      remoteStream,
      muted,
      speakerOn,
      cameraOn,
      placeCall,
      answerCall,
      rejectCall,
      hangUp,
      toggleMute,
      toggleSpeaker,
      toggleCamera,
      switchCamera,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
