import React from 'react';
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
import { spacing } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

// Нэвтрэлт (Google sign-in) шаарддаггүй нээлттэй Jitsi сервер.
// meet.jit.si нь өрөө үүсгэхэд Google auth шаарддаг болсон тул ашиглахгүй.
const JITSI_DOMAIN = 'meet.ffmuc.net';

function buildHtml(room, name) {
  const safeRoom = String(room).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeName = String(name || 'Ажилтан').replace(/["'<>]/g, '');
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content=" width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
    <style>html,body,#meet{height:100%;margin:0;padding:0;background:#000;overflow:hidden}</style>
  </head>
  <body>
    <div id="meet"></div>
    <script src="https://${JITSI_DOMAIN}/external_api.js"></script>
    <script>
      function start() {
        try {
          var api = new JitsiMeetExternalAPI('${JITSI_DOMAIN}', {
            roomName: '${safeRoom}',
            parentNode: document.getElementById('meet'),
            width: '100%',
            height: '100%',
            userInfo: { displayName: '${safeName}'},
            configOverwrite: {
              prejoinPageEnabled: false,
              disableDeepLinking: true,
              disableThirdPartyRequests: true,
              startWithAudioMuted: false,
              startWithVideoMuted: false
            },
            interfaceConfigOverwrite: {
              MOBILE_APP_PROMO: false,
              SHOW_JITSI_WATERMARK: false,
              TOOLBAR_BUTTONS: ['microphone','camera','hangup','tileview','chat','togglecamera']
            }
          });
          api.addEventListener('readyToClose', function () {
            if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('close');
          });
        } catch (e) {
          document.body.innerHTML = '<div style="color:#fff;padding:20px;font-family:sans-serif">Дуудлага эхлүүлэхэд алдаа гарлаа: '+ e.message + '</div>';
        }
      }
      if (window.JitsiMeetExternalAPI) start();
      else {
        var t = setInterval(function(){ if (window.JitsiMeetExternalAPI){ clearInterval(t); start(); } }, 200);
      }
    </script>
  </body>
</html>`;
}

export default function VideoCallModal({ visible, room, name, onClose }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Text style={styles.topTitle}> Видео дуудлага</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Дуусгах</Text>
          </TouchableOpacity>
        </View>
        {visible ? (
          <WebView
            source={{ html: buildHtml(room, name), baseUrl: `https://${JITSI_DOMAIN}` }}
            style={{ flex: 1, backgroundColor: '#000'}}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            userAgent={
              Platform.OS === 'android'
                ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
                : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
            }
            allowsProtectedMedia
            onMessage={(e) => {
              if (e.nativeEvent.data === 'close') onClose?.();
            }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Дуудлага холбож байна...</Text>
              </View>
            )}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000'},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
  },
  topTitle: { color: colors.text, fontSize: 16, fontWeight: '800'},
  closeBtn: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  closeText: { color: '#fff', fontWeight: '800'},
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  loadingText: { color: colors.textMuted, marginTop: spacing.md },
});
