import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

/** Map-ийн баруун талын дугуй floating товч (одоогийн байршил/ажлын газар/түүх). */
export default function MapControlButton({ icon, onPress, colors, style, accessibilityLabel }) {
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: colors.surface }, style]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[styles.icon, { color: colors.primary }]}>{icon}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 10,
  },
  icon: { fontSize: 18 },
});
