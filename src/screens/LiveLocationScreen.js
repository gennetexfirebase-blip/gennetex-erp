/**
 * Байршил хяналт — нэг ажилтан дээр төвлөрсөн харагдац.
 *
 * ХЭЛБЭР:
 *   [ Ажилтан сонгох карт ▾ ]     ← хэн бэ, online эсэх
 *   [        Газрын зураг       ] ← сонгосон хүн тодруулагдсан
 *   [ Одоогийн байршил · хэдэн мин өмнө ]  ← зураг дээр хөвөх карт
 *   Сүүлийн үйл явдал / Бүгд
 *   [ айл · асуудал · цаг › ]
 *
 * ЯАГААД: өмнөх хувилбар нь бүх ажилтныг нэг таб, очсон логийг нөгөө
 * табанд жагсаадаг байсан тул "тэр хүн ОДОО хаана байна вэ" гэсэн гол
 * асуултад хариулахад 2-3 алхам шаарддаг байв. Одоо нэг хүнийг сонгоод
 * байршил, түүх нь нэг дэлгэц дээр цуг харагдана.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/Map';
import { Badge, ScreenHeader, EmptyState } from '../components/ui';
import { useApp } from '../context/AppContext';
import { CALL_TYPES } from '../data/mockData';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';
import * as tracking from '../services/trackingService';
import * as bgLocation from '../services/backgroundLocationService';
import { pollInterval } from '../lib/performanceMode';

function callTypeLabel(key) {
  const t = CALL_TYPES.find((x) => x.key === key);
  return t ? `${t.label}` : null;
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

const UB_REGION = {
  latitude: 47.9185,
  longitude: 106.9176,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'];

/** 5 минутын дотор дохио ирсэн бол "идэвхтэй" гэж үзнэ. */
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

const isOnline = (w) =>
  !!w?.last_seen && Date.now() - new Date(w.last_seen).getTime() < ONLINE_WINDOW_MS;

function timeAgo(ts) {
  if (!ts) return 'мэдээлэлгүй';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'дөнгөж сая';
  if (m < 60) return `${m} мин өмнө`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг өмнө`;
  return `${Math.floor(h / 24)} өдөр өмнө`;
}

function WorkerMarker({ worker, color, visit, focused, onPress }) {
  // Тэмдэг нь WebView доторх газрын зураг дээр зурагддаг тул React
  // хүүхэд элемент биш, props-оор дүрсээ дамжуулна
  // (`components/Map.js`-ийн тайлбарыг үзнэ үү).
  return (
    <Marker
      coordinate={{ latitude: worker.latitude, longitude: worker.longitude }}
      // Өөрийн маркерыг "Би (нэр)" гэж тодорхой ялгана.
      title={worker.isMe ? `Би${worker.name ? ` · ${worker.name}` : ''}` : worker.name || 'Ажилтан'}
      description={
        visit
          ? `${visit.customer || 'Айл'}${visit.problem ? ' · ' + visit.problem : ''}`
          : timeAgo(worker.last_seen)
      }
      avatarUri={worker.avatar_url}
      avatarName={worker.name}
      tint={worker.isMe ? '#0099DB' : color}
      // Өөрийн маркер үргэлж дээр, төвд байхаар онцолно.
      focused={focused || worker.isMe}
      onPress={onPress}
      zIndex={worker.isMe ? 20 : focused ? 10 : 1}
    />
  );
}

export default function LiveLocationScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isCloud, isAdmin, trackingState, currentUser } = useApp();
  const [workers, setWorkers] = useState([]);
  const [visits, setVisits] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const mapRef = useRef(null);

  const load = async () => {
    if (!isCloud) return;
    try {
      const [w, v] = await Promise.all([tracking.fetchWorkers(), tracking.fetchVisitLogs()]);
      setWorkers(w);
      setVisits(v);
    } catch (e) {}
  };

  useEffect(() => {
    load();
    if (!isCloud) return;
    const unsub = tracking.subscribeWorkers(() => load());
    // Хөнгөн горимд сийрэг татна — газрын зураг + сүлжээ хамгийн их
    // ачаалал өгдөг хосолол.
    const timer = setInterval(load, pollInterval(20000));
    return () => {
      unsub?.();
      clearInterval(timer);
    };
  }, [isCloud]);

  // Ажилтан бүрийн хамгийн сүүлд очсон айл (visits нь arrived_at-аар буурахаар эрэмбэлэгдсэн)
  const latestVisitByUser = useMemo(() => {
    const map = {};
    for (const v of visits) {
      if (v.user_id && !map[v.user_id]) map[v.user_id] = v;
    }
    return map;
  }, [visits]);

  const located = useMemo(() => {
    const list = workers
      .filter((w) => w.latitude != null && w.longitude != null)
      .map((w, i) => ({ ...w, color: COLORS[i % COLORS.length], visit: latestVisitByUser[w.id] }));

    /**
     * ⚠️ ӨӨРИЙН МАРКЕРЫГ ЗААВАЛ НЭМНЭ.
     *
     *    `fetchWorkers` нь `filterVisibleProfiles`-ээр дамждаг бөгөөд
     *    тэр нь ЗӨВХӨН өөрөөсөө ДООШ зэрэгтэй хүнийг буцаадаг —
     *    өөрийн профайл (тэнцүү зэрэг) хасагдана. Иймд газрын зурагт
     *    хэрэглэгч өөрийгөө "би яг хаана байна" гэж хардаггүй байв.
     *
     *    Энд `currentUser`-ийн БОДИТ байршлыг тусад нь оруулж, тод
     *    ялгаж (`isMe`) харуулна. Давхардахаас сэргийлж id-аар шалгана.
     */
    const me = currentUser;
    if (me?.id && me.latitude != null && me.longitude != null && !list.some((w) => w.id === me.id)) {
      list.unshift({
        id: me.id,
        name: me.name || 'Би',
        avatar_url: me.avatar_url || null,
        latitude: me.latitude,
        longitude: me.longitude,
        last_seen: me.last_seen || new Date().toISOString(),
        role: me.role,
        color: '#0099DB',
        isMe: true,
        visit: latestVisitByUser[me.id],
      });
    }
    return list;
  }, [workers, latestVisitByUser, currentUser]);

  // Сонголт хийгээгүй бол хамгийн сүүлд дохио өгсөн хүнийг өөрөө сонгоно —
  // дэлгэц нээмэгц хоосон карт харагдахгүй.
  const selected = useMemo(() => {
    if (!located.length) return null;
    const found = located.find((w) => w.id === selectedId);
    if (found) return found;
    return [...located].sort(
      (a, b) => new Date(b.last_seen || 0) - new Date(a.last_seen || 0)
    )[0];
  }, [located, selectedId]);

  const focusOn = (w, delta = 0.008) => {
    if (!w?.latitude) return;
    mapRef.current?.animateToRegion?.(
      {
        latitude: w.latitude,
        longitude: w.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      450
    );
  };

  const pick = (w) => {
    setSelectedId(w.id);
    setPickerOpen(false);
    focusOn(w);
  };

  /** Доорх жагсаалт: сонгосон хүний түүх, эсвэл "Бүгд" горимд бүх лог. */
  const activity = useMemo(() => {
    if (showAll || !selected) return visits;
    return visits.filter((v) => v.user_id === selected.id);
  }, [visits, showAll, selected]);

  const online = located.filter(isOnline).length;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={isAdmin ? 'Ажилчдын хяналт' : 'Байршил'}
        subtitle={`${located.length} ажилтан · ${online} идэвхтэй`}
        back
        right={
          <Badge
            text={
              !trackingState?.active
                ? 'Идэвхгүй'
                : trackingState?.background
                  ? 'Тасралтгүй'
                  : 'Апп нээлттэй үед'
            }
            color={
              !trackingState?.active
                ? colors.textFaint
                : trackingState?.background
                  ? colors.success
                  : colors.warning || colors.textMuted
            }
          />
        }
      />

      {/* Арын хяналт ажиллахгүй бол ЯАГААДЫГ нь хэлж, засах товч өгнө. */}
      {trackingState?.active && trackingState?.background === false ? (
        <View style={styles.warnBar}>
          <Text style={styles.warnText}>
            {bgLocation.trackingProblemText(trackingState.reason) ||
              'Байршил зөвхөн апп нээлттэй үед шинэчлэгдэж байна.'}
          </Text>
          {Platform.OS === 'android' && trackingState.reason !== 'expo-go' ? (
            <TouchableOpacity onPress={() => bgLocation.openBatterySettings()}>
              <Text style={styles.warnAction}>Тохиргоо нээх</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {!isCloud ? (
        <EmptyState text="Supabase холбогдоогүй тул бусад ажилчдын байршил харагдахгүй." />
      ) : (
        <>
          {/* --- Хэнийг хянаж байна --- */}
          <TouchableOpacity
            style={styles.picker}
            activeOpacity={0.85}
            onPress={() => setPickerOpen(true)}
            disabled={!located.length}
            accessibilityRole="button"
            accessibilityLabel="Ажилтан сонгох"
          >
            <View style={[styles.pickerAvatar, { borderColor: selected?.color || colors.border }]}>
              {selected?.avatar_url ? (
                <Image source={{ uri: selected.avatar_url }} style={styles.avatarImg} />
              ) : (
                <View
                  style={[
                    styles.markerFallback,
                    { backgroundColor: selected?.color || colors.surfaceAlt },
                  ]}
                >
                  <Text style={styles.markerInitials}>{initials(selected?.name)}</Text>
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.pickerName} numberOfLines={1}>
                {selected?.name || 'Ажилтан алга'}
              </Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isOnline(selected) ? colors.success : colors.textFaint },
                  ]}
                />
                <Text style={styles.statusText}>
                  {selected
                    ? isOnline(selected)
                      ? 'Идэвхтэй'
                      : timeAgo(selected.last_seen)
                    : 'Дохио ирээгүй'}
                </Text>
                {selected?.position ? (
                  <Text style={styles.statusMuted} numberOfLines={1}>
                    · {selected.position}
                  </Text>
                ) : null}
              </View>
            </View>

            <Text style={styles.chevron}>⌄</Text>
          </TouchableOpacity>

          {/* --- Газрын зураг --- */}
          <View style={styles.mapWrap}>
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              initialRegion={UB_REGION}
              showsUserLocation
            >
              {located.map((w) => (
                <WorkerMarker
                  key={w.id}
                  worker={w}
                  color={w.color}
                  visit={w.visit}
                  focused={selected?.id === w.id}
                  onPress={() => pick(w)}
                />
              ))}
            </MapView>

            {/* Зураг дээр хөвөх "одоогийн байршил" карт */}
            {selected ? (
              <View style={styles.floatCard}>
                <View style={styles.pinWrap}>
                  <Text style={styles.pin}>📍</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.floatTitle} numberOfLines={1}>
                    {selected.visit?.customer
                      || selected.visit?.address
                      || `${selected.latitude.toFixed(4)}, ${selected.longitude.toFixed(4)}`}
                  </Text>
                  <Text style={styles.floatSub} numberOfLines={1}>
                    Одоогийн байршил · {timeAgo(selected.last_seen)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.locBtn}
                  onPress={() => focusOn(selected, 0.004)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Байршил руу ойртох"
                >
                  <Text style={styles.locBtnIcon}>➤</Text>
                  <Text style={styles.locBtnText}>Байршил</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* --- Сүүлийн үйл явдал --- */}
          <View style={styles.activity}>
            <View style={styles.activityHead}>
              <Text style={styles.activityTitle}>Сүүлийн үйл явдал</Text>
              <TouchableOpacity onPress={() => setShowAll((v) => !v)} accessibilityRole="button">
                <Text style={styles.activityLink}>{showAll ? 'Зөвхөн энэ хүн' : 'Бүх лог'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {activity.length === 0 ? (
                <EmptyState text="Очсон бүртгэл алга." />
              ) : (
                activity.slice(0, 40).map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={styles.actRow}
                    activeOpacity={0.75}
                    onPress={() => {
                      if (v.latitude && v.longitude) {
                        mapRef.current?.animateToRegion?.(
                          {
                            latitude: v.latitude,
                            longitude: v.longitude,
                            latitudeDelta: 0.006,
                            longitudeDelta: 0.006,
                          },
                          450
                        );
                      }
                    }}
                  >
                    <View style={styles.actIcon}>
                      <Text style={styles.actIconText}>📍</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actName} numberOfLines={1}>
                        {v.customer || 'Айл'}
                      </Text>
                      <Text style={styles.actSub} numberOfLines={1}>
                        {showAll ? `${v.user_name || 'Ажилтан'} · ` : ''}
                        {callTypeLabel(v.call_type) || v.problem || 'Очсон'}
                      </Text>
                    </View>
                    <Text style={styles.actTime}>{timeAgo(v.arrived_at)}</Text>
                    <Text style={styles.actChevron}>›</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </>
      )}

      {/* --- Ажилтан сонгох --- */}
      <Modal visible={pickerOpen} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Ажилтан сонгох</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {located.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={styles.pickRow}
                  activeOpacity={0.8}
                  onPress={() => pick(w)}
                >
                  <View style={[styles.rowAvatar, { borderColor: w.color }]}>
                    {w.avatar_url ? (
                      <Image source={{ uri: w.avatar_url }} style={styles.avatarImg} />
                    ) : (
                      <View style={[styles.markerFallback, { backgroundColor: w.color }]}>
                        <Text style={styles.markerInitials}>{initials(w.name)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{w.name || 'Нэргүй'}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {w.visit?.customer ? `${w.visit.customer} · ` : ''}
                      {timeAgo(w.last_seen)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isOnline(w) ? colors.success : colors.textFaint },
                    ]}
                  />
                </TouchableOpacity>
              ))}
              {located.length === 0 ? <EmptyState text="Байршил илгээсэн ажилтан алга." /> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = ({ colors, shadow }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  warnBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warningSoft || colors.surfaceAlt,
  },
  warnText: { flex: 1, color: colors.text, fontSize: 12.5, lineHeight: 17 },
  warnAction: { color: colors.primary, fontSize: 12.5, fontWeight: '700' },

  // --- Хэнийг хянаж байна ---
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  pickerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  avatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  pickerName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  statusMuted: { color: colors.textFaint, fontSize: 12, flexShrink: 1 },
  chevron: { color: colors.textFaint, fontSize: 20, paddingHorizontal: spacing.xs },

  // --- Газрын зураг ---
  mapWrap: {
    flex: 1,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  map: { ...StyleSheet.absoluteFillObject },

  floatCard: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.lg,
  },
  pinWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: { fontSize: 17 },
  floatTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  floatSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  locBtn: { alignItems: 'center', paddingHorizontal: spacing.xs },
  locBtnIcon: { color: colors.primary, fontSize: 17, transform: [{ rotate: '-45deg' }] },
  locBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700', marginTop: 2 },

  // --- Сүүлийн үйл явдал ---
  activity: {
    height: '34%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  activityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  activityTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  activityLink: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  actIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actIconText: { fontSize: 16 },
  actName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  actSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  actTime: { color: colors.textFaint, fontSize: 11 },
  actChevron: { color: colors.textFaint, fontSize: 18, marginLeft: 2 },

  // --- Сонгох цонх ---
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderHi,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  sheetTitle: { color: colors.text, fontSize: 19, fontWeight: '800', marginBottom: spacing.md },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  // --- Газрын зураг дээрх тэмдэг ---
  markerHalo: {
    padding: 6,
    borderRadius: 32,
    backgroundColor: 'transparent',
  },
  marker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadow.md,
  },
  markerImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  markerFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInitials: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
