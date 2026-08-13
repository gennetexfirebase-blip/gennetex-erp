import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { initials } from '../lib/telegram/avatarColor';
import { CALL_STATE, CALL_TEXT } from '../services/voipCallService';

/**
 * Идэвхтэй дуудлагын дэлгэц — дуут болон видео.
 *
 * Утасны жинхэнэ дуудлагын дэлгэц шиг ХАРАНХУЙ өнгөтэй байна. Энэ нь
 * системийн theme-ээс хамаарахгүй: бүх платформ дээр дуудлага харанхуй
 * дэвсгэртэй байдаг тул хэрэглэгчийн хүлээлт тийм, мөн видеоны дэргэд
 * цайвар дэвсгэр нүд гэмтээнэ.
 *
 * `RTCView` нь react-native-webrtc-ээс ирнэ. Тэр модуль байхгүй үед (Expo Go)
 * энэ дэлгэц дуудагдахгүй — CallOrchestrator өмнө нь шалгана.
 */

function fmt(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Дуудлагын үргэлжлэх хугацаа — холбогдсоны дараа л тоолно. */
function useDuration(active) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) {
      setSecs(0);
      return undefined;
    }
    const started = Date.now();
    const t = setInterval(() => setSecs(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [active]);
  return secs;
}

function CircleButton({ icon, label, onPress, active, danger, size = 62 }) {
  return (
    <View style={styles.btnWrap}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: !!active }}
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
          active && styles.circleActive,
          danger && styles.circleDanger,
        ]}
      >
        <Ionicons name={icon} size={size * 0.42} color={active && !danger ? '#0b1220' : '#fff'} />
      </TouchableOpacity>
      <Text style={styles.btnLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function ActiveCallScreen({
  visible,
  RTCView,
  peerName = 'Ажилтан',
  peerAvatar,
  video = false,
  state = CALL_STATE.CONNECTING,
  localStream,
  remoteStream,
  muted,
  speakerOn,
  cameraOn,
  onToggleMute,
  onToggleSpeaker,
  onToggleCamera,
  onSwitchCamera,
  onEnd,
}) {
  const connected = state === CALL_STATE.CONNECTED;
  const secs = useDuration(connected);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (visible) mountedAt.current = Date.now();
  }, [visible]);

  // Видео дуудлагад нөгөө талын урсгал ирээгүй байхад ч дэлгэц хоосон
  // харагдаж болохгүй — нэр, төлөвийг үргэлж харуулна.
  const showRemoteVideo = video && !!remoteStream && !!RTCView && connected;
  const showLocalVideo = video && !!localStream && !!RTCView && cameraOn !== false;

  const statusText = connected ? fmt(secs) : CALL_TEXT[state] || 'Холбогдож байна...';

  return (
    <Modal visible={!!visible} animationType="slide" statusBarTranslucent onRequestClose={onEnd}>
      <StatusBar barStyle="light-content" backgroundColor="#0b1220" />
      <View style={styles.root}>
        {showRemoteVideo ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            zOrder={0}
          />
        ) : (
          <LinearGradient colors={['#101b2d', '#0b1220', '#06101c']} style={StyleSheet.absoluteFill} />
        )}

        {/* Видео дээр товчлуурын текст уншигдахуйц байлгах бүрхүүл */}
        {showRemoteVideo ? <View style={styles.scrim} pointerEvents="none" /> : null}

        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* --- Дээд хэсэг: хэнтэй ярьж байгаа --- */}
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {peerName}
            </Text>
            <Text style={styles.status}>{statusText}</Text>
            {video && !connected ? (
              <Text style={styles.hint}>Видео дуудлага</Text>
            ) : null}
          </View>

          {/* --- Дунд: аудио бол зураг, видео бол өөрийн дүрс --- */}
          {!showRemoteVideo ? (
            <View style={styles.avatarWrap}>
              {peerAvatar ? (
                <Image source={{ uri: peerAvatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{initials(peerName)}</Text>
                </View>
              )}
            </View>
          ) : null}

          {showLocalVideo ? (
            <View style={styles.selfWrap}>
              <RTCView
                streamURL={localStream.toURL()}
                style={styles.self}
                objectFit="cover"
                zOrder={1}
                mirror
              />
            </View>
          ) : null}

          {/* --- Доод: хяналтын товчлуурууд --- */}
          <View style={styles.controls}>
            <View style={styles.row}>
              <CircleButton
                icon={muted ? 'mic-off' : 'mic'}
                label={muted ? 'Микрофон хаалттай' : 'Микрофон'}
                active={muted}
                onPress={onToggleMute}
              />
              <CircleButton
                icon={speakerOn ? 'volume-high' : 'volume-low'}
                label={speakerOn ? 'Чанга яригч' : 'Чихэвч'}
                active={speakerOn}
                onPress={onToggleSpeaker}
              />
              {video ? (
                <CircleButton
                  icon={cameraOn ? 'videocam' : 'videocam-off'}
                  label={cameraOn ? 'Камер' : 'Камер хаалттай'}
                  active={!cameraOn}
                  onPress={onToggleCamera}
                />
              ) : null}
              {video ? (
                <CircleButton icon="camera-reverse" label="Эргүүлэх" onPress={onSwitchCamera} />
              ) : null}
            </View>

            <View style={styles.endRow}>
              <CircleButton icon="call" label="Таслах" danger size={72} onPress={onEnd} />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,16,28,0.35)' },
  safe: { flex: 1, justifyContent: 'space-between' },

  header: { alignItems: 'center', paddingTop: 28, paddingHorizontal: 24 },
  name: { color: '#fff', fontSize: 26, fontWeight: '700', letterSpacing: 0.2 },
  status: { color: 'rgba(255,255,255,0.82)', fontSize: 16, marginTop: 8, fontVariant: ['tabular-nums'] },
  hint: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 4 },

  avatarWrap: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  avatar: { width: 148, height: 148, borderRadius: 74, backgroundColor: '#1b2941' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 52, fontWeight: '700' },

  // Өөрийн дүрс — баруун дээд буланд, доод товчлуурыг халхлахгүй
  selfWrap: {
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'ios' ? 96 : 76,
    width: 108,
    height: 152,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: '#0b1220',
  },
  self: { width: '100%', height: '100%' },

  controls: { paddingHorizontal: 20, paddingBottom: 18 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 18, flexWrap: 'wrap' },
  endRow: { alignItems: 'center', marginTop: 22 },

  btnWrap: { alignItems: 'center', width: 78 },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  circleActive: { backgroundColor: '#ffffff' },
  circleDanger: { backgroundColor: '#e5484d', transform: [{ rotate: '135deg' }] },
  btnLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    marginTop: 7,
    textAlign: 'center',
  },
});
