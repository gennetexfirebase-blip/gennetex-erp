import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { spacing } from '../theme';

export default function ChatVideoPreview({ uri, onClose }) {
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);

  if (!uri) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <StatusBar barStyle="light-content"/>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeTop}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Text style={styles.closeText}></Text>
          </TouchableOpacity>
        </SafeAreaView>
        <View style={styles.body}>
          {loading ? <ActivityIndicator size="large" color="#fff" style={styles.loader} /> : null}
          <Video
            ref={videoRef}
            source={{ uri }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000ee'},
  safeTop: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 },
  closeBtn: {
    alignSelf: 'flex-end',
    marginRight: spacing.lg,
    marginTop: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 20, fontWeight: '700'},
  body: { flex: 1, justifyContent: 'center'},
  video: { width: '100%', height: '72%'},
  loader: { position: 'absolute', alignSelf: 'center' },
});
