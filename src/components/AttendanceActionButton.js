import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';

/**
 * Map-ийн доод төвд байрлах том дугуй "Ирлээ"/"Явлаа" товч.
 * mode: 'check_in' | 'check_out'
 * enabled: geofence дотор эсэх (check_in-д л хамаарна, check_out хаанаас ч)
 */
export default function AttendanceActionButton({ mode, enabled, loading, onPress, colors }) {
  const label = mode === 'check_in' ? 'Ирлээ' : 'Явлаа';
  const active = enabled && !loading;
  const bg = active ? colors.primary : colors.disabled;

  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: bg }]}
      onPress={onPress}
      disabled={!active}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <View style={styles.inner}>
          <Text style={styles.icon}>📍</Text>
          <Text style={[styles.label, { color: colors.onPrimary }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },
  inner: { alignItems: 'center' },
  icon: { fontSize: 26, marginBottom: 2 },
  label: { fontSize: 16, fontWeight: '700' },
});
