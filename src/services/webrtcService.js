import { NativeModules } from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * WebRTC холболт — жинхэнэ дуу/дүрсийг энэ дамжуулна.
 *
 * PUSH нь зөвхөн "дуудлага ирлээ" гэж төхөөрөмжийг СЭРЭЭНЭ. Дуу, дүрс нь
 * энд, peer-to-peer (эсвэл TURN relay-гээр) дамжина.
 *
 * SIGNALING: Supabase Realtime broadcast. Дуудлага бүр `call:{id}` гэсэн
 * тусдаа сувагтай — өөр хэрэглэгч бусдын signaling-ийг сонсох боломжгүй.
 *
 * ⚠️ `react-native-webrtc` нь NATIVE модуль тул Expo Go-д ачаалагдахгүй.
 *    Development build эсвэл APK шаардана. Доорх `isWebRtcAvailable`-аар
 *    шалгаад, боломжгүй бол ойлгомжтой мессеж өгнө.
 */

let rtc = null;

/** Native модуль ачаалагдах боломжтой эсэх. */
export function isWebRtcAvailable() {
  return !!NativeModules.WebRTCModule;
}

function getRtc() {
  if (rtc) return rtc;
  if (!isWebRtcAvailable()) {
    throw new Error(
      'Дуудлагын модуль энэ хувилбарт байхгүй байна.\n\n' +
        'Development build эсвэл APK ашиглана уу (npx expo run:android).'
    );
  }
  // eslint-disable-next-line global-require
  rtc = require('react-native-webrtc');
  return rtc;
}

/**
 * ICE серверүүд.
 *
 * STUN нь хоёр талын гадаад хаягийг олоход хангалттай — ихэнх тохиолдолд
 * шууд P2P холбогдоно. Гэвч хатуу NAT/корпорацийн галт хана ард байвал
 * P2P бүтэхгүй тул TURN relay ЗААВАЛ хэрэгтэй.
 *
 * TURN-ийг .env-ээс авна — эх кодод хатуу бичихгүй.
 * PENDING EXTERNAL CONFIG: TURN үйлчилгээ сонгож тохируулна.
 */
export function iceServers() {
  const list = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const url = process.env.EXPO_PUBLIC_TURN_URL;
  const username = process.env.EXPO_PUBLIC_TURN_USERNAME;
  const credential = process.env.EXPO_PUBLIC_TURN_PASSWORD;
  if (url && username && credential) {
    list.push({ urls: url, username, credential });
  }
  return list;
}

export function hasTurn() {
  return !!(process.env.EXPO_PUBLIC_TURN_URL && process.env.EXPO_PUBLIC_TURN_USERNAME);
}

// ---------------------------------------------------------------------------
// Signaling суваг
// ---------------------------------------------------------------------------

/**
 * Дуудлагын signaling суваг нээнэ.
 *
 * Broadcast ашиглана (postgres_changes биш) — offer/answer/ICE нь түр
 * зуурын мессеж бөгөөд өгөгдлийн санд хадгалах шаардлагагүй, мөн
 * хурдан байх ёстой.
 */
export function openSignaling(callId, handlers = {}) {
  const channel = supabase.channel(`call:${callId}`, {
    config: { broadcast: { self: false, ack: false } },
  });

  const on = (event, fn) => {
    if (fn) channel.on('broadcast', { event }, ({ payload }) => fn(payload));
  };

  on('webrtc:offer', handlers.onOffer);
  on('webrtc:answer', handlers.onAnswer);
  on('webrtc:ice-candidate', handlers.onIceCandidate);
  on('call:ringing', handlers.onRinging);
  on('call:accepted', handlers.onAccepted);
  on('call:declined', handlers.onDeclined);
  on('call:cancelled', handlers.onCancelled);
  on('call:ended', handlers.onEnded);

  channel.subscribe((status) => handlers.onStatus?.(status));

  return {
    send: (event, payload) => channel.send({ type: 'broadcast', event, payload: payload || {} }),
    close: () => supabase.removeChannel(channel),
  };
}

// ---------------------------------------------------------------------------
// Peer connection
// ---------------------------------------------------------------------------

/**
 * Дуудлагын холболт үүсгэнэ.
 *
 * @param {object} opts
 * @param {boolean} opts.video       видео дуудлага эсэх
 * @param {object}  opts.signaling   openSignaling()-ийн буцаасан объект
 * @param {function} opts.onRemoteStream  нөгөө талын урсгал ирэхэд
 * @param {function} opts.onStateChange   холболтын төлөв өөрчлөгдөхөд
 */
export async function createCallSession({ video = false, signaling, onRemoteStream, onStateChange }) {
  const {
    RTCPeerConnection,
    RTCSessionDescription,
    RTCIceCandidate,
    mediaDevices,
  } = getRtc();

  const pc = new RTCPeerConnection({
    iceServers: iceServers(),
    // Бүх ICE нэр дэвшигчийг цуглуулна — TURN байвал relay ч орно
    iceCandidatePoolSize: 4,
  });

  // --- Микрофон / камер ---
  const localStream = await mediaDevices.getUserMedia({
    audio: true,
    video: video
      ? {
          width: { min: 640, ideal: 1280 },
          height: { min: 480, ideal: 720 },
          frameRate: { min: 15, ideal: 30 },
          facingMode: 'user',
        }
      : false,
  });
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  // --- Нөгөө талын урсгал ---
  pc.addEventListener('track', (e) => {
    if (e.streams?.[0]) onRemoteStream?.(e.streams[0]);
  });

  // --- ICE нэр дэвшигчийг нөгөө тал руу ---
  pc.addEventListener('icecandidate', (e) => {
    if (e.candidate) {
      signaling?.send('webrtc:ice-candidate', { candidate: e.candidate.toJSON() });
    }
  });

  // --- Холболтын төлөв ---
  pc.addEventListener('connectionstatechange', () => {
    onStateChange?.(pc.connectionState);
  });

  pc.addEventListener('iceconnectionstatechange', () => {
    // Сүлжээ солигдоход (Wi-Fi ↔ мобайл) ICE унана. Шууд дуудлага таслахын
    // оронд дахин холбогдохыг оролдоно — 1 секундын тасалдалд дуудлага
    // унах ёсгүй.
    if (pc.iceConnectionState === 'failed') {
      try {
        pc.restartIce?.();
      } catch (e) {}
    }
  });

  // Remote description тавигдахаас ӨМНӨ ирсэн ICE нэр дэвшигчийг хадгална.
  // Сүлжээнд offer/answer болон candidate-ууд өөр өөр хурдаар явдаг тул
  // candidate эхэлж ирэх нь ЭНГИЙН зүйл. Хаяж болохгүй — хаявал зөвхөн
  // хэсэг зам үлдэж, зарим сүлжээнд дуудлага огт холбогдохгүй.
  const pendingCandidates = [];
  let remoteSet = false;

  async function flushCandidates() {
    while (pendingCandidates.length) {
      const c = pendingCandidates.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {}
    }
  }

  return {
    pc,
    localStream,

    /** Дуудагч тал: offer үүсгэж илгээнэ. */
    async createOffer() {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: video,
      });
      await pc.setLocalDescription(offer);
      signaling?.send('webrtc:offer', { sdp: offer.sdp, type: offer.type });
      return offer;
    },

    /** Хүлээн авагч тал: offer хүлээж аваад answer буцаана. */
    async acceptOffer(offer) {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      remoteSet = true;
      await flushCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      signaling?.send('webrtc:answer', { sdp: answer.sdp, type: answer.type });
      return answer;
    },

    /** Дуудагч тал: answer хүлээж авна. */
    async acceptAnswer(answer) {
      if (pc.signalingState === 'stable') return; // давхар answer
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      remoteSet = true;
      await flushCandidates();
    },

    async addIceCandidate(candidate) {
      if (!candidate) return;
      if (!remoteSet) {
        pendingCandidates.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {}
    },

    // --- Хяналт ---
    setMuted(muted) {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
    },

    setCameraEnabled(enabled) {
      localStream.getVideoTracks().forEach((t) => {
        t.enabled = enabled;
      });
    },

    async switchCamera() {
      const track = localStream.getVideoTracks()[0];
      if (track?._switchCamera) track._switchCamera();
    },

    /**
     * Бүх нөөцийг суллана.
     *
     * Track-уудыг зогсоохгүй бол камер асаалттай үлдэж, микрофон
     * бичсээр байна — хэрэглэгчийн хувийн нууцад ноцтой.
     */
    close() {
      try {
        localStream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      try {
        pc.getSenders().forEach((s) => s.track?.stop());
      } catch (e) {}
      try {
        pc.close();
      } catch (e) {}
    },
  };
}
