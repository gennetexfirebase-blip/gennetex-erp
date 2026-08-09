import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button, ScreenHeader, SectionTitle, Badge } from '../components/ui';
import SignaturePad from '../components/SignaturePad';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as ohaabApi from '../services/ohaabService';

const SCROLL_END_THRESHOLD = 48;

export default function OhaabScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser, authProfile, isCloud } = useApp();
  const [instruction, setInstruction] = useState(null);
  const [todayAck, setTodayAck] = useState(null);
  const [readComplete, setReadComplete] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [sigSvg, setSigSvg] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const [inst, ack] = await Promise.all([
        ohaabApi.fetchInstruction(),
        ohaabApi.fetchMyTodayAck(currentUser.id),
      ]);
      setInstruction(inst);
      setTodayAck(ack);
      if (ack) setReadComplete(true);
    } catch (e) {
      setInstruction(null);
      setTodayAck(null);
    }
  }, [currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onScroll = (e) => {
    if (readComplete || todayAck) return;
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const atEnd =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - SCROLL_END_THRESHOLD;
    if (atEnd) setReadComplete(true);
  };

  const onContentSizeChange = (_w, h) => {
    setContentHeight(h);
    if (!todayAck && viewportHeight > 0 && h <= viewportHeight + SCROLL_END_THRESHOLD) {
      setReadComplete(true);
    }
  };

  const onLayout = (e) => {
    const h = e.nativeEvent.layout.height;
    setViewportHeight(h);
    if (!todayAck && contentHeight > 0 && contentHeight <= h + SCROLL_END_THRESHOLD) {
      setReadComplete(true);
    }
  };

  const submit = async () => {
    if (!readComplete && !todayAck) {
      Alert.alert('Анхаар', 'Зааврыг доош гүйлгэж бүрэн уншина уу.');
      return;
    }
    if (!sigSvg.trim()) {
      Alert.alert('Анхаар', 'Гарын үсэг зурна уу.');
      return;
    }
    setLoading(true);
    try {
      const ack = await ohaabApi.submitDailyAck({
        userId: currentUser.id,
        userName: authProfile?.name || currentUser?.name,
        signatureSvg: sigSvg,
        instructionUpdatedAt: instruction?.updated_at,
      });
      setTodayAck(ack);
      Alert.alert('Амжилттай', 'Өнөөдрийн ХААБ заавар баталгаажлаа.');
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Хадгалахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const body = (instruction?.body || '').trim();
  const signedToday = !!todayAck;

  return (
    <View style={styles.container}>
      <ScreenHeader title="ХААБ заавар" subtitle="Өдөр бүр уншиж, гарын үсгээр баталгаажуулна" />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {!isCloud ? (
          <Text style={styles.muted}>Supabase холболт шаардлагатай.</Text>
        ) : (
          <>
            <Card>
              <View style={styles.headRow}>
                <SectionTitle>{instruction?.title || 'ХААБ заавар'}</SectionTitle>
                {signedToday ? <Badge text="Өнөөдөр баталсан" color={colors.success} /> : null}
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
                {body ? (
                  <Text style={styles.instructionText}>{body}</Text>
                ) : (
                  <Text style={styles.empty}>Админ ХААБ заавар оруулаагүй байна.</Text>
                )}
              </ScrollView>
              {!signedToday ? (
                <Text style={[styles.readHint, readComplete && styles.readDone]}>
                  {readComplete
                    ? '✓ Зааврыг уншсан — доор гарын үсэг зурна уу'
                    : '↓ Зааврыг доош гүйлгэж бүрэн уншина уу'}
                </Text>
              ) : null}
            </Card>

            {signedToday ? (
              <Card>
                <Text style={styles.doneTitle}>Өнөөдөр баталгаажсан</Text>
                <Text style={styles.doneSub}>
                  {new Date(todayAck.signed_at).toLocaleString('mn-MN')} · Бараа материал, багаж бүртгэх боломжтой.
                </Text>
              </Card>
            ) : (
              <Card>
                <SectionTitle>Гарын үсэг</SectionTitle>
                <SignaturePad onChange={setSigSvg} />
                <Button
                  title={loading ? 'Илгээж байна...' : 'Баталгаажуулах'}
                  onPress={submit}
                  disabled={loading || !readComplete || !body}
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 40 },
  muted: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  meta: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  instructionScroll: {
    maxHeight: 360,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgAlt,
    padding: spacing.md,
  },
  instructionText: { color: colors.text, fontSize: 15, lineHeight: 24 },
  empty: { color: colors.textMuted, fontStyle: 'italic', lineHeight: 22 },
  readHint: { color: colors.warning, fontSize: 13, fontWeight: '600', marginTop: spacing.md },
  readDone: { color: colors.success },
  doneTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  doneSub: { color: colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 20 },
});
