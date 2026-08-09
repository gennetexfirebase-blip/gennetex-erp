import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { spacing, radius } from '../theme';
import { useTheme, useStyles } from '../context/ThemeContext';

export function isSoloCrew(crew) {
  if (!crew?.driver?.name) return false;
  return !(crew.passengers || []).length;
}

function PersonRow({ label, name, sub, avatarUrl }) {
  const styles = useStyles(makeStyles);
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <View style={styles.personRow}>
      <View style={styles.avatar}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarLetter}>{initial}</Text>
        )}
      </View>
      <View style={styles.personBody}>
        <Text style={styles.personLabel}>{label}</Text>
        <Text style={styles.personName}>{name || '—'}</Text>
        {sub ? <Text style={styles.personSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

/** Жолооч (машины QR) + QR уншуулсан хамт яваа (заавал биш — ганцаараа ч болно) */
export default function TeamCrewCard({ crew, compact, emptyText }) {
  const styles = useStyles(makeStyles);
  if (!crew?.driver?.name && !(crew?.passengers || []).length) {
    return emptyText ? <Text style={styles.empty}>{emptyText}</Text> : null;
  }

  const passengers = crew.passengers || [];
  const solo = isSoloCrew(crew);

  if (compact) {
    const passNames = passengers.map((p) => p.passenger_name || p.name).filter(Boolean);
    const parts = [`Жолооч: ${crew.driver?.name || '—'}`];
    if (passNames.length) {
      parts.push(`Хамт: ${passNames.join(', ')}`);
    } else {
      parts.push('Ганцаараа');
    }
    return <Text style={styles.compact}>{parts.join(' · ')}</Text>;
  }

  return (
    <View style={styles.box}>
      <PersonRow
        label="Жолооч"
        name={crew.driver?.name}
        sub={solo ? 'Машины QR · ганцаараа явж байна' : 'Машины QR уншсан'}
      />
      {solo ? (
        <View style={styles.soloPill}>
          <Text style={styles.soloPillText}>Ганцаараа явж байна</Text>
        </View>
      ) : (
        passengers.map((p) => {
          const name = p.passenger_name || p.name || '—';
          const scanned = p.scanned_at
            ? new Date(p.scanned_at).toLocaleString('mn-MN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : null;
          return (
            <PersonRow
              key={p.passenger_id || p.id || name}
              label="Хамт яваа"
              name={name}
              sub={scanned ? `QR уншсан · ${scanned}` : 'QR уншсан'}
              avatarUrl={p.avatar_url}
            />
          );
        })
      )}
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  box: {
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40 },
  avatarLetter: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  personBody: { flex: 1 },
  personLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  personName: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 1 },
  personSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  soloPill: {
    alignSelf: 'flex-start',
    marginLeft: 52,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  soloPillText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  empty: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  compact: { fontSize: 11, color: colors.textMuted, fontWeight: '600', lineHeight: 16 },
});
