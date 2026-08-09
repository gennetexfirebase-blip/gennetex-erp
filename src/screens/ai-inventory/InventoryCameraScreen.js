import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { ScreenHeader, Button } from '../../components/ui';
import InventoryCategoryTabs from '../../components/InventoryCategoryTabs';
import * as aiApi from '../../services/aiInventoryService';
import InventoryPipeline from '../../ai-inventory/pipeline/InventoryPipeline';
import { getInventorySettings } from '../../ai-inventory/store/inventorySettingsStore';
import { spacing, radius } from '../../theme';
import { useTheme, useStyles } from '../../context/ThemeContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PREVIEW_H = SCREEN_H * 0.55;

/**
 * Pipeline:
 * Expo Camera → Frame Processor (interval) → YOLO Nano (fallback/native) → ByteTrack → Counter → Results/Supabase
 */
export default function InventoryCameraScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const { currentUser } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const pipelineRef = useRef(new InventoryPipeline());
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [summary, setSummary] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [backend, setBackend] = useState('fallback');
  const [initError, setInitError] = useState(null);
  const [fps, setFps] = useState(0);
  const [live, setLive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const intervalRef = useRef(null);
  const fpsRef = useRef({ n: 0, t: Date.now() });

  const syncState = useCallback((result) => {
    setTracks(result.tracks || []);
    setSummary(result.summary || []);
    setTotalCount(result.totalCount || 0);
    if (result.backend) setBackend(result.backend);
  }, []);

  const load = useCallback(async () => {
    try {
      const list = await aiApi.fetchProducts({ category: categoryFilter });
      setProducts(list);
      setSelectedId((prev) => (list.some((p) => p.id === prev) ? prev : list[0]?.id || null));
      pipelineRef.current.reset();
      pipelineRef.current.setProducts(list);
      const backendName = await pipelineRef.current.init(list);
      setBackend(backendName);
      setInitError(pipelineRef.current.initError || null);
      setTracks([]);
      setSummary([]);
      setTotalCount(0);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
      setInitError(e.message);
    }
  }, [categoryFilter]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [load])
  );

  const selectedProduct = products.find((p) => p.id === selectedId) || products[0];

  const processFrame = useCallback(async () => {
    let uri = null;
    // ONNX path: capture frame on-device and run YOLO tensor inference
    if (backend.startsWith('onnx') && cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.4,
          skipProcessing: true,
          shutterSound: false,
        });
        uri = photo?.uri || null;
      } catch (e) {}
    }
    const result = await pipelineRef.current.processFrame({
      width: SCREEN_W,
      height: PREVIEW_H,
      uri,
    });
    syncState(result);
    const now = Date.now();
    fpsRef.current.n += 1;
    if (now - fpsRef.current.t >= 1000) {
      setFps(fpsRef.current.n);
      fpsRef.current = { n: 0, t: now };
    }
  }, [syncState, backend]);

  useEffect(() => {
    if (!live) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return undefined;
    }
    const settings = getInventorySettings();
    const fpsLimit = Math.max(5, Math.min(30, settings.fpsLimit || 15));
    const intervalMs = backend.startsWith('onnx')
      ? Math.max(400, Math.round(1000 / Math.min(fpsLimit, 8)))
      : Math.max(200, Math.round(1000 / fpsLimit));
    intervalRef.current = setInterval(() => {
      processFrame();
    }, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [live, processFrame, products, backend]);

  const onPreviewPress = (evt) => {
    if (!selectedProduct) {
      Alert.alert('Анхаар', 'Эхлээд бүтээгдэхүүн сонгоно уу.');
      return;
    }
    const { locationX, locationY } = evt.nativeEvent;
    const result = pipelineRef.current.addManualDetection(
      selectedProduct,
      locationX / SCREEN_W,
      locationY / PREVIEW_H,
      0.97
    );
    syncState(result);
  };

  const runAiDetect = async () => {
    if (!products.length) {
      Alert.alert(
        'Анхаар',
        categoryFilter === 'tool'
          ? 'Багаж бүртгэгдээгүй. Багаж хэсэгт бүртгээд training зураг нэмнэ үү.'
          : categoryFilter === 'material'
            ? 'Бараа материал бүртгэгдээгүй. Бараа материал хэсэгт бүртгээд training зураг нэмнэ үү.'
            : 'Бүтээгдэхүүн бүртгэгдээгүй. Бараа материал эсвэл багаж хэсэгт бүртгэнэ үү.'
      );
      return;
    }
    await processFrame();
  };

  const clearAll = () => {
    pipelineRef.current.reset();
    pipelineRef.current.setProducts(products);
    setTracks([]);
    setSummary([]);
    setTotalCount(0);
  };

  const goResults = async () => {
    const snap = pipelineRef.current.getSnapshot();
    if (!snap.summary.length) {
      Alert.alert('Анхаар', 'Тооллого хийгээгүй байна.');
      return;
    }
    setBusy(true);
    try {
      let evidenceUrl = null;
      let evidenceUri = null;
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.6,
          skipProcessing: true,
        });
        evidenceUri = photo?.uri;
        if (evidenceUri) evidenceUrl = await aiApi.uploadEvidence(evidenceUri);
      }
      navigation.navigate('InventoryResult', {
        summary: snap.summary,
        tracks: snap.allTracks,
        evidenceUrl,
        employeeId: currentUser?.id,
        employeeName: currentUser?.name,
        backend,
      });
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="AI тооллого" />
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="AI тооллого" />
        <View style={styles.center}>
          <Text style={styles.permText}>Камерын зөвшөөрөл шаардлагатай</Text>
          <Button title="Зөвшөөрөх" onPress={requestPermission} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="AI тооллого"
        subtitle={`${totalCount} unique · ${summary.length} төрөл · ${backend}`}
      />

      <InventoryCategoryTabs value={categoryFilter} onChange={setCategoryFilter} />

      <View style={styles.previewWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <Pressable style={styles.overlay} onPress={onPreviewPress}>
          {tracks.map((t) => (
            <View
              key={t.trackId}
              style={[
                styles.bbox,
                {
                  left: t.x * SCREEN_W - 24,
                  top: t.y * PREVIEW_H - 24,
                },
              ]}
            >
              <Text style={styles.bboxLabel} numberOfLines={1}>
                {t.productName?.slice(0, 8)} #{String(t.trackId).slice(-3)}{' '}
                {((t.confidence || 0) * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </Pressable>
        <View style={styles.liveBadge}>
          <View style={[styles.liveDot, live && styles.liveDotOn]} />
          <Text style={styles.liveText}>
            {live ? 'LIVE' : 'PAUSE'} · {backend} · {fps} FPS
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeNum}>{totalCount}</Text>
          <Text style={styles.countBadgeLabel}>ширхэг</Text>
        </View>
      </View>

      {initError ? (
        <Text style={styles.errorBanner}>
          Model: {initError} · Settings дээр YOLO татна уу
        </Text>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRow}>
        {products.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.productChip, selectedId === p.id && styles.productChipOn]}
            onPress={() => setSelectedId(p.id)}
          >
            <Text
              style={[styles.productChipText, selectedId === p.id && styles.productChipTextOn]}
              numberOfLines={1}
            >
              {p.name}
            </Text>
            <Text style={styles.productStock}>
              {aiApi.getProductCategoryLabel(p.category)} · үлд: {p.stock}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.summaryBar}>
        {summary.length === 0 ? (
          <Text style={styles.hint}>LIVE тооллого эсвэл дэлгэц дээр дарж нэмнэ үү</Text>
        ) : (
          summary.map((s) => (
            <View key={s.productId || s.productName} style={styles.sumItem}>
              <Text style={styles.sumName} numberOfLines={1}>
                {s.productName}
              </Text>
              <Text style={styles.sumQty}>{s.quantity}</Text>
              <Text style={styles.sumConf}>{((s.confidence || 0) * 100).toFixed(0)}%</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setLive((v) => !v)}>
          <Ionicons name={live ? 'pause' : 'play'} size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={runAiDetect}>
          <Ionicons name="scan" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={clearAll}>
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
        </TouchableOpacity>
        <Button
          title={busy ? '...' : 'Үр дүн'}
          style={{ flex: 1 }}
          onPress={goResults}
          disabled={busy || totalCount <= 0}
        />
      </View>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  permText: { color: colors.textMuted, marginBottom: spacing.md },
  previewWrap: { height: PREVIEW_H, backgroundColor: '#000', overflow: 'hidden' },
  camera: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject },
  bbox: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: '#22c55e',
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  bboxLabel: {
    position: 'absolute',
    top: -18,
    left: 0,
    right: -50,
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  liveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9ca3af' },
  liveDotOn: { backgroundColor: '#ef4444' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  errorBanner: {
    color: colors.danger,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 12,
  },
  countBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(8,102,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  countBadgeNum: { color: '#fff', fontSize: 22, fontWeight: '900' },
  countBadgeLabel: { color: '#fff', fontSize: 10, fontWeight: '700' },
  productRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 8 },
  productChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    maxWidth: 140,
  },
  productChipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  productChipText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  productChipTextOn: { color: colors.primary },
  productStock: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  summaryBar: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  hint: { color: colors.textMuted, fontSize: 13 },
  sumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sumName: { color: colors.text, fontWeight: '700', fontSize: 12, maxWidth: 90 },
  sumQty: { color: colors.primary, fontWeight: '900', fontSize: 16 },
  sumConf: { color: colors.textMuted, fontSize: 11 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
