import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { ScreenHeader, Card, Button } from '../../components/ui';
import {
  loadInventorySettings,
  getInventorySettings,
  updateInventorySettings,
} from '../../ai-inventory/store/inventorySettingsStore';
import {
  isOnnxAvailable,
  ensureModelDownloaded,
  loadOnnxSession,
  getOnnxLoadError,
} from '../../ai-inventory/pipeline/OnnxYoloEngine';
import { spacing, radius } from '../../theme';
import { useTheme, useStyles } from '../../context/ThemeContext';

export default function InventorySettingsScreen() {
  const styles = useStyles(makeStyles);
  const [settings, setSettings] = useState(getInventorySettings());
  const [modelStatus, setModelStatus] = useState('unknown');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadInventorySettings().then(setSettings);
    setModelStatus(isOnnxAvailable() ? 'runtime-ok' : 'runtime-missing');
  }, []);

  const save = async (patch) => {
    const next = await updateInventorySettings(patch);
    setSettings(next);
  };

  const downloadModel = async () => {
    setBusy(true);
    try {
      if (!isOnnxAvailable()) {
        Alert.alert(
          'ONNX Runtime',
          'onnxruntime-react-native суулгаад development build хийнэ үү:\nnpx expo run:android'
        );
        return;
      }
      await ensureModelDownloaded((p) => setProgress(p));
      await loadOnnxSession();
      setModelStatus('model-ready');
      Alert.alert('Амжилттай', 'YOLOv8n ONNX model ачаалагдлаа (on-device).');
    } catch (e) {
      setModelStatus('error');
      Alert.alert('Алдаа', e.message || getOnnxLoadError());
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="AI Inventory тохиргоо" subtitle="On-device YOLO · ByteTrack" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.section}>Илрүүлэлт</Text>
          <FieldRow
            label="Confidence Threshold"
            value={String(settings.confidenceThreshold)}
            onChange={(t) => save({ confidenceThreshold: Math.min(0.99, Math.max(0.05, Number(t) || 0.45)) })}
          />
          <FieldRow
            label="Minimum Detection Size"
            value={String(settings.minDetectionSize)}
            onChange={(t) => save({ minDetectionSize: Math.min(0.5, Math.max(0.01, Number(t) || 0.04)) })}
          />
          <FieldRow
            label="Tracking Timeout (frames)"
            value={String(settings.trackingTimeout)}
            onChange={(t) => save({ trackingTimeout: Math.max(5, Number(t) || 30) })}
          />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.section}>Камер</Text>
          <FieldRow
            label="FPS Limit"
            value={String(settings.fpsLimit)}
            onChange={(t) => save({ fpsLimit: Math.min(60, Math.max(5, Number(t) || 15)) })}
          />
          <FieldRow
            label="Camera Resolution"
            value={settings.cameraResolution}
            onChange={(t) => save({ cameraResolution: t || '720p' })}
          />
          <FieldRow
            label="Model Selection"
            value={settings.modelSelection}
            onChange={(t) => save({ modelSelection: t || 'yolov8n' })}
          />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.section}>ONNX Model (on-device)</Text>
          <Text style={styles.meta}>Статус: {modelStatus}</Text>
          {progress > 0 && progress < 1 ? (
            <Text style={styles.meta}>Татаж байна: {(progress * 100).toFixed(0)}%</Text>
          ) : null}
          <Text style={styles.hint}>
            Model утас дээр ажиллана. Сервер AI ашиглахгүй. Оффлайн тооллого хийх боломжтой.
          </Text>
          <Button
            title={busy ? 'Ачаалж байна...' : 'YOLO model татах / ачаалах'}
            onPress={downloadModel}
            disabled={busy}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

function FieldRow({ label, value, onChange }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} />
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },
  section: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  input: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  meta: { color: colors.text, fontSize: 13, marginBottom: 4 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
