import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Map screen-ийн доод, rounded-top цагаан панел — товч 2 + өнөөдрийн хуваарийн мөр. */
export default function AttendanceBottomPanel({
  colors,
  onPressSummary,
  onPressRequest,
  onPressLocation,
  dateLabel,
  scheduleLabel,
  locations = [],
  activeLocationId,
}) {
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface }]}>
      <View style={styles.handle} />
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={onPressSummary}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Цаг бүртгэл</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: colors.primarySoft }]}
          onPress={onPressRequest}
          activeOpacity={0.85}
        >
          <Text style={[styles.secondaryText, { color: colors.primary }]}>Хүсэлт</Text>
        </TouchableOpacity>
      </View>
      {/* Бүртгэл хийх боломжтой БҮХ цэг — ажилтан хаана бүртгүүлж болохоо
          мэдэх ёстой. Дарахад тухайн цэг рүү газрын зураг төвлөрнө. */}
      {locations.length > 0 ? (
        <View style={styles.locSection}>
          <Text style={[styles.locHead, { color: colors.textMuted }]}>
            Бүртгэл хийх боломжтой цэг ({locations.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
              {locations.map((l) => {
                const active = l.id === activeLocationId;
                return (
                  <TouchableOpacity
                    key={l.id}
                    style={[
                      styles.locChip,
                      {
                        backgroundColor: active ? colors.primarySoft : colors.surfaceAlt,
                        borderColor: active ? colors.primary : 'transparent',
                      },
                    ]}
                    onPress={() => onPressLocation?.(l)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name="location"
                      size={13}
                      color={active ? colors.primary : colors.textMuted}
                    />
                    <Text
                      style={{
                        color: active ? colors.primary : colors.text,
                        fontSize: 12,
                        fontWeight: active ? '700' : '500',
                      }}
                      numberOfLines={1}
                    >
                      {l.name}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {l.radius_m || 200}м
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.scheduleRow}>
        <Text style={[styles.scheduleLeft, { color: colors.text }]}>Өнөөдөр</Text>
        <Text style={[styles.scheduleRight, { color: colors.textMuted }]}>
          {dateLabel} · {scheduleLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // MapView (native) дээр байрлах тул давхаргыг тодорхой зааж өгнө.
    zIndex: 80,
    elevation: 80,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginBottom: 14,
  },
  row: { flexDirection: 'row', gap: 12 },
  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '700' },
  locSection: { marginTop: 14 },
  locHead: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
  locChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 190,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  scheduleLeft: { fontSize: 13, fontWeight: '600' },
  scheduleRight: { fontSize: 13 },
});
