import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Map дээгүүр floating анхааруулга/эерэг мэдэгдэл.
 * status: 'outside' | 'inside' | null (null = геофенс тохируулаагүй тул нуух)
 */
export default function GeofenceStatusBanner({ status, colors, style }) {
  if (!status) return null;
  const outside = status === 'outside';
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface }, style]}>
      <Text
        style={[
          styles.text,
          { color: outside ? colors.danger : colors.success },
        ]}
        numberOfLines={2}
      >
        {outside ? 'Та цаг бүртгэх байршилд ороогүй байна' : 'Та цаг бүртгэх байршилд байна'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  text: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
