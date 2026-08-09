import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ERP_NOT_FOUND } from '../lib/erpMessages';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../context/AppContext';
import { CALL_TYPES } from '../data/mockData';
import { siteKindMeta } from '../services/serviceCallService';
import CloseCallModal, { CLOSE_TYPES } from '../components/CloseCallModal';
import TransferCallModal from '../components/TransferCallModal';
import * as tracking from '../services/trackingService';
import * as attApi from '../services/attendanceService';
import {
  canPerformCallActions,
  callDriverLabel,
  getCallCancelNote,
  isCallCancelled,
  isCallRescheduled,
  isSharedCallView,
} from '../lib/callPermissions';
import {
  callDisplayId,
  formatCountdown,
  formatDateTime,
  formatSlaDeadline,
  getSlaDeadline,
  getSlaRemainingMs,
  isSlaExceeded,
  slaAccentColor,
} from '../lib/callSla';
import { callStatusLabelMn, getCallStatusMeta } from '../lib/callStatusColors';
import TeamCrewCard from '../components/TeamCrewCard';
import * as vehicleApi from '../services/vehicleService';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import { notifyCallCloseMismatch } from '../services/engineerPerformanceService';

function typeMeta(key) {
  return CALL_TYPES.find((t) => t.key === key) || CALL_TYPES[CALL_TYPES.length - 1];
}

function StatusBadge({ call }) {
  const styles = useStyles(makeStyles);
  const meta = getCallStatusMeta(call);
  const label = callStatusLabelMn(call);
  return (
    <View style={styles.statusBadgeRow}>
      <View style={[styles.statusCircle, { borderColor: meta.color }]}>
        <Text style={[styles.statusCircleText, { color: meta.color, fontSize: meta.code.length > 2 ? 8 : 10 }]}>
          {meta.code}
        </Text>
      </View>
      <Text style={[styles.statusBadgeLabel, { color: meta.color }]}>{label}</Text>
    </View>
  );
}

async function copyText(label, text) {
  const v = String(text || '').trim();
  if (!v || v === '—') return;
  await Clipboard.setStringAsync(v);
  Alert.alert('Хуулсан', `${label} clipboard-д хадгалагдлаа.`);
}

function Accordion({ title, open, onToggle, children }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.accordion}>
      <TouchableOpacity style={styles.accHead} onPress={onToggle} activeOpacity={0.8}>
        <Text style={styles.accTitle}>{title}</Text>
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {open ? <View style={styles.accBody}>{children}</View> : null}
    </View>
  );
}

function InfoRow({ label, value, link, copyValue }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValWrap}>
        {link && value && value !== '—' ? (
          <TouchableOpacity onPress={() => Linking.openURL(link)}>
            <Text style={[styles.infoValue, styles.infoCopy]}>{value}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.infoValue}>{value || '—'}</Text>
        )}
        {copyValue && copyValue !== '—' ? (
          <TouchableOpacity onPress={() => copyText(label, copyValue)} hitSlop={8}>
            <Ionicons name="copy-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default function CallDetailScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute();
  const {
    updateCallStatus,
    closeCall,
    transferCall,
    currentUser,
    isAdmin,
    consumeItem,
    fetchMyStock,
    inventory,
    isCloud,
    refreshInventory,
  } = useApp();
  const [call, setCall] = useState(route.params?.call);
  const [infoOpen, setInfoOpen] = useState(true);
  const [slaOpen, setSlaOpen] = useState(true);
  const [histOpen, setHistOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(true);
  const [teamCrew, setTeamCrew] = useState(null);
  const [myStock, setMyStock] = useState([]);
  const [tick, setTick] = useState(0);

  const canAct = canPerformCallActions(call, currentUser, isAdmin);
  const sharedView = isSharedCallView(call, currentUser, isAdmin);
  const cancelled = isCallCancelled(call);
  const rescheduled = isCallRescheduled(call);
  const cancelNote = getCallCancelNote(call);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!call) {
        if (active) setTeamCrew(null);
        return;
      }
      try {
        const live = await vehicleApi.fetchActiveTripTeam({
          driverId: call.engineer_id,
          driverName: call.engineer,
        });
        if (!active) return;
        if (live) {
          setTeamCrew(live);
          return;
        }
      } catch (e) {}

      const fallbackPassengers = [];
      if (call.partner_engineer_name) {
        fallbackPassengers.push({
          passenger_id: call.partner_engineer_id,
          passenger_name: call.partner_engineer_name,
          name: call.partner_engineer_name,
        });
      }
      if (active) {
        setTeamCrew({
          driver: { id: call.engineer_id, name: call.engineer || callDriverLabel(call) },
          passengers: fallbackPassengers,
          fallback: true,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [call?.id, call?.engineer_id, call?.engineer, call?.partner_engineer_id, call?.partner_engineer_name]);

  useEffect(() => {
    if (!closeOpen || !isCloud) {
      setMyStock([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        await refreshInventory?.();
        const rows = await fetchMyStock();
        if (active) {
          setMyStock((rows || []).filter((r) => (r.category || 'material') !== 'tool'));
        }
      } catch (e) {
        if (active) setMyStock([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [closeOpen, isCloud, fetchMyStock, refreshInventory]);

  const tm = typeMeta(call?.type);
  const sk = siteKindMeta(call?.site_kind);
  const slaRem = useMemo(() => getSlaRemainingMs(call), [call, tick]);
  const slaColor = slaAccentColor(call);
  const exceeded = isSlaExceeded(call);

  const openMaps = useCallback(() => {
    if (!call?.latitude) {
      Alert.alert('Газрын зураг', 'Байршлын координат байхгүй.');
      return;
    }
    const url = Platform.select({
      ios: `maps://?q=${call.latitude},${call.longitude}`,
      android: `geo:${call.latitude},${call.longitude}?q=${call.latitude},${call.longitude}(${encodeURIComponent(call.customer)})`,
      default: `https://www.google.com/maps/search/?api=1&query=${call.latitude},${call.longitude}`,
    });
    Linking.openURL(url).catch(() => {});
  }, [call]);

  const registerVisit = async (withPhoto = false) => {
    if (!canAct) {
      Alert.alert('Эрхгүй', 'Дuудлага дээр үйлдэл хийх боломжгүй.');
      return;
    }
    if (!currentUser?.id || !call) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Байршил', 'GPS зөвшөөрөл шаардлагатай.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let photoUrl = null;
      if (withPhoto) {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (!cam.granted) {
          Alert.alert('Зөвшөөрөл', 'Камерт зөвшөөрөл өгнө үү.');
          return;
        }
        const shot = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.6 });
        if (shot.canceled) return;
        photoUrl = await attApi.uploadSelfie(shot.assets[0].uri, currentUser.id);
      }
      await tracking.logVisit({
        userId: currentUser.id,
        userName: currentUser.name,
        callId: call.id,
        customer: call.customer,
        problem: call.problem,
        callType: call.type,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        locationName: call.address || call.customer,
        photoUrl,
        faceVerified: false,
      });
      Alert.alert('Бүртгэгдлээ', `${call.customer} дээр очсоныг бүртгэлээ.`);
    } catch (e) {
      Alert.alert('Алдаа', e.message);
    }
  };

  const setStatus = async (status) => {
    if (!canAct) return;
    const updated = await updateCallStatus(call.id, status);
    setCall(updated || { ...call, status, updated_at: new Date().toISOString() });
    setActionOpen(false);
  };

  const handleClose = async (meta) => {
    try {
      let deducted = 0;
      if (meta.materials?.length) {
        for (const m of meta.materials) {
          const row = myStock.find((s) => s.item_id === m.id);
          if (!row || row.quantity <= 0) continue;
          if (m.qty > row.quantity) {
            throw new Error(`"${m.name}" — үлдэгдэл ${row.quantity} ${row.unit} л байна`);
          }
          await consumeItem(row, m.qty);
          deducted += 1;
        }
      }
      const updated = await closeCall(call.id, meta);
      setCall(updated || { ...call, status: 'Дууссан', close_meta: meta });
      setActionOpen(false);
      if (meta.materials?.length && currentUser?.id) {
        try {
          await notifyCallCloseMismatch(
            updated || call,
            currentUser.id,
            currentUser.name || '—',
            meta.materials
          );
        } catch (e) {}
      }
      const used = meta.materials?.length
        ? `\n${meta.materials.length} төрлийн бараа бүртгэгдлээ${deducted ? ` (${deducted} нь үлдэгдлээс хасагдлаа)` : ''}.`
        : '';
      Alert.alert('Амжилттай', `Захиалга хаагдлаа.${used}`);
    } catch (e) {
      Alert.alert('Алдаа', e.message || 'Захиалга хаахад алдаа гарлаа');
      throw e;
    }
  };

  const handleTransfer = async (meta) => {
    try {
      const updated = await transferCall(call.id, meta);
      setCall(updated || call);
      setTransferOpen(false);
      setActionOpen(false);
      if (meta.type === 'Dahimdah' || meta.type === 'Reschedule') {
        const when = updated?.scheduled_at ? formatDateTime(updated.scheduled_at) : 'Маргааш';
        Alert.alert(
          'Дахимдах',
          `Маргааш (${when}) хойшлууллаа.\n\nТаны нэр дээр хэвээр үлдэнэ. 00:00 цагт автоматаар өөр инженер оноогдоно.`
        );
      } else {
        Alert.alert('Татгалзсан', 'Захиалга цуцлагдлаа.');
      }
    } catch (e) {
      Alert.alert('Алдаа', e?.message || 'Шилжүүлэхэд алдаа гарлаа');
      throw e;
    }
  };

  if (!call) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.empty}>{ERP_NOT_FOUND}</Text>
      </SafeAreaView>
    );
  }

  const closeTypeLabel = CLOSE_TYPES.find((t) => t.key === call.close_meta?.close_type)?.label;

  const history = [
    ...(call.close_meta?.transfer
      ? [{
          user: call.close_meta.transfer.by || 'Инженер',
          text: isCallCancelled(call)
            ? `Татгалзсан: ${call.close_meta.transfer.reason || ''}${call.close_meta.transfer.comment ? ` — ${call.close_meta.transfer.comment}` : ''}`
            : isCallRescheduled(call)
              ? `Дахимдах (маргааш): ${call.close_meta.transfer.team_name || call.team_name || ''}${call.close_meta.transfer.comment ? ` — ${call.close_meta.transfer.comment}` : ''}`
              : `Шилжүүлсэн (${call.close_meta.transfer.type}): ${call.close_meta.transfer.reason}`,
          at: call.close_meta.transfer.at || call.updated_at,
        }]
      : []),
    ...(call.close_meta?.closed_at
      ? [{
          user: call.close_meta.closed_by || call.engineer,
          text: `Захиалга хаасан${closeTypeLabel ? ` · ${closeTypeLabel}` : ''}`,
          at: call.close_meta.closed_at,
        }]
      : []),
    { user: call.engineer || currentUser?.name || 'Инженер', text: `Төлөв: ${call.status}`, at: call.updated_at || call.created_at },
    { user: call.created_by_name || 'Админ', text: 'Дуудлага илгэсэн', at: call.created_at },
    { user: 'Систем', text: `Дуудлага үүсгэсэн · ${tm.label}`, at: call.created_at },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Дуудлагын дэлгэрэнгүй</Text>
        <View style={{ width: 22 }} />
      </View>

      {sharedView ? (
        <View style={styles.shareBanner}>
          <Ionicons name="people-outline" size={18} color={colors.primary} />
          <View style={styles.shareTextWrap}>
            <Text style={styles.shareTitle}>Бусад инженерийн</Text>
            {teamCrew ? (
              <TeamCrewCard crew={teamCrew} compact />
            ) : (
              <Text style={styles.shareSub}>Жолооч: {callDriverLabel(call)}</Text>
            )}
          </View>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <View style={styles.sumCol}>
            <Text style={styles.sumVal}>{call.phone || '—'}</Text>
            <Text style={styles.sumSub}>Улаанбаатар</Text>
          </View>
          <View style={styles.sumCol}>
            <Text style={styles.sumVal} numberOfLines={1}>{call.customer}</Text>
            <Text style={styles.sumSub}>{sk.label}</Text>
          </View>
          <View style={styles.sumCol}>
            <Text style={styles.sumVal}>{callDisplayId(call)}</Text>
            <Text style={styles.sumSub}>{call.address?.split(',')[1]?.trim() || '—'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Accordion title="Мэдээлэл" open={infoOpen} onToggle={() => setInfoOpen((v) => !v)}>
            <View style={styles.addrRow}>
              <Text style={styles.addrHead}>{call.address || 'Хаяг байхгүй'}</Text>
              {call.address ? (
                <TouchableOpacity
                  style={styles.addrCopyBtn}
                  onPress={() => copyText('Хаяг', call.address)}
                  hitSlop={8}
                >
                  <Ionicons name="copy-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
            {call.latitude != null && call.longitude != null ? (
              <View style={styles.coordsRow}>
                <Text style={styles.coordsText}>
                  {call.latitude}, {call.longitude}
                </Text>
                <TouchableOpacity
                  onPress={() => copyText('Байршил', `${call.latitude}, ${call.longitude}`)}
                  hitSlop={8}
                >
                  <Ionicons name="copy-outline" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.table}>
              <InfoRow label="Төрөл" value={tm.label} />
              <InfoRow label="Объектын төрөл" value={sk.label} />
              <InfoRow label="Оноогдсон" value={call.engineer || '—'} />
              {call.scheduled_at ? (
                <InfoRow label="Очих огноо" value={formatDateTime(call.scheduled_at)} />
              ) : null}
              <InfoRow label="Илгээсэн админ" value={call.created_by_name || '—'} />
              <InfoRow
                label="Утасны дугаар 1"
                value={call.phone}
                link={call.phone ? `tel:${call.phone}` : null}
                copyValue={call.phone}
              />
              <InfoRow label="Тайлбар" value={call.problem} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Төлөв</Text>
                <View style={styles.infoValWrap}>
                  <StatusBadge call={call} />
                </View>
              </View>
            </View>
            {cancelled && cancelNote ? (
              <View style={styles.cancelNoteBox}>
                <Text style={styles.cancelNoteLabel}>Татгалзсан тайлбар</Text>
                <Text style={styles.cancelNoteText}>{cancelNote}</Text>
              </View>
            ) : null}
          </Accordion>

          <Accordion title="Хамт яваа баг" open={teamOpen} onToggle={() => setTeamOpen((v) => !v)}>
            <TeamCrewCard
              crew={teamCrew}
              emptyText="Идэвхтэй баг байхгүй. Машины QR уншаад ганцаараа эсвэл хамттай явна."
            />
            {teamCrew?.fallback && call.team_name ? (
              <Text style={styles.teamFallback}>Төлөвлөгөөт: {call.team_name}</Text>
            ) : null}
          </Accordion>

          <Accordion title="Хугацааны хязгаар" open={slaOpen} onToggle={() => setSlaOpen((v) => !v)}>
            <View style={styles.table}>
              <InfoRow label="Шалтгаан" value={exceeded ? 'Хугацаа хэтэрсэн' : '—'} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Дуусах хугацаа</Text>
                <Text style={[styles.infoValue, { color: slaColor, fontWeight: '700' }]}>
                  {formatSlaDeadline(getSlaDeadline(call))}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Үлдсэн хугацаа</Text>
                <Text style={[styles.infoValue, { color: slaColor, fontWeight: '700' }]}>
                  {call.status === 'Дууссан' || cancelled ? '—' : formatCountdown(slaRem)}
                </Text>
              </View>
              <InfoRow label="Очих огноо" value={formatDateTime(call.scheduled_at || call.created_at)} />
              <InfoRow label="Шинэчилсэн" value={formatDateTime(call.updated_at || call.created_at)} />
            </View>
          </Accordion>

          <Accordion title="Түүх" open={histOpen} onToggle={() => setHistOpen((v) => !v)}>
            {history.map((h, i) => (
              <View key={i} style={styles.histItem}>
                <Text style={styles.histUser}>{h.user}</Text>
                <Text style={styles.histText}>• {h.text}</Text>
                <Text style={styles.histTime}>{formatDateTime(h.at)}</Text>
              </View>
            ))}
          </Accordion>
        </View>
      </ScrollView>

      {canAct ? (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setActionOpen(true)}>
            <Text style={styles.actionBtnText}>Үйлдэл</Text>
            <Ionicons name="chevron-down" size={16} color={colors.onPrimaryContainer} />
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={actionOpen} transparent animationType="fade" onRequestClose={() => setActionOpen(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setActionOpen(false)}>
          <View style={styles.menuSheet}>
            <MenuBtn
              color="#22c55e"
              label="Захиалга хаах"
              onPress={() => {
                setActionOpen(false);
                setCloseOpen(true);
              }}
            />
            <MenuBtn color="#f59e0b" label="Үргэлжлүүлэх" onPress={() => setStatus('Явж байгаа')} />
            <MenuBtn
              color="#6366f1"
              label="Шилжүүлэх"
              onPress={() => {
                setActionOpen(false);
                setTransferOpen(true);
              }}
            />
            {call.phone ? (
              <MenuBtn color="#22c55e" label={`Залгах · ${call.phone}`} onPress={() => Linking.openURL(`tel:${call.phone}`)} />
            ) : null}
            <MenuBtn color="#1677ff" label="Google Maps-аар чиглүүлэх" onPress={openMaps} />
            <MenuBtn
              color="#06b6d4"
              label="Байршлыг бүртгэх"
              onPress={() => {
                setActionOpen(false);
                Alert.alert('Очсон бүртгэх', 'Баталгаа зураг оруулах уу?', [
                  { text: 'Болих', style: 'cancel' },
                  { text: 'Зураггүй', onPress: () => registerVisit(false) },
                  { text: 'Зураг авах', onPress: () => registerVisit(true) },
                ]);
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <CloseCallModal
        visible={closeOpen}
        callId={call.id}
        stockItems={myStock}
        catalogItems={inventory}
        onClose={() => setCloseOpen(false)}
        onSubmit={handleClose}
      />
      <TransferCallModal
        visible={transferOpen}
        call={call}
        onClose={() => setTransferOpen(false)}
        onSubmit={handleTransfer}
      />
    </SafeAreaView>
  );
}

function MenuBtn({ label, color, onPress }) {
  const styles = useStyles(makeStyles);
  return (
    <TouchableOpacity style={[styles.menuBtn, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.menuBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  empty: { padding: 24, textAlign: 'center', color: colors.textMuted },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  shareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  shareTextWrap: { flex: 1 },
  shareTitle: { fontSize: 13, fontWeight: '800', color: colors.primary },
  shareSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  permBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.warning + '22',
    borderRadius: radius.sm,
  },
  permText: { fontSize: 12, color: colors.warning, lineHeight: 17 },
  scroll: { padding: spacing.md, paddingBottom: 80 },
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sumCol: { flex: 1 },
  sumVal: { fontSize: 13, fontWeight: '700', color: colors.text },
  sumSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  accordion: { borderBottomWidth: 1, borderBottomColor: colors.border },
  accHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.surfaceContainerHigh,
  },
  accTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  accBody: { padding: spacing.md },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: spacing.sm },
  addrHead: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  addrCopyBtn: { paddingTop: 2 },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
  },
  coordsText: { flex: 1, fontSize: 12, color: colors.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' },
  infoRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 40,
  },
  infoLabel: {
    width: '42%',
    padding: 10,
    fontSize: 12,
    color: colors.textMuted,
    backgroundColor: colors.surfaceContainerHigh,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  infoValWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 },
  infoValue: { flex: 1, fontSize: 13, color: colors.text },
  infoCopy: { color: colors.primary },
  statusBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  statusCircleText: { fontWeight: '800' },
  statusBadgeLabel: { fontSize: 13, fontWeight: '800' },
  cancelNoteBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.danger + '18',
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger + '40',
  },
  cancelNoteLabel: { fontSize: 12, fontWeight: '800', color: colors.danger, marginBottom: 4 },
  cancelNoteText: { fontSize: 13, color: colors.danger, lineHeight: 19 },
  teamFallback: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  histItem: { marginBottom: spacing.md },
  histUser: { fontWeight: '800', fontSize: 13, color: colors.text },
  histText: { fontSize: 12, color: colors.text, marginTop: 2, lineHeight: 17 },
  histTime: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  actionBar: { position: 'absolute', bottom: spacing.lg, right: spacing.lg },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.sm,
    elevation: 4,
  },
  actionBtnText: { color: colors.onPrimaryContainer, fontWeight: '800', fontSize: 14 },
  menuOverlay: { flex: 1, backgroundColor: '#0006', justifyContent: 'flex-end' },
  menuSheet: { padding: spacing.lg, paddingBottom: 32, gap: spacing.sm },
  menuBtn: { borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center' },
  menuBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
