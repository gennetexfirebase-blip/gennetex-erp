import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { radius, spacing } from '../../theme';
import { riskLevel, riskScore } from './domain';
import type { PpeCheck } from './types';

export function ScorePicker({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.scoreBlock}>
      <Text style={[styles.smallLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.scoreRow}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Pressable
            key={score}
            onPress={() => onChange(score)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === score }}
            style={[styles.score, { borderColor: colors.border, backgroundColor: value === score ? colors.primary : colors.surfaceAlt }]}
          >
            <Text style={{ color: value === score ? '#fff' : colors.text, fontWeight: '800' }}>{score}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function RiskBadge({ likelihood, consequence, score: explicit }: { likelihood?: number; consequence?: number; score?: number }) {
  const score = explicit ?? riskScore(likelihood || 1, consequence || 1);
  const level = riskLevel(score);
  return (
    <View style={[styles.riskBadge, { backgroundColor: `${level.color}18`, borderColor: `${level.color}66` }]}>
      <Text style={[styles.riskText, { color: level.color }]}>{level.label} · {score}</Text>
    </View>
  );
}

export function PpeChecklist({ items, onChange, readonly = false }: { items: PpeCheck[]; onChange?: (items: PpeCheck[]) => void; readonly?: boolean }) {
  const { colors } = useTheme();
  const toggle = (index: number) => {
    if (readonly || !onChange) return;
    onChange(items.map((item, i) => (i === index ? { ...item, passed: !item.passed } : item)));
  };
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((item, index) => (
        <Pressable
          key={item.item_key}
          onPress={() => toggle(index)}
          disabled={readonly}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.passed, disabled: readonly }}
          style={[styles.checkRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
        >
          <Ionicons name={item.passed ? 'checkbox' : 'square-outline'} size={24} color={item.passed ? colors.success : colors.textMuted} />
          <Text style={[styles.checkLabel, { color: colors.text }]}>{item.item_label}{item.required ? ' *' : ''}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scoreBlock: { flex: 1, minWidth: 145 },
  smallLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  scoreRow: { flexDirection: 'row', gap: 6 },
  score: { width: 34, height: 34, borderWidth: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  riskBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  riskText: { fontSize: 12, fontWeight: '800' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
