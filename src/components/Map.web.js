// Web fallback — react-native-maps вэб дээр ажиллахгүй тул энд орлуулна.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing } from '../theme';
import { useStyles } from '../context/ThemeContext';

export const PROVIDER_GOOGLE = 'google';

// Marker болон бусад дэд компонентууд вэб дээр юу ч зурахгүй.
export function Marker() {
  return null;
}

const MapView = React.forwardRef(function MapView({ children, style }, ref) {
  const styles = useStyles(makeStyles);
  React.useImperativeHandle(ref, () => ({
    animateCamera() {},
    animateToRegion() {},
    fitToCoordinates() {},
  }));
  return (
    <View style={[styles.fallback, style]}>
      <Text style={styles.emoji}></Text>
      <Text style={styles.text}>
        Газрын зураг зөвхөн утсан дээр (iOS / Android) харагдана.
      </Text>
      <Text style={styles.sub}>Expo Go-оор утсан дээрээ туршина уу.</Text>
    </View>
  );
});

export default MapView;

const makeStyles = ({ colors }) => StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  emoji: { fontSize: 48, marginBottom: spacing.md },
  text: { color: colors.text, fontSize: 16, textAlign: 'center', fontWeight: '600'},
  sub: { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
});
