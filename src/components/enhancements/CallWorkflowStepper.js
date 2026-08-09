import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WORKFLOW_STEPS, getWorkflowFromCall, workflowProgress } from '../../lib/callWorkflow';
import { useTheme, useStyles } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';

export default function CallWorkflowStepper({ call }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const state = getWorkflowFromCall(call);
  const { percent } = workflowProgress(call);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Ажлын алхам</Text>
        <Text style={styles.pct}>{percent}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: colors.primary }]} />
      </View>
      <View style={styles.steps}>
        {WORKFLOW_STEPS.map((s) => {
          const done = !!state[s.key];
          return (
            <View key={s.key} style={styles.step}>
              <View style={[styles.dot, done && { backgroundColor: colors.success }]} />
              <Text style={[styles.label, done && { color: colors.text }]} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    title: { color: colors.text, fontWeight: '800', fontSize: 14 },
    pct: { color: colors.primary, fontWeight: '800' },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    fill: { height: 6, borderRadius: 3 },
    steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    step: { flexDirection: 'row', alignItems: 'center', width: '48%', gap: 6, marginBottom: 4 },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.textFaint,
    },
    label: { color: colors.textMuted, fontSize: 11, flex: 1 },
  });
