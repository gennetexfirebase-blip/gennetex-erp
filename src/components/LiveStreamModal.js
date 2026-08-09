import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as liveApi from '../services/liveInviteService';

/** Үнэгүй live stream — Jitsi (meet.ffmuc.net) */
const JITSI_DOMAIN = 'meet.ffmuc.net';

export function liveRoomFromId(meetingId) {
  return `gennetexlive${String(meetingId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`;
}

function buildHtml(room, name, isHost) {
  const safeRoom = String(room).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeName = String(name || 'Ажилтан').replace(/["'<>\\]/g, '');
  const toolbar = isHost
    ? "['microphone','camera','hangup','tileview','togglecamera']"
    : "['hangup','tileview']";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
    <style>
      html,body,#meet{height:100%;margin:0;padding:0;background:#000;overflow:hidden}
      #err{color:#fff;padding:24px;font-family:sans-serif;text-align:center}
    </style>
  </head>
  <body>
    <div id="meet"></div>
    <script src="https://${JITSI_DOMAIN}/external_api.js"></script>
    <script>
      var api = null;
      function ensureHostMedia() {
        if (!api || !${isHost ? 'true' : 'false'}) return;
        try {
          if (api.isAudioMuted && typeof api.isAudioMuted().then === 'function') {
            api.isAudioMuted().then(function(muted){
              if (muted) { try { api.executeCommand('toggleAudio'); } catch (e) {} }
            });
          }
        } catch (e) {}
        try {
          if (api.isVideoMuted && typeof api.isVideoMuted().then === 'function') {
            api.isVideoMuted().then(function(muted){
              if (muted) { try { api.executeCommand('toggleVideo'); } catch (e) {} }
            });
          }
        } catch (e) {}
      }
      function start() {
        try {
          api = new JitsiMeetExternalAPI('${JITSI_DOMAIN}', {
            roomName: '${safeRoom}',
            parentNode: document.getElementById('meet'),
            width: '100%',
            height: '100%',
            userInfo: { displayName: '${safeName}' },
            configOverwrite: {
              prejoinPageEnabled: false,
              prejoinConfig: { enabled: false },
              disableDeepLinking: true,
              disableThirdPartyRequests: true,
              startWithAudioMuted: ${isHost ? 'false' : 'true'},
              startWithVideoMuted: ${isHost ? 'false' : 'true'},
              startAudioOnly: false,
              disableInviteFunctions: true,
              enableWelcomePage: false,
              requireDisplayName: false,
              enableNoAudioDetection: false,
              enableNoisyMicDetection: false,
              constraints: {
                video: { height: { ideal: 720, max: 720, min: 240 } },
                audio: { autoGainControl: true, echoCancellation: true, noiseSuppression: true }
              }
            },
            interfaceConfigOverwrite: {
              MOBILE_APP_PROMO: false,
              SHOW_JITSI_WATERMARK: false,
              SHOW_WATERMARK_FOR_GUESTS: false,
              TOOLBAR_BUTTONS: ${toolbar},
              DISABLE_JOIN_LEAVE_NOTIFICATIONS: true
            }
          });
          api.addEventListener('readyToClose', function () {
            if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('close');
          });
          api.addEventListener('videoConferenceJoined', function () {
            ensureHostMedia();
            setTimeout(ensureHostMedia, 800);
            setTimeout(ensureHostMedia, 2000);
          });
          api.addEventListener('audioMuteStatusChanged', function (e) {
            if (${isHost ? 'true' : 'false'} && e && e.muted) {
              setTimeout(function(){ try { api.executeCommand('toggleAudio'); } catch (err) {} }, 300);
            }
          });
        } catch (e) {
          document.body.innerHTML = '<div id="err">Live эхлүүлэхэд алдаа: ' + e.message + '</div>';
        }
      }
      if (window.JitsiMeetExternalAPI) start();
      else {
        var t = setInterval(function () {
          if (window.JitsiMeetExternalAPI) { clearInterval(t); start(); }
        }, 200);
      }
    </script>
  </body>
</html>`;
}

export default function LiveStreamModal({
  visible,
  room,
  liveId,
  name,
  userId,
  isHost = false,
  hostName = '',
  employees = [],
  onClose,
}) {
  const [ready, setReady] = useState(false);
  const [permError, setPermError] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitingId, setInvitingId] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setReady(false);
      setPermError(null);
      setComments([]);
      setCommentText('');
      setInviteOpen(false);
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
            setPermError('Камерын зөвшөөрөл өгнө үү');
            return;
          }
          if (mic?.status !== 'granted') {
            setPermError('Микрофоны зөвшөөрөл өгнө үү');
            return;
          }
        }
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setPermError(e.message || 'Зөвшөөрөл алдаа');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, isHost]);

  // Сэтгэгдэл — DB + realtime
  useEffect(() => {
    if (!visible || !liveId) return;
    let active = true;
    liveApi.fetchLiveComments(liveId).then((rows) => {
      if (!active) return;
      setComments(
        (rows || []).map((r) => ({
          id: r.id,
          user_id: r.user_id,
          user_name: r.user_name,
          content: r.content,
          created_at: r.created_at,
        }))
      );
    });
    const unsub = liveApi.subscribeLiveComments(liveId, (row) => {
      setComments((prev) => {
        if (prev.some((c) => c.id === row.id)) return prev;
        return [
          ...prev.slice(-80),
          {
            id: row.id,
            user_id: row.user_id,
            user_name: row.user_name,
            content: row.content,
            created_at: row.created_at,
          },
        ];
      });
    });
    return () => {
      active = false;
      unsub?.();
    };
  }, [visible, liveId]);

  useEffect(() => {
    if (comments.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [comments.length]);

  const sendComment = useCallback(async () => {
    const text = commentText.trim();
    if (!text || !liveId || sending) return;
    setSending(true);
    setCommentText('');
    try {
      await liveApi.postLiveComment({
        liveId,
        userId,
        userName: name || 'Ажилтан',
        content: text,
      });
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setSending(false);
    }
  }, [commentText, liveId, userId, name, sending]);

  const inviteUser = useCallback(
    async (inviteeId, inviteeName) => {
      if (!isHost || !liveId || !userId || !inviteeId) return;
      setInvitingId(inviteeId);
      try {
        await liveApi.inviteToLive({
          liveId,
          hostId: userId,
          hostName: name || hostName || 'Ажилтан',
          inviteeId,
          inviteeName,
        });
        Alert.alert('Урилга', `${inviteeName || 'Ажилтан'}-д урилга илгээлээ`);
        setInviteOpen(false);
      } catch (e) {
        Alert.alert('Алдаа', e.message);
      } finally {
        setInvitingId(null);
      }
    },
    [isHost, liveId, userId, name, hostName]
  );

  const html = useMemo(() => {
    if (!visible || !room || !ready) return null;
    return buildHtml(room, name, isHost);
  }, [visible, room, name, isHost, ready]);

  const inviteList = (employees || []).filter((e) => e.id && e.id !== userId);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.stage}>
            {html ? (
              <WebView
                source={{ html, baseUrl: `https://${JITSI_DOMAIN}` }}
                style={styles.web}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled
                allowsFullscreenVideo
                mediaCapturePermissionGrantType="grant"
                originWhitelist={['*']}
                mixedContentMode="always"
                androidLayerType="hardware"
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.loading}>
                    <ActivityIndicator color="#fff" size="large" />
                    <Text style={styles.loadingText}>Live ачаалж байна...</Text>
                  </View>
                )}
                onMessage={(e) => {
                  if (e.nativeEvent.data === 'close') onClose?.();
                }}
                onPermissionRequest={(req) => {
                  try {
                    if (req?.grant) req.grant(req.resources || []);
                  } catch (e) {}
                }}
              />
            ) : (
              <View style={styles.loading}>
                {permError ? (
                  <Text style={styles.err}>{permError}</Text>
                ) : (
                  <>
                    <ActivityIndicator color="#fff" size="large" />
                    <Text style={styles.loadingText}>Камер бэлдэж байна...</Text>
                  </>
                )}
              </View>
            )}

            <View style={styles.commentsOverlay} pointerEvents="box-none">
              <FlatList
                ref={listRef}
                data={comments}
                keyExtractor={(c) => c.id}
                style={styles.commentsList}
                contentContainerStyle={styles.commentsContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const joinReq = liveApi.isJoinRequest(item.content);
                  const canInvite =
                    isHost && item.user_id && item.user_id !== userId;
                  return (
                    <View style={styles.commentBubble}>
                      <Text style={styles.commentUser}>{item.user_name || 'Ажилтан'}</Text>
                      <Text style={styles.commentText}>{item.content}</Text>
                      {canInvite ? (
                        <TouchableOpacity
                          style={[styles.inviteMini, joinReq && styles.inviteMiniHot]}
                          onPress={() => inviteUser(item.user_id, item.user_name)}
                          disabled={invitingId === item.user_id}
                        >
                          <Text style={styles.inviteMiniText}>
                            {invitingId === item.user_id
                              ? '...'
                              : joinReq
                              ? 'Урих (орох хүсэлт)'
                              : 'Live-д урих'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                }}
              />
            </View>
          </View>

          <View style={styles.commentBar}>
            <TextInput
              style={styles.commentInput}
              placeholder="Сэтгэгдэл бичих... (ж: би орж)"
              placeholderTextColor="#94a3b8"
              value={commentText}
              onChangeText={setCommentText}
              maxLength={300}
              editable={!!liveId}
              onSubmitEditing={sendComment}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!commentText.trim() || sending) && styles.sendBtnOff]}
              onPress={sendComment}
              disabled={!commentText.trim() || sending}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomBar}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>LIVE</Text>
            </View>
            <Text style={styles.topTitle} numberOfLines={1}>
              {isHost ? 'Та live хийж байна' : `${hostName || 'Ажилтан'} Live`}
            </Text>
            {isHost ? (
              <TouchableOpacity style={styles.inviteBtn} onPress={() => setInviteOpen(true)}>
                <Ionicons name="person-add" size={16} color="#fff" />
                <Text style={styles.inviteBtnText}>Урих</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>{isHost ? 'Дуусгах' : 'Гарах'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Ажилтан сонгож урих */}
        <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
          <View style={styles.sheetBg}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Live-д урих</Text>
              <Text style={styles.sheetSub}>Сонгосон ажилтанд ringtone-той урилга очно</Text>
              <ScrollView style={{ maxHeight: 360 }}>
                {inviteList.map((emp) => (
                  <TouchableOpacity
                    key={emp.id}
                    style={styles.empRow}
                    onPress={() => inviteUser(emp.id, emp.name)}
                    disabled={invitingId === emp.id}
                  >
                    <Text style={styles.empName}>{emp.name || 'Ажилтан'}</Text>
                    <Text style={styles.empAction}>
                      {invitingId === emp.id ? 'Илгээж байна...' : 'Урих'}
                    </Text>
                  </TouchableOpacity>
                ))}
                {!inviteList.length ? (
                  <Text style={styles.sheetSub}>Ажилтан олдсонгүй</Text>
                ) : null}
              </ScrollView>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setInviteOpen(false)}>
                <Text style={styles.sheetCloseText}>Хаах</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  stage: { flex: 1, backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
  commentsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom: 8,
    paddingHorizontal: 10,
  },
  commentsList: { maxHeight: 240 },
  commentsContent: { paddingTop: 40, gap: 6 },
  commentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '90%',
  },
  commentUser: { color: '#93c5fd', fontWeight: '800', fontSize: 12, marginBottom: 2 },
  commentText: { color: '#fff', fontSize: 14, lineHeight: 18 },
  inviteMini: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inviteMiniHot: { backgroundColor: '#16a34a' },
  inviteMiniText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  commentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
  },
  commentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 80,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: '#fff',
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.4 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    backgroundColor: '#111',
    gap: 8,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  livePillText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  topTitle: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 14 },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16a34a',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  inviteBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
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
    gap: 12,
  },
  loadingText: { color: '#94a3b8', fontWeight: '600' },
  err: { color: '#fca5a5', fontWeight: '600', textAlign: 'center' },
  sheetBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  sheetSub: { color: '#64748b', marginTop: 4, marginBottom: 12, fontSize: 13 },
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  empName: { fontSize: 16, fontWeight: '600', color: '#111' },
  empAction: { color: '#16a34a', fontWeight: '800' },
  sheetClose: {
    marginTop: 12,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  sheetCloseText: { fontWeight: '700', color: '#334155' },
});
