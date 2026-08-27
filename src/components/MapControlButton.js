import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Map-ийн хажуугийн дугуй floating товч.
 *
 * ⚠️ `Pressable` + `hitSlop` ашиглана: MapView бол native view тул түүний
 * дээрх товчнууд хангалттай том touch талбайтай байх ёстой, эс бөгөөс
 * даралт map руу "унана".
 */
export default function MapControlButton({ icon, onPress, colors, style, accessibilityLabel }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: colors.surface },
        pressed && { opacity: 0.65, transform: [{ scale: 0.94 }] },
        style,
      ]}
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 6,
    marginBottom: 12,
  },
});
