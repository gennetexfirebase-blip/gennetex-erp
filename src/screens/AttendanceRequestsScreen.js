import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, LoadingState, EmptyState } from '../components/ui';
import RequestCard from '../components/RequestCard';
import { useApp } from '../context/AppContext';
import * as reqApi from '../services/attendanceRequestService';
import * as leaveApi from '../services/leaveRequestService';
import * as attApi from '../services/attendanceService';
import { attendanceRequestTypeLabel, attendanceRequestStatusLabel } from '../lib/attendanceRequestTypes';
import { friendlyError } from '../lib/erpMessages';
import { useTheme, useStyles } from '../context/ThemeContext';
import { spacing } from '../theme';

const STATUS_FILTERS = [
  { key: 'pending', label: 'Хүлээгдэж буй' },
  { key: 'all', label: 'Бүгд' },
  { key: 'approved', label: 'Зөвшөөрсөн' },
  { key: 'rejected', label: 'Татгалзсан' },
];

export default function AttendanceRequestsScreen({ route }) {
  const { colors: colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { currentUser } = useApp();
  const profile = currentUser;
  // 'remote' — зайнаас бүртгүүлсэн ирц (өмнө нь Ирц дэлгэц дээр шууд харагддаг байв).
  const [tab, setTab] = useState(route?.params?.tab || 'time'); // 'time' | 'employee' | 'remote'
  const [remoteCount, setRemoteCount] = useState(0);
  const [status, setStatus] = useState('pending');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Зайнаас ирсэн хүлээгдэж буй ирцийн тоог таб дээр үргэлж харуулна.
      attApi.fetchPendingAttendance().then((d) => setRemoteCount((d || []).length)).catch(() => {});
      if (tab === 'remote') {
        setRows((await attApi.fetchPendingAttendance()) || []);
      } else if (tab === 'time') {
        const data = await reqApi.fetchAttendanceRequests({ status });
        setRows(data || []);
      } else {
        const data = await leaveApi.fetchLeaveRequests({ status });
        setRows(data || []);
      }
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, status]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (row, decision) => {
    // Зайнаас ирсэн ирцэд шалтгаан хадгалах талбар байхгүй — шууд татгалзана.
    if (decision === 'rejected' && tab !== 'remote') {
      setRejectTarget(row);
      setRejectReason('');
      return;
    }
    try {
      if (tab === 'remote') {
        await attApi.setAttendanceStatus(row.id, decision);
      } else if (tab === 'time') {
        await reqApi.decideAttendanceRequest(row.id, decision);
      } else {
        await leaveApi.updateLeaveRequestStatus(row.id, decision, {
          reviewedBy: profile?.id,
          reviewedByName: profile?.name,
        });
      }
      load();
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    }
  };

  const confirmReject = async () => {
    const row = rejectTarget;
    if (!row) return;
    try {
      if (tab === 'time') {
        await reqApi.decideAttendanceRequest(row.id, 'rejected', rejectReason.trim() || null);
      } else {
        await leaveApi.updateLeaveRequestStatus(row.id, 'rejected', {
          reviewedBy: profile?.id,
          reviewedByName: profile?.name,
          reviewNote: rejectReason.trim() || null,
        });
      }
      setRejectTarget(null);
      load();
    } catch (e) {
      Alert.alert('Алдаа', friendlyError(e));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Хүсэлт" />
      <View style={styles.segmentRow}>
        {[
          { key: 'time', label: 'Цагийн хүсэлт' },
          { key: 'employee', label: 'Ажилтны хүсэлт' },
          { key: 'remote', label: 'Зайнаас', count: remoteCount },
        ].map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.segmentBtn, { backgroundColor: active ? colors.primary : colors.surfaceContainer }]}
              onPress={() => setTab(t.key)}
            >
              <Text style={{ color: active ? colors.onPrimary : colors.text, fontWeight: '700', fontSize: 13, flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t.label}</Text>
              {t.count ? (
                <View style={[styles.segBadge, { backgroundColor: colors.error || '#D23A2F' }]}>
                  <Text style={styles.segBadgeText}>{t.count}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, display: tab === 'remote' ? 'none' : 'flex' }}>
        <TouchableOpacity
          style={[styles.statusDropdown, { backgroundColor: colors.surfaceContainer }]}
          onPress={() => setStatusMenuOpen((v) => !v)}
        >
          <Text style={{ color: colors.text, fontSize: 13 }}>
            🕒 {STATUS_FILTERS.find((s) => s.key === status)?.label} ▾
          </Text>
        </TouchableOpacity>
        {statusMenuOpen ? (
          <View style={[styles.dropdownMenu, { backgroundColor: colors.surfaceContainerHigh }]}>
            {STATUS_FILTERS.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={styles.dropdownItem}
                onPress={() => {
                  setStatus(s.key);
                  setStatusMenuOpen(false);
                }}
              >
                <Text style={{ color: colors.text }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      {loading ? (
        <LoadingState text="Ачаалж байна..." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
          ListEmptyComponent={<EmptyState text="Хүлээгдэж буй хүсэлт байхгүй" />}
          renderItem={({ item }) =>
            tab === 'remote' ? (
              <RequestCard
                title={`Зайнаас ${item.type === 'check_in' ? 'ирсэн' : 'явсан'}`}
                employeeName={item.staff_name}
                dateLabel={new Date(item.created_at).toLocaleString('mn-MN')}
                status={item.status}
                statusLabel="Хүлээгдэж буй"
                reason={[item.distance_m != null ? `Цэгээс ~${item.distance_m}м зайд` : null, item.note].filter(Boolean).join(' · ') || null}
                createdAt={item.created_at}
                colors={colors}
                onApprove={() => decide(item, 'approved')}
                onReject={() => decide(item, 'rejected')}
              />
            ) : tab === 'time' ? (
              <RequestCard
                title={attendanceRequestTypeLabel(item.type)}
                employeeName={item.employee_name}
                dateLabel={`${item.requested_date}${item.requested_time ? ' ' + item.requested_time : ''}`}
                status={item.status}
                statusLabel={attendanceRequestStatusLabel(item.status)}
                reason={item.reason}
                createdAt={item.created_at}
                colors={colors}
                onApprove={() => decide(item, 'approved')}
                onReject={() => decide(item, 'rejected')}
              />
            ) : (
              <RequestCard
                title={leaveApi.kindLabel(item.kind)}
                employeeName={item.user_name}
                dateLabel={leaveApi.formatLeaveRange(item)}
                status={item.status}
                statusLabel={leaveApi.statusLabel(item.status)}
                reason={item.reason}
                createdAt={item.created_at}
                colors={colors}
                onApprove={() => decide(item, 'approved')}
                onReject={() => decide(item, 'rejected')}
              />
            )
          }
        />
      )}

      <Modal visible={!!rejectTarget} transparent animationType="fade" onRequestClose={() => setRejectTarget(null)}>
        <View style={styles.rejectOverlay}>
          <View style={[styles.rejectSheet, { backgroundColor: colors.surfaceContainer }]}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
              Татгалзах шалтгаан
            </Text>
            <TextInput
              style={[styles.rejectInput, { borderColor: colors.outlineVariant, color: colors.text }]}
              placeholder="Шалтгаан (заавал биш)"
              placeholderTextColor={colors.textFaint}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.rejectBtn, { borderWidth: 1, borderColor: colors.outlineVariant }]}
                onPress={() => setRejectTarget(null)}
              >
                <Text style={{ color: colors.textMuted, fontWeight: '700' }}>Болих</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rejectBtn, { backgroundColor: '#ff6b60' }]} onPress={confirmReject}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Татгалзах</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors: colors }) => StyleSheet.create({
  segmentRow: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  segmentBtn: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 6 },
  segBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  segBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  statusDropdown: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  dropdownMenu: { marginTop: 6, borderRadius: 12, paddingVertical: 4, alignSelf: 'flex-start', minWidth: 160 },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  rejectOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  rejectSheet: { width: '100%', borderRadius: 20, padding: spacing.lg },
  rejectInput: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 70, textAlignVertical: 'top' },
  rejectBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
