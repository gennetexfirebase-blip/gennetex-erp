import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}м өмнө`;
  if (h < 24) return `${h}ц өмнө`;
  return `${Math.floor(h / 24)}өдөр өмнө`;
}

const STATUS_TONE = {
  pending: { bg: 'rgba(245,181,68,0.18)', text: '#f5b544' },
  approved: { bg: 'rgba(63,207,142,0.18)', text: '#3fcf8e' },
  rejected: { bg: 'rgba(255,107,96,0.18)', text: '#ff6b60' },
  cancelled: { bg: 'rgba(160,160,168,0.18)', text: '#a0a0a8' },
};

/** Admin Хүсэлт tab-ийн rounded dark card — Цагийн хүсэлт болон Ажилтны хүсэлт хоёуланд нэгэн адил ашиглана. */
export default function RequestCard({
  title,
  employeeName,
  dateLabel,
  status,
  statusLabel,
  reason,
  createdAt,
  colors,
  onApprove,
  onReject,
}) {
  const tone = STATUS_TONE[status] || STATUS_TONE.pending;
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceContainerHigh }]} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
            {title}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{employeeName}</Text>
          <View style={styles.metaRow}>
            <Text style={{ color: colors.textFaint, fontSize: 12 }}>📅 {dateLabel}</Text>
            {createdAt ? (
              <Text style={{ color: colors.textFaint, fontSize: 12 }}>🕒 {timeAgo(createdAt)}</Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
          <Text style={{ color: tone.text, fontSize: 11, fontWeight: '700' }}>{statusLabel}</Text>
        </View>
      </View>

      {reason ? (
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 10 }} numberOfLines={3}>
          {reason}
        </Text>
      ) : null}

      {status === 'pending' && (onApprove || onReject) ? (
        <View style={[styles.actions, { borderTopColor: colors.outlineVariant }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={onApprove}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>✓ Зөвшөөрөх</Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
          <TouchableOpacity style={styles.actionBtn} onPress={onReject}>
            <Text style={{ color: '#ff6b60', fontWeight: '700' }}>✕ Татгалзах</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  metaRow: { flexDirection: 'row', gap: 14, marginTop: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  divider: { width: 1 },
});
