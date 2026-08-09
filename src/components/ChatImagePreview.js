import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import { spacing } from '../theme';
import { useStyles } from '../context/ThemeContext';

const { width: WIN_W, height: WIN_H } = Dimensions.get('window');

function ZoomableImage({ uri }) {
  const [zoom, setZoom] = useState(1);
  const styles = useStyles(makeStyles);

  const zoomBy = (delta) => setZoom((z) => Math.min(5, Math.max(1, +(z + delta).toFixed(2))));

  const onPinchStateChange = (e) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      setZoom((z) => Math.min(5, Math.max(1, +(z * e.nativeEvent.scale).toFixed(2))));
    }
  };

  const controls = (
    <View style={styles.zoomControls}>
      <TouchableOpacity style={styles.zoomBtn} onPress={() => zoomBy(-0.35)}>
        <Text style={styles.zoomBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
      <TouchableOpacity style={styles.zoomBtn} onPress={() => zoomBy(0.35)}>
        <Text style={styles.zoomBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.zoomWrap}>
        <ScrollView
          style={styles.scrollZoom}
          contentContainerStyle={styles.scrollZoomContent}
          maximumZoomScale={5}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bouncesZoom
        >
          <Image source={{ uri }} style={styles.fullImage} resizeMode="contain"/>
        </ScrollView>
        {controls}
      </View>
    );
  }

  return (
    <View style={styles.zoomWrap}>
      <PinchGestureHandler onHandlerStateChange={onPinchStateChange}>
        <View style={styles.pinchWrap}>
          <Image
            source={{ uri }}
            style={[styles.fullImage, { transform: [{ scale: zoom }] }]}
            resizeMode="contain"
          />
        </View>
      </PinchGestureHandler>
      {controls}
    </View>
  );
}

export default function ChatImagePreview({ uri, onClose }) {
  const styles = useStyles(makeStyles);
  if (!uri) return null;
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeTop}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Text style={styles.closeText}></Text>
          </TouchableOpacity>
        </SafeAreaView>
        <ZoomableImage uri={uri} />
        <Text style={styles.hint}>Pinch эсвэл +/− товчоор томруулна</Text>
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
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
  zoomWrap: { flex: 1, justifyContent: 'center'},
  scrollZoom: { flex: 1 },
  scrollZoomContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center'},
  pinchWrap: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  fullImage: { width: WIN_W, height: WIN_H * 0.72 },
  zoomControls: {
    position: 'absolute',
    bottom: 52,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  zoomBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 30 },
  zoomLabel: { color: '#fff', fontSize: 13, fontWeight: '600', minWidth: 44, textAlign: 'center'},
  hint: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    color: colors.textFaint,
    fontSize: 11,
  },
});
