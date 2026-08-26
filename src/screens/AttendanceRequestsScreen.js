import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, LoadingState, EmptyState } from '../components/ui';
import RequestCard from '../components/RequestCard';
import { useApp } from '../context/AppContext';
import * as reqApi from '../services/attendanceRequestService';
import * as leaveApi from '../services/leaveRequestService';
import { attendanceRequestTypeLabel, attendanceRequestStatusLabel } from '../lib/attendanceRequestTypes';
import { friendlyError } from '../lib/erpMessages';
import { colors } from '../theme/attendanceDark';
import { spacing } from '../theme';

const STATUS_FILTERS = [
  { key: 'pending', label: 'Хүлээгдэж буй' },
  { key: 'all', label: 'Бүгд' },
  { key: 'approved', label: 'Зөвшөөрсөн' },
  { key: 'rejected', label: 'Татгалзсан' },
];

export default function AttendanceRequestsScreen() {
  const { currentUser } = useApp();
  const profile = currentUser;
  const [tab, setTab] = useState('time'); // 'time' | 'employee'
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
      if (tab === 'time') {
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
    if (decision === 'rejected') {
      setRejectTarget(row);
      setRejectReason('');
      return;
    }
    try {
      if (tab === 'time') {
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
        ].map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.segmentBtn, { backgroundColor: active ? colors.primary : colors.surfaceContainer }]}
              onPress={() => setTab(t.key)}
            >
              <Text style={{ color: active ? colors.onPrimary : colors.text, fontWeight: '700' }}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
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
            tab === 'time' ? (
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

const styles = StyleSheet.create({
  segmentRow: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  segmentBtn: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusDropdown: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  dropdownMenu: { marginTop: 6, borderRadius: 12, paddingVertical: 4, alignSelf: 'flex-start', minWidth: 160 },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  rejectOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  rejectSheet: { width: '100%', borderRadius: 20, padding: spacing.lg },
  rejectInput: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 70, textAlignVertical: 'top' },
  rejectBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
