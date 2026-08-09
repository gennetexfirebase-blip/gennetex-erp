import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useStyles } from '../context/ThemeContext';
import { fuelLevelColor } from '../lib/vehicleFuelStats';

export default function FuelTankGauge({
  levelPercent = 0,
  tankLiters = 60,
  remainingLiters,
  height = 120,
  showLabels = true,
}) {
  const styles = useStyles(makeStyles);
  const pct = Math.max(0, Math.min(100, Number(levelPercent) || 0));
  const remain =
    remainingLiters != null
      ? Number(remainingLiters)
      : Math.max(0, Math.round(((pct / 100) * tankLiters) * 10) / 10);
  const color = fuelLevelColor(pct);

  return (
    <View style={styles.wrap}>
      <View style={[styles.tankOuter, { height }]}>
        <View style={styles.tankCap} />
        <View style={styles.tankBody}>
          <View style={[styles.tankFill, { height: `${pct}%`, backgroundColor: color }]} />
          {showLabels ? (
            <Text style={styles.tankPct}>{pct.toFixed(0)}%</Text>
          ) : null}
        </View>
      </View>
      {showLabels ? (
        <View style={styles.meta}>
          <Text style={[styles.level, { color }]}>{remain.toFixed(1)} л</Text>
          <Text style={styles.sub}>үлдсэн / {tankLiters} л</Text>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors }) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', gap: 8 },
    tankOuter: { width: 56, alignItems: 'center' },
    tankCap: {
      width: 28,
      height: 8,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      backgroundColor: colors.border,
      marginBottom: 2,
    },
    tankBody: {
      flex: 1,
      width: '100%',
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      backgroundColor: colors.bgAlt,
    },
    tankFill: { width: '100%' },
    tankPct: {
      position: 'absolute',
      top: '38%',
      alignSelf: 'center',
      fontSize: 13,
      fontWeight: '900',
      color: '#fff',
      textShadowColor: 'rgba(0,0,0,.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    meta: { alignItems: 'center' },
    level: { fontSize: 18, fontWeight: '900' },
    sub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  });
