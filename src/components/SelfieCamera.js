import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from './ui';
import { spacing } from '../theme';
import { useStyles } from '../context/ThemeContext';

export default function SelfieCamera({
  visible,
  onClose,
  onCapture,
  busy,
  progressText,
  hint,
  auto = false,
  autoDelayMs = 1500,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const styles = useStyles(makeStyles);

  const takePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        // ML Kit frame coordinates and ONNX crop must use the physically rotated JPEG.
        skipProcessing: false,
      });
      onCapture?.(photo);
    } catch (e) {
      console.warn('Зураг авахад алдаа:', e);
    } finally {
      setCapturing(false);
    }
  };

  // Автомат зураг авах — товч дарахгүйгээр тодорхой хугацааны дараа
  useEffect(() => {
    if (!auto || !visible || !permission?.granted || busy || capturing) {
      setCountdown(null);
      return;
    }
    let n = Math.max(1, Math.ceil(autoDelayMs / 1000));
    setCountdown(n);
    const iv = setInterval(() => {
      n -= 1;
      setCountdown(n > 0 ? n : null);
    }, 1000);
    const t = setTimeout(() => {
      takePhoto();
    }, autoDelayMs);
    return () => {
      clearInterval(iv);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, visible, permission?.granted, busy, capturing, autoDelayMs]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.center}>
            <Text style={styles.msg}>Камерын зөвшөөрлийг шалгаж байна...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.msg}>
              Ирц бүртгэхийн тулд камерын зөвшөөрөл шаардлагатай.
            </Text>
            <Button title="Зөвшөөрөл олгох" onPress={requestPermission} />
            <Button title="Хаах" variant="ghost" style={{ marginTop: spacing.md }} onPress={onClose} />
          </View>
        ) : (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front"/>
            <View style={styles.overlay} pointerEvents="none">
              {progressText ? <Text style={styles.progress}>{progressText}</Text> : null}
              <View style={styles.faceFrame}>
                {auto && countdown ? <Text style={styles.countdown}>{countdown}</Text> : null}
              </View>
              <Text style={styles.hint}>
                {busy || capturing
                  ? 'Боловсруулж байна...'
                  : auto
                  ? hint || 'Царайгаа хүрээнд байрлуулаарай — автоматаар авна'
                  : hint || 'Царайгаа хүрээн дунд байрлуулна уу'}
              </Text>
            </View>
            <View style={styles.controls}>
              {busy || capturing ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : auto ? null : (
                <TouchableOpacity style={styles.shutter} onPress={takePhoto}>
                  <View style={styles.shutterInner} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeText}>Хаах</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000'},
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  msg: { color: colors.text, fontSize: 16, textAlign: 'center', marginBottom: spacing.lg },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center'},
  faceFrame: {
    width: 220,
    height: 280,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: 140,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdown: {
    color: '#fff',
    fontSize: 90,
    fontWeight: '900',
    textShadowColor: '#000000aa',
    textShadowRadius: 12,
  },
  hint: {
    color: '#fff',
    marginTop: spacing.lg,
    backgroundColor: '#00000088',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  progress: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.lg,
    backgroundColor: colors.primary + 'cc',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    overflow: 'hidden',
  },
  controls: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center'},
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff'},
  closeBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 30,
  },
  closeText: { color: colors.text, fontWeight: '700', fontSize: 16 },
});
