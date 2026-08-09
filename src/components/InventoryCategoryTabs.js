import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { spacing, radius } from '../theme';
import { useStyles } from '../context/ThemeContext';

const TABS = [
  { key: 'all', label: 'Бүгд' },
  { key: 'material', label: 'Бараа материал' },
  { key: 'tool', label: 'Багаж' },
];

export default function InventoryCategoryTabs({ value = 'all', onChange, style }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.row, style]}>
      {TABS.map((tab) => {
        const active = value === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.chip, active && styles.chipOn]}
            onPress={() => onChange?.(tab.key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.text, active && styles.textOn]} numberOfLines={1}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  text: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  textOn: { color: colors.primary },
});
