import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, Alert } from 'react-native';
import { useFaceDetection } from '@infinitered/react-native-mlkit-face-detection';
import { useApp } from '../context/AppContext';
import SelfieCamera from './SelfieCamera';
import * as attApi from '../services/attendanceService';
import * as faceApi from '../services/faceService';
import * as tracking from '../services/trackingService';
import { Button } from './ui';
import { spacing, radius } from '../theme';
import { useStyles } from '../context/ThemeContext';

// Байршилд очсон үед царайгаар баталгаажуулж, админд зураг харагдана
export default function SiteVisitVerifier() {
  const faceDetector = useFaceDetection();
  const { isCloud, currentUser, pendingVisit, setPendingVisit } = useApp();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [faceTemplates, setFaceTemplates] = React.useState([]);
  const styles = useStyles(makeStyles);

  React.useEffect(() => {
    if (!isCloud || !currentUser?.id) return;
    faceApi.getFaceTemplates(currentUser.id).then(setFaceTemplates).catch(() => {});
  }, [isCloud, currentUser?.id]);

  if (!isCloud || !pendingVisit) return null;

  const dismiss = () => setPendingVisit(null);

  const handleCapture = async (photo) => {
    setBusy(true);
    try {
      const vr = await faceApi.verifyFace(photo.uri, faceTemplates, faceDetector, {
        expectedPose: 'liveness_center',
      });
      if (!vr.match) {
        Alert.alert('Царай таарсангүй', 'Таны бүртгэлтэй царайтай таарахгүй байна. Дахин оролдоно уу.');
        return;
      }
      const photoUrl = await attApi.uploadSelfie(photo.uri, currentUser.id);
      await tracking.logVisit({
        ...pendingVisit,
        photoUrl,
        faceVerified: vr.match,
        locationName: pendingVisit.customer || pendingVisit.locationName,
      });
      setCameraVisible(false);
      setPendingVisit(null);
      Alert.alert('Баталгаажлаа', `${pendingVisit.customer || 'Байршил'} дээр очсоныг бүртгэлээ.`);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal visible transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.title}> Байршилд очлоо</Text>
            <Text style={styles.sub}>
              Та <Text style={styles.bold}>{pendingVisit.customer || 'байршил'}</Text> дээр очсон байна.
              Царайгаа баталгаажуулж, очлогыг бүртгүүлнэ үү.
            </Text>
            <View style={styles.btnRow}>
              <Button title="Дараа" variant="ghost" style={{ flex: 1 }} onPress={dismiss} />
              <Button title="Царай батлах" style={{ flex: 1 }} onPress={() => setCameraVisible(true)} />
            </View>
          </View>
        </View>
      </Modal>
      <SelfieCamera
        visible={cameraVisible}
        busy={busy}
        auto
        autoDelayMs={2000}
        onClose={() => setCameraVisible(false)}
        onCapture={handleCapture}
      />
    </>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end'},
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '800', marginBottom: spacing.xs },
  sub: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  bold: { color: colors.text, fontWeight: '800'},
  btnRow: { flexDirection: 'row', gap: spacing.md },
});
