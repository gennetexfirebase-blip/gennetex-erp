import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Camera, CameraView } from 'expo-camera';
import { buildMeetingHtml } from '../lib/meetingHtml';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * @param {'live'|'meeting'} mode
 * live = зөвхөн камер+мик (дэлгэц share байхгүй)
 * meeting = хурал (дэлгэц share боломжтой)
 */
export default function MeetingModal({
  visible,
  meetingId,
  name,
  isHost = false,
  hostName = '',
  mode = 'live',
  onClose,
}) {
  const webRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [permError, setPermError] = useState(null);
  const [facing, setFacing] = useState('front');
  const isLive = mode !== 'meeting';

  useEffect(() => {
    if (!visible) {
      setReady(false);
      setPermError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (isHost) {
          const cam = await Camera.requestCameraPermissionsAsync();
          const mic = await Camera.requestMicrophonePermissionsAsync();
          if (cancelled) return;
          if (cam?.status !== 'granted') {
            setPermError('Тохиргоо → Камер зөвшөөрнө үү');
            setReady(false);
            return;
          }
          if (mic?.status !== 'granted') {
            setPermError('Тохиргоо → Микрофон зөвшөөрнө үү');
            setReady(false);
            return;
          }
        }
        if (cancelled) return;
        setPermError(null);
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setPermError(e.message || 'Зөвшөөрөл авахад алдаа');
          setReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, isHost]);

  const html = useMemo(() => {
    if (!visible || !meetingId || !ready || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    return buildMeetingHtml({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_ANON_KEY,
      meetingId,
      name,
      role: isHost ? 'host' : 'viewer',
      enableScreenShare: !isLive && isHost,
    });
  }, [visible, meetingId, name, isHost, ready, isLive]);

  const injectStartCamera = () => {
    webRef.current?.injectJavaScript(`
      (function(){
        try { if (typeof window.startCamera === 'function') window.startCamera(); } catch (e) {}
      })();
      true;
    `);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.stage}>
          {!ready ? (
            <View style={styles.loading}>
              {permError ? (
                <Text style={styles.err}>{permError}</Text>
              ) : (
                <ActivityIndicator color="#fff" size="large" />
              )}
            </View>
          ) : (
            <>
              {/* Host: камер+мик шууд (native preview) */}
              {isHost ? <CameraView style={styles.camera} facing={facing} /> : null}

              {html ? (
                <WebView
                  ref={webRef}
                  source={{ html, baseUrl: 'https://gennetex.local' }}
                  style={isHost ? styles.webHostHidden : styles.web}
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                  domStorageEnabled
                  allowsFullscreenVideo
                  mediaCapturePermissionGrantType="grant"
                  originWhitelist={['*']}
                  mixedContentMode="always"
                  androidLayerType="hardware"
                  setSupportMultipleWindows={false}
                  onLoadEnd={() => {
                    if (isHost) {
                      // Камер+мик автоматаар илгээх
                      setTimeout(injectStartCamera, 300);
                      setTimeout(injectStartCamera, 1200);
                    }
                  }}
                  onMessage={(e) => {
                    if (e.nativeEvent.data === 'close') onClose?.();
                  }}
                  onPermissionRequest={(req) => {
                    try {
                      if (req?.grant) req.grant(req.resources || []);
                    } catch (e) {}
                  }}
                />
              ) : null}

              {isHost ? (
                <View style={styles.liveBadge}>
                  <View style={styles.dot} />
                  <Text style={styles.liveBadgeText}>LIVE · камер + микрофон</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.bottomBar}>
          <View style={styles.pill}>
            <View style={styles.dot} />
            <Text style={styles.pillText}>{isLive ? 'LIVE' : 'ХУРАЛ'}</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {isHost
              ? isLive
                ? 'Та live хийж байна'
                : 'Та хурал удирдаж байна'
              : `${hostName || 'Ажилтан'} ${isLive ? 'Live' : 'хурал'}`}
          </Text>
          {isHost ? (
            <TouchableOpacity
              style={styles.flipBtn}
              onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
            >
              <Text style={styles.flipText}>Эргүүлэх</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>{isHost ? 'Дуусгах' : 'Гарах'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  stage: { flex: 1, backgroundColor: '#000' },
  camera: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  web: { flex: 1, backgroundColor: '#000' },
  webHostHidden: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    zIndex: 0,
  },
  liveBadge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  liveBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 10 : 14,
    backgroundColor: '#111',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  pillText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  title: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 14 },
  flipBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  flipText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  closeBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeText: { color: '#fff', fontWeight: '700' },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    padding: 24,
  },
  err: { color: '#fca5a5', fontWeight: '600', textAlign: 'center', fontSize: 15 },
});
