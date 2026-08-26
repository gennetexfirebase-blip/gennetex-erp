import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  const load = useCallback(async () => {
    try {
      const all = await reqApi.fetchMyAttendanceRequests(employeeId, 20);
      setRequests((all || []).filter((r) => r.requested_date === date));
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }, [employeeId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const openOnMap = () => {
    if (row.latitude == null || row.longitude == null) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${row.latitude},${row.longitude}`);
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
          {row.latitude != null ? (
            <TouchableOpacity onPress={openOnMap}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: 8 }}>
                Газрын зураг дээр харах
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

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
});
