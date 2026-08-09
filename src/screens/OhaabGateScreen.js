import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Card, Button, SectionTitle } from '../components/ui';
import SignaturePad from '../components/SignaturePad';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { APP_VERSION_LABEL } from '../version';
import * as ohaabApi from '../services/ohaabService';

const SCROLL_END_THRESHOLD = 48;

// Апп руу орохоос өмнө: ХААБ зааврыг бүрэн уншиж, гарын үсэг зурж баталгаажуулна.
export default function OhaabGateScreen({ onComplete }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, authProfile, signOut } = useApp();

  const [instruction, setInstruction] = useState(null);
  const [initLoading, setInitLoading] = useState(true);
  const [readComplete, setReadComplete] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [sigSvg, setSigSvg] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setInitLoading(true);
    try {
      const inst = await ohaabApi.fetchInstruction();
      // Заавар хоосон бол баталгаажуулах зүйлгүй тул шууд оруулна.
      if (!(inst?.body || '').trim()) {
        onComplete?.();
        return;
      }
      setInstruction(inst);
    } catch (e) {
      // Алдаа гарвал хатуу блоклохгүй — оруулна.
      onComplete?.();
      return;
    } finally {
      setInitLoading(false);
    }
  }, [onComplete]);

  useEffect(() => {
    load();
  }, [load]);

  const onScroll = (e) => {
    if (readComplete) return;
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const atEnd =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - SCROLL_END_THRESHOLD;
    if (atEnd) setReadComplete(true);
  };

  const onContentSizeChange = (_w, h) => {
    setContentHeight(h);
    if (viewportHeight > 0 && h <= viewportHeight + SCROLL_END_THRESHOLD) {
      setReadComplete(true);
    }
  };

  const onLayout = (e) => {
    const h = e.nativeEvent.layout.height;
    setViewportHeight(h);
    if (contentHeight > 0 && contentHeight <= h + SCROLL_END_THRESHOLD) {
      setReadComplete(true);
    }
  };

  const submit = async () => {
    if (!readComplete) {
      Alert.alert('Анхаар', 'Зааврыг доош гүйлгэж бүрэн уншина уу.');
      return;
    }
    if (!sigSvg.trim()) {
      Alert.alert('Анхаар', 'Гарын үсэг зурна уу.');
      return;
    }
    setLoading(true);
    try {
      await ohaabApi.submitDailyAck({
        userId: currentUser.id,
        userName: authProfile?.name || currentUser?.name,
        signatureSvg: sigSvg,
        instructionUpdatedAt: instruction?.updated_at,
      });
      onComplete?.();
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Хадгалахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Гарах', 'Системээс гарах уу?', [
      { text: 'Болих', style: 'cancel' },
      { text: 'Гарах', style: 'destructive', onPress: signOut },
    ]);
  };

  if (initLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.splashText}>ХААБ заавар ачаалж байна...</Text>
      </View>
    );
  }

  const body = (instruction?.body || '').trim();

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Өнөөдрийн ХААБ заавар</Text>
            <Text style={styles.headerSub}>
              Уншиж, гарын үсэг зурсны дараа апп нээгдэнэ
            </Text>
          </View>
          <TouchableOpacity style={styles.signOut} onPress={confirmSignOut} hitSlop={8}>
            <Text style={styles.signOutText}>Гарах</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.instHead}>
            <SectionTitle>{instruction?.title || 'ХААБ заавар'}</SectionTitle>
          </View>
          {instruction?.updated_by_name ? (
            <Text style={styles.meta}>
              Шинэчилсэн: {instruction.updated_by_name}
              {instruction.updated_at
                ? ` · ${new Date(instruction.updated_at).toLocaleString('mn-MN')}`
                : ''}
            </Text>
          ) : null}
          <ScrollView
            style={styles.instructionScroll}
            nestedScrollEnabled
            onScroll={onScroll}
            scrollEventThrottle={16}
            onContentSizeChange={onContentSizeChange}
            onLayout={onLayout}
          >
            <Text style={styles.instructionText}>{body}</Text>
          </ScrollView>
          <Text style={[styles.readHint, readComplete && styles.readDone]}>
            {readComplete
              ? '✓ Зааврыг уншсан — доор гарын үсэг зурна уу'
              : '↓ Зааврыг доош гүйлгэж бүрэн уншина уу'}
          </Text>
        </Card>

        <Card>
          <SectionTitle>Гарын үсэг</SectionTitle>
          <Text style={styles.signHint}>
            Дээрх зааврыг уншиж танилцсанаа гарын үсгээр баталгаажуулна.
          </Text>
          <SignaturePad onChange={setSigSvg} />
          <Button
            title={loading ? 'Илгээж байна...' : 'Баталгаажуулж, апп руу орох'}
            onPress={submit}
            disabled={loading || !readComplete}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <Text style={styles.version}>{APP_VERSION_LABEL}</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashText: { color: colors.textMuted, marginTop: spacing.md, fontSize: 13 },
  header: {
    backgroundColor: colors.surfaceDim,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant + '55',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm },
  headerTitle: { color: colors.onSurface, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  signOut: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger + '55',
    backgroundColor: colors.danger + '15',
  },
  signOutText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  instHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  instructionScroll: {
    maxHeight: 340,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgAlt,
    padding: spacing.md,
  },
  instructionText: { color: colors.text, fontSize: 15, lineHeight: 24 },
  readHint: { color: colors.warning, fontSize: 13, fontWeight: '600', marginTop: spacing.md },
  readDone: { color: colors.success },
  signHint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md, lineHeight: 19 },
  version: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: spacing.lg },
});
