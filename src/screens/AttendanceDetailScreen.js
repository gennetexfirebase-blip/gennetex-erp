import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Linking, Platform, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/Map';
import { ScreenHeader, LoadingState, StatusPill } from '../components/ui';
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

function DetailRow({ label, value, colors }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.detailRow}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

export default function AttendanceDetailScreen() {
  const route = useRoute();
  const { employeeId, employeeName, date, row = {}, avatarUrl } = route.params || {};
  const colors = darkColors;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  // Тухайн өдрийн бодит ирцийн мөрүүд — байршилтай нь.
  // ⚠️ `row` нь RPC-ээс ирдэг бөгөөд lat/lng АГУУЛДАГГҮЙ тул газрын
  // зургийг үүгээр биш, доорх бүртгэлүүдээр харуулна.
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title={employeeName || 'Ажилтны ирц'} subtitle={date} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.surfaceContainerHigh }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{employeeName}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{row.department_name || '—'}</Text>
            </View>
            <StatusPill
              text={row.status || '—'}
              tone={row.status === 'late' || row.status === 'absent' ? 'danger' : 'success'}
            />
          </View>

          <DetailRow label="Огноо" value={date} colors={colors} />
          <DetailRow label="Ирсэн цаг" value={fmtTime(row.check_in_at)} colors={colors} />
          <DetailRow label="Явсан цаг" value={fmtTime(row.check_out_at)} colors={colors} />
          <DetailRow
            label="Нийт ажилласан цаг"
            value={row.worked_minutes ? formatDuration(row.worked_minutes * 60000) : '—'}
            colors={colors}
          />
          <DetailRow label="Хоцорсон минут" value={row.late_minutes ? `${row.late_minutes}м` : null} colors={colors} />
          <DetailRow
            label="Эрт явсан минут"
            value={row.early_leave_minutes ? `${row.early_leave_minutes}м` : null}
            colors={colors}
          />
          <DetailRow label="Ирсэн арга" value={row.is_remote ? 'Зайнаас' : 'GPS / Байршил'} colors={colors} />
        </View>

        {/* ── ХЭЗЭЭ, ХААНААС бүртгүүлсэн ─────────────────────────── */}
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: spacing.lg, marginBottom: 8 }}>
          Бүртгэлийн байршил
        </Text>

        {records.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            {loading ? 'Ачаалж байна...' : 'Энэ өдөр ирцийн бүртгэл алга.'}
          </Text>
        ) : (
          <>
            {records.map((rec) => {
              const isIn = rec.type === 'check_in';
              const selected = activeRecord?.id === rec.id;
              return (
                <TouchableOpacity
                  key={rec.id}
                  onPress={() => setActiveRecord(rec)}
                  activeOpacity={0.75}
                  style={[
                    styles.recRow,
                    {
                      backgroundColor: selected ? colors.primary + '22' : colors.surfaceContainer,
                      borderColor: selected ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.recDot,
                      { backgroundColor: isIn ? '#3fcf8e' : '#ff6b60' },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
                      {isIn ? 'Ирсэн' : 'Явсан'} · {fmtTime(rec.created_at)}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      {rec.location_name
                        ? rec.location_name
                        : rec.latitude != null
                          ? `${Number(rec.latitude).toFixed(5)}, ${Number(rec.longitude).toFixed(5)}`
                          : 'Байршил хадгалагдаагүй'}
                      {rec.distance_m != null ? ` · ~${rec.distance_m}м` : ''}
                    </Text>
                  </View>
                  {rec.is_remote ? (
                    <StatusPill text="Зайнаас" tone="warning" />
                  ) : null}
                </TouchableOpacity>
              );
            })}

            {activeRecord?.latitude != null ? (
              <View style={styles.mapWrap}>
                <MapView
                  style={StyleSheet.absoluteFillObject}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  initialRegion={{
                    latitude: Number(activeRecord.latitude),
                    longitude: Number(activeRecord.longitude),
                    latitudeDelta: 0.006,
                    longitudeDelta: 0.006,
                  }}
                  region={{
                    latitude: Number(activeRecord.latitude),
                    longitude: Number(activeRecord.longitude),
                    latitudeDelta: 0.006,
                    longitudeDelta: 0.006,
                  }}
                >
                  <Marker
                    coordinate={{
                      latitude: Number(activeRecord.latitude),
                      longitude: Number(activeRecord.longitude),
                    }}
                    title={activeRecord.type === 'check_in' ? 'Ирсэн' : 'Явсан'}
                    description={fmtTime(activeRecord.created_at)}
                    pinColor={activeRecord.type === 'check_in' ? 'green' : 'red'}
                  />
                </MapView>
              </View>
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>
                Энэ бүртгэлд байршлын мэдээлэл хадгалагдаагүй байна.
              </Text>
            )}

            {activeRecord?.latitude != null ? (
              <TouchableOpacity onPress={() => openOnMap(activeRecord)}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: 10 }}>
                  Google Maps дээр нээх →
                </Text>
              </TouchableOpacity>
            ) : null}

            {activeRecord?.photo_url ? (
              <Image source={{ uri: activeRecord.photo_url }} style={styles.recPhoto} />
            ) : null}
          </>
        )}

        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: spacing.lg, marginBottom: 8 }}>
          Хүсэлтийн түүх
        </Text>
        {loading ? (
          <LoadingState text="Ачаалж байна..." />
        ) : requests.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Энэ өдөр хүсэлт байхгүй.</Text>
        ) : (
          requests.map((r) => (
            <View key={r.id} style={[styles.card, { backgroundColor: colors.surfaceContainer, marginBottom: 8 }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{attendanceRequestTypeLabel(r.type)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{r.reason}</Text>
              <StatusPill
                text={attendanceRequestStatusLabel(r.status)}
                tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}
                style={{ marginTop: 8, alignSelf: 'flex-start' }}
              />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  mapWrap: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  recPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginTop: spacing.md,
    resizeMode: 'cover',
  },
});
