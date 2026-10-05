import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Linking, Platform, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/Map';
import ChatAvatar from '../components/ChatAvatar';
import { LoadingState } from '../components/ui';
import * as attApi from '../services/attendanceService';
import * as reqApi from '../services/attendanceRequestService';
import { attendanceRequestTypeLabel, attendanceRequestStatusLabel } from '../lib/attendanceRequestTypes';
import { formatDuration } from '../lib/workHours';
import { colors as darkColors } from '../theme/attendanceDark';
import { spacing } from '../theme';

function fmtTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
}

/** Төлөвийг МОНГОЛООР — өмнө нь `on_time` гэж түүхий утга харагддаг байв. */
const STATUS_META = {
  on_time: { label: 'Цагтаа ирсэн', bg: 'rgba(63,207,142,0.16)', fg: '#3fcf8e' },
  late: { label: 'Хоцорсон', bg: 'rgba(255,107,96,0.16)', fg: '#ff6b60' },
  early_leave: { label: 'Эрт явсан', bg: 'rgba(245,181,68,0.16)', fg: '#f5b544' },
  absent: { label: 'Тасалсан', bg: 'rgba(255,107,96,0.16)', fg: '#ff6b60' },
  leave: { label: 'Чөлөөтэй', bg: 'rgba(143,211,242,0.16)', fg: '#8fd3f2' },
  rest: { label: 'Амралт', bg: 'rgba(160,160,168,0.16)', fg: '#a0a0a8' },
  not_scheduled: { label: 'Хуваарьгүй', bg: 'rgba(160,160,168,0.16)', fg: '#a0a0a8' },
  upcoming: { label: 'Ирээгүй', bg: 'rgba(160,160,168,0.16)', fg: '#a0a0a8' },
};

/** Хоёр баганатай мэдээллийн нүд — icon + шошго + утга. */
function InfoCell({ icon, label, value, colors, iconFg = '#2f9fe0' }) {
  return (
    <View style={styles.infoCell}>
      <View style={styles.infoLabelRow}>
        <View style={[styles.infoIcon, { backgroundColor: 'rgba(0,153,219,0.14)' }]}>
          <Ionicons name={icon} size={12} color={iconFg} />
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 4 }}>
        {value ?? '—'}
      </Text>
    </View>
  );
}

function SectionTitleRow({ icon, title, colors }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={15} color={colors.primary} />
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{title}</Text>
    </View>
  );
}

export default function AttendanceDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { employeeId, employeeName, date, row = {}, avatarUrl } = route.params || {};
  const colors = darkColors;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [activeRecord, setActiveRecord] = useState(null);

  const load = useCallback(async () => {
    try {
      const [reqs, recs] = await Promise.all([
        reqApi.fetchMyAttendanceRequests(employeeId, 20).catch(() => []),
        attApi.fetchEmployeeDayAttendance(employeeId, date).catch(() => []),
      ]);
      setRequests((reqs || []).filter((r) => r.requested_date === date));
      setRecords(recs || []);
      setActiveRecord((recs || []).find((r) => r.latitude != null) || (recs || [])[0] || null);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }, [employeeId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const openOnMap = (rec) => {
    const r = rec || activeRecord;
    if (!r || r.latitude == null || r.longitude == null) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`);
  };

  const status = STATUS_META[row.status] || STATUS_META.not_scheduled;
  const geoRecords = records.filter((r) => r.latitude != null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* ── Толгой ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.surfaceContainer }]}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: '800' }} numberOfLines={1}>
            {employeeName || 'Ажилтны ирц'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>{date}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: status.fg }]} />
          <Text style={{ color: status.fg, fontSize: 12, fontWeight: '700' }}>{status.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        {/* ── Профайл + мэдээлэл ────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
          <View style={styles.profileRow}>
            <ChatAvatar name={employeeName} uri={avatarUrl} size={52} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{employeeName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <Ionicons name="person-outline" size={12} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {row.department_name || '—'}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

          {/* 2 баганатай мэдээлэл */}
          <View style={styles.infoGrid}>
            <InfoCell icon="calendar-outline" label="Огноо" value={date} colors={colors} />
            <View style={[styles.infoVDivider, { backgroundColor: colors.outlineVariant }]} />
            <InfoCell
              icon="time-outline"
              label="Ирсэн цаг"
              value={fmtTime(row.check_in_at)}
              colors={colors}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
          <View style={styles.infoGrid}>
            <InfoCell
              icon="time-outline"
              label="Явсан цаг"
              value={fmtTime(row.check_out_at)}
              colors={colors}
            />
            <View style={[styles.infoVDivider, { backgroundColor: colors.outlineVariant }]} />
            <InfoCell
              icon="pie-chart-outline"
              label="Нийт ажилласан"
              value={row.worked_minutes ? formatDuration(row.worked_minutes * 60000) : '—'}
              colors={colors}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
          <View style={styles.infoGrid}>
            <InfoCell
              icon="location-outline"
              label="Ирсэн арга"
              value={row.is_remote ? 'Зайнаас' : 'GPS / Байршил'}
              colors={colors}
            />
            {row.late_minutes > 0 || row.early_leave_minutes > 0 ? (
              <>
                <View style={[styles.infoVDivider, { backgroundColor: colors.outlineVariant }]} />
                <InfoCell
                  icon="alert-circle-outline"
                  label={row.late_minutes > 0 ? 'Хоцорсон' : 'Эрт явсан'}
                  value={`${row.late_minutes || row.early_leave_minutes}м`}
                  colors={colors}
                  iconFg="#ff6b60"
                />
              </>
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>
        </View>

        {/* ── Бүртгэлийн байршил ────────────────────────────────── */}
        <SectionTitleRow icon="location" title="Бүртгэлийн байршил" colors={colors} />

        {records.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surfaceContainer }]}>
            <Ionicons name="location-outline" size={22} color={colors.textFaint} />
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>
              {loading ? 'Ачаалж байна...' : 'Энэ өдөр ирцийн бүртгэл алга.'}
            </Text>
          </View>
        ) : (
          <>
            {/* Timeline — мөрүүдийг босоо шугамаар холбоно */}
            <View style={[styles.card, { backgroundColor: colors.surfaceContainer, paddingVertical: spacing.md }]}>
              {records.map((rec, i) => {
                const isIn = rec.type === 'check_in';
                const selected = activeRecord?.id === rec.id;
                const last = i === records.length - 1;
                return (
                  <TouchableOpacity
                    key={rec.id}
                    onPress={() => setActiveRecord(rec)}
                    activeOpacity={0.75}
                    style={styles.timelineRow}
                  >
                    {/* Зүүн талын icon + холбогч шугам */}
                    <View style={styles.timelineLeft}>
                      <View
                        style={[
                          styles.timelineIcon,
                          { backgroundColor: isIn ? '#22a565' : '#e5484d' },
                          selected && { borderWidth: 2.5, borderColor: colors.primary },
                        ]}
                      >
                        <Ionicons
                          name={isIn ? 'log-in-outline' : 'log-out-outline'}
                          size={15}
                          color="#fff"
                        />
                      </View>
                      {!last ? (
                        <View style={[styles.timelineLine, { backgroundColor: colors.outlineVariant }]} />
                      ) : null}
                    </View>

                    <View style={{ flex: 1, paddingBottom: last ? 0 : spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                          {isIn ? 'Ирсэн' : 'Явсан'}
                        </Text>
                        <View style={[styles.miniDot, { backgroundColor: isIn ? '#22a565' : '#e5484d' }]} />
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                          {fmtTime(rec.created_at)}
                        </Text>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        {rec.location_name || 'Байршилгүй'}
                        {rec.distance_m != null ? ` • ~${rec.distance_m}м` : ''}
                        {rec.is_remote ? ' • Зайнаас' : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Газрын зураг — бүх цэгийг зэрэг харуулна */}
            {geoRecords.length > 0 ? (
              <View style={[styles.card, { backgroundColor: colors.surfaceContainer, padding: 0, overflow: 'hidden' }]}>
                <View style={styles.mapWrap}>
                  <MapView
                    style={StyleSheet.absoluteFillObject}
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                    region={
                      activeRecord?.latitude != null
                        ? {
                            latitude: Number(activeRecord.latitude),
                            longitude: Number(activeRecord.longitude),
                            latitudeDelta: 0.006,
                            longitudeDelta: 0.006,
                          }
                        : undefined
                    }
                    initialRegion={{
                      latitude: Number(geoRecords[0].latitude),
                      longitude: Number(geoRecords[0].longitude),
                      latitudeDelta: 0.006,
                      longitudeDelta: 0.006,
                    }}
                  >
                    {geoRecords.map((rec) => (
                      <Marker
                        key={rec.id}
                        coordinate={{
                          latitude: Number(rec.latitude),
                          longitude: Number(rec.longitude),
                        }}
                        title={rec.type === 'check_in' ? 'Ирсэн' : 'Явсан'}
                        description={fmtTime(rec.created_at)}
                        pinColor={rec.type === 'check_in' ? 'green' : 'red'}
                        onPress={() => setActiveRecord(rec)}
                      />
                    ))}
                  </MapView>
                </View>

                <View style={{ padding: spacing.md }}>
                  <TouchableOpacity
                    style={[styles.mapsBtn, { borderColor: colors.primary }]}
                    onPress={() => openOnMap(activeRecord)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="location" size={15} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
                      Google Maps дээр нээх
                    </Text>
                    <Ionicons name="open-outline" size={13} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={[styles.emptyBox, { backgroundColor: colors.surfaceContainer }]}>
                <Ionicons name="map-outline" size={22} color={colors.textFaint} />
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>
                  Байршлын мэдээлэл хадгалагдаагүй байна.
                </Text>
              </View>
            )}

            {activeRecord?.photo_url ? (
              <Image source={{ uri: activeRecord.photo_url }} style={styles.recPhoto} />
            ) : null}
          </>
        )}

        {/* ── Хүсэлтийн түүх ────────────────────────────────────── */}
        <SectionTitleRow icon="document-text-outline" title="Хүсэлтийн түүх" colors={colors} />

        {loading ? (
          <LoadingState text="Ачаалж байна..." />
        ) : requests.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surfaceContainer }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceContainerHigh }]}>
              <Ionicons name="clipboard-outline" size={20} color={colors.textFaint} />
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 10 }}>
              Энэ өдөр хүсэлт байхгүй.
            </Text>
          </View>
        ) : (
          requests.map((r) => {
            const tone =
              r.status === 'approved'
                ? { bg: 'rgba(63,207,142,0.16)', fg: '#3fcf8e' }
                : r.status === 'rejected'
                  ? { bg: 'rgba(255,107,96,0.16)', fg: '#ff6b60' }
                  : { bg: 'rgba(245,181,68,0.16)', fg: '#f5b544' };
            return (
              <View key={r.id} style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>
                    {attendanceRequestTypeLabel(r.type)}
                  </Text>
                  <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
                    <Text style={{ color: tone.fg, fontSize: 11, fontWeight: '700' }}>
                      {attendanceRequestStatusLabel(r.status)}
                    </Text>
                  </View>
                </View>
                {r.reason ? (
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>{r.reason}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },

  card: { borderRadius: 18, padding: spacing.lg, marginBottom: spacing.md },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.md },

  infoGrid: { flexDirection: 'row', alignItems: 'center' },
  infoCell: { flex: 1 },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoIcon: { width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  infoVDivider: { width: StyleSheet.hairlineWidth, height: 34, marginHorizontal: spacing.md },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },

  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineLeft: { alignItems: 'center', width: 32 },
  timelineIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, flex: 1, marginVertical: 4 },
  miniDot: { width: 5, height: 5, borderRadius: 3 },

  mapWrap: { height: 220 },
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
  },

  emptyBox: {
    borderRadius: 18,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },

  recPhoto: { width: '100%', height: 200, borderRadius: 16, marginBottom: spacing.md, resizeMode: 'cover' },
});
