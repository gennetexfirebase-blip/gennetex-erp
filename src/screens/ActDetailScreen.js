import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, Linking, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useTheme, useStyles } from '../context/ThemeContext';
import { ScreenHeader, Button, LoadingState, EmptyState } from '../components/ui';
import { Box, Chip, PillButton } from '../components/ds';
import { hasPermission } from '../lib/permissions';
import * as actApi from '../services/actService';

const CHECK = { yes: ['Тийм', 'ok'], no: ['Үгүй', 'bad'], na: ['Х/Б', 'muted'] };

/**
 * Актын дэлгэрэнгүй.
 *   Зохиогч (ноорог) — Засах, Илгээх
 *   Захирал / админ (илгээсэн) — Баталгаажуулах, Буцаах
 */
export default function ActDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { authProfile } = useApp();
  const id = route.params?.id;

  const [act, setAct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAct(await actApi.fetchAct(id));
      setError(null);
    } catch (e) {
      setError(actApi.actError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!act) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Акт" />
        {loading ? <LoadingState /> : <EmptyState title="Акт нээгдсэнгүй" text={error || ''} />}
      </View>
    );
  }

  const st = actApi.ACT_STATUS[act.status] || actApi.ACT_STATUS.draft;
  const isOwner = act.created_by === authProfile?.id;
  // Баталгаажуулах, буцаах — зөвхөн Захирал (сервер ч ижил шалгана).
  const isDirector = actApi.isActDirector(authProfile);
  const canEditDraft = act.status === 'draft' && ((isOwner && hasPermission(authProfile, 'acts.create')) || isDirector);
  const canDecide = act.status === 'ready' && isDirector;
  const receivers = act.receivers.filter((r) => r.is_enabled !== false);

  const run = async (fn, okText) => {
    setBusy(true);
    try {
      await fn();
      if (okText) Alert.alert('Амжилттай', okText);
      await load();
    } catch (e) {
      Alert.alert('Алдаа', actApi.actError(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    Alert.alert('Илгээх', 'Актыг Захирал болон sysadmin руу илгээх үү?', [
      { text: 'Болих', style: 'cancel' },
      { text: 'Илгээх', onPress: () => run(() => actApi.submitAct(act, { authorName: authProfile?.name }), 'Акт Захиралд илгээгдлээ.') },
    ]);
  const approve = () =>
    Alert.alert('Баталгаажуулах', `${act.act_number} актыг баталгаажуулах уу? Женнетексийн тамга таны гарын үсгийн хэсэгт дарагдана.`, [
      { text: 'Болих', style: 'cancel' },
      { text: 'Баталгаажуулах', onPress: () => run(() => actApi.approveAct(act), 'Акт баталгаажлаа.') },
    ]);
  const sendBack = () =>
    Alert.alert('Буцаах', 'Актыг засуулахаар зохиогч руу буцаах уу?', [
      { text: 'Болих', style: 'cancel' },
      { text: 'Буцаах', style: 'destructive', onPress: () => run(() => actApi.returnAct(act), 'Акт буцаагдлаа.') },
    ]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={act.project_name || 'Нэргүй ажил'}
        subtitle={act.act_number}
        right={canEditDraft ? <PillButton title="Засах" icon="create-outline" soft onPress={() => navigation.navigate('ActEditor', { id: act.id })} /> : null}
      />
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}>
        <Box pad>
          <View style={styles.statusRow}>
            <Chip text={st.label} tone={st.tone} />
            <Text style={styles.muted}>{String(act.created_at || '').slice(0, 10)}</Text>
          </View>
          {[
            ['Зохиогч', act.created_by_name],
            ['Захиалагч', act.customer_name],
            ['Байршил', act.location],
            ['Хугацаа', [act.start_date, act.end_date].filter(Boolean).join(' – ')],
            ['Гүйцэтгэгч', act.contractor_name],
            ['Баталгаажуулсан', act.approved_by_name ? `${act.approved_by_name} · ${String(act.approved_at || '').slice(0, 10)}` : ''],
          ]
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <View key={label} style={styles.kv}>
                <Text style={styles.kvLabel}>{label}</Text>
                <Text style={styles.kvValue}>{value}</Text>
              </View>
            ))}
        </Box>

        {act.work_description ? (
          <Box pad>
            <Text style={styles.secTitle}>Хийсэн ажил</Text>
            <Text style={styles.body2}>{act.work_description}</Text>
          </Box>
        ) : null}

        {act.materials.length ? (
          <Box style={{ paddingVertical: 4 }}>
            <Text style={[styles.secTitle, { paddingHorizontal: 16, paddingTop: 12 }]}>Бараа материал</Text>
            {act.materials.map((m, i) => (
              <View key={m.id || i} style={[styles.item, i > 0 && styles.itemBorder]}>
                <Text style={styles.itemName} numberOfLines={2}>{m.material_name}</Text>
                <Text style={styles.itemQty}>{m.quantity} {m.unit}</Text>
              </View>
            ))}
          </Box>
        ) : null}

        {act.checklists.length ? (
          <Box style={{ paddingVertical: 4 }}>
            <Text style={[styles.secTitle, { paddingHorizontal: 16, paddingTop: 12 }]}>Шалгах хуудас</Text>
            {act.checklists.map((c, i) => {
              const [label, tone] = CHECK[c.result] || CHECK.na;
              return (
                <View key={c.id || i} style={[styles.item, i > 0 && styles.itemBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{c.requirement}</Text>
                    {c.reason ? <Text style={styles.muted}>{c.reason}</Text> : null}
                  </View>
                  <Chip text={label} tone={tone} />
                </View>
              );
            })}
          </Box>
        ) : null}

        {act.photos.length ? (
          <Box pad>
            <Text style={styles.secTitle}>Зураг</Text>
            <View style={styles.photos}>
              {act.photos.map((p, i) => (
                <Image key={p.id || i} source={{ uri: p.preview_url || p.image_url }} style={styles.photo} />
              ))}
            </View>
          </Box>
        ) : null}

        {receivers.length ? (
          <Box style={{ paddingVertical: 4 }}>
            <Text style={[styles.secTitle, { paddingHorizontal: 16, paddingTop: 12 }]}>Хүлээлцэх хүмүүс</Text>
            {receivers.map((r, i) => {
              const director = r.type === 'contractor' && /захирал/i.test(r.position || '');
              return (
                <View key={r.id || i} style={[styles.recv, i > 0 && styles.itemBorder]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{r.name || '—'}</Text>
                    <Text style={styles.muted} numberOfLines={2}>{[r.position, r.organization].filter(Boolean).join(' · ')}</Text>
                    {director && !r.stamp_preview_url ? (
                      <Text style={styles.stampHint}>
                        {act.status === 'approved' || act.status === 'delivered' ? 'Тамга дарагдаагүй' : 'Захирал баталгаажуулахад тамга дарагдана'}
                      </Text>
                    ) : null}
                  </View>
                  {r.signature_preview_url ? <Image source={{ uri: r.signature_preview_url }} style={styles.sign} resizeMode="contain" /> : null}
                  {r.stamp_preview_url ? <Image source={{ uri: r.stamp_preview_url }} style={styles.stamp} resizeMode="contain" /> : null}
                </View>
              );
            })}
          </Box>
        ) : null}

        {act.audit.length ? (
          <Box style={{ paddingVertical: 4 }}>
            <Text style={[styles.secTitle, { paddingHorizontal: 16, paddingTop: 12 }]}>Түүх</Text>
            {act.audit.slice(0, 8).map((a, i) => (
              <View key={a.id || i} style={[styles.item, i > 0 && styles.itemBorder]}>
                <Text style={[styles.itemName, { fontWeight: '500' }]} numberOfLines={2}>
                  <Text style={{ fontWeight: '700' }}>{a.actor_name || '—'}</Text> {actApi.ACT_AUDIT_LABELS[a.event_type] || a.event_type}
                </Text>
                <Text style={styles.time}>{String(a.created_at || '').slice(5, 16).replace('T', ' ')}</Text>
              </View>
            ))}
          </Box>
        ) : null}

        {actApi.canSeeAllActs(authProfile) ? (
          <Button
            title="Вэбээс PDF / гарын үсэг"
            variant="ghost"
            onPress={() => Linking.openURL(`${actApi.ACT_WEB_URL}/admin/documents/acts/${act.id}`)}
          />
        ) : null}
      </ScrollView>

      {canDecide || (canEditDraft && isOwner) ? (
        <SafeAreaView edges={['bottom']} style={styles.footbar}>
          {canDecide ? (
            <>
              <Button title="Буцаах" variant="danger" style={{ flex: 1 }} onPress={sendBack} disabled={busy} />
              <Button title="Баталгаажуулах" style={{ flex: 1.5 }} onPress={approve} loading={busy} disabled={busy} />
            </>
          ) : (
            <Button title="Захиралд илгээх" style={{ flex: 1 }} onPress={submit} loading={busy} disabled={busy} />
          )}
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.ground },
    body: { paddingHorizontal: 16, paddingBottom: 40 },
    statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    muted: { color: colors.muted, fontSize: 13 },
    kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
    kvLabel: { color: colors.muted, fontSize: 14 },
    kvValue: { color: colors.ink, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
    secTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 10 },
    body2: { color: colors.ink, fontSize: 15, lineHeight: 22 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    itemBorder: { borderTopWidth: 1, borderTopColor: colors.line },
    itemName: { flex: 1, color: colors.ink, fontSize: 14.5, fontWeight: '600' },
    itemQty: { color: colors.ink, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
    time: { color: colors.faint, fontSize: 12, fontVariant: ['tabular-nums'] },
    photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    photo: { width: 100, height: 100, borderRadius: 14, backgroundColor: colors.field },
    recv: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16 },
    stampHint: { color: colors.warn, fontSize: 12, fontWeight: '600', marginTop: 4 },
    sign: { width: 64, height: 40 },
    stamp: { width: 72, height: 72 },
    footbar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
  });
