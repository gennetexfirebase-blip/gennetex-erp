// Web fallback — вэб дээр WebView байдаггүй тул газрын зургийг орлуулна.
// (Native тал нь OpenStreetMap-ийг Leaflet-ээр зурдаг — Map.js.)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing } from '../theme';
import { useStyles } from '../context/ThemeContext';

export const PROVIDER_GOOGLE = 'google';

// Native талтай ижил API — вэб дээр газрын зураг байхгүй тул үргэлж false.
export const MAPS_READY = false;

// Marker болон бусад дэд компонентууд вэб дээр юу ч зурахгүй.
export function Marker() {
  return null;
}

export function Circle() {
  return null;
}

export function Polyline() {
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
      <Text style={styles.sub}>Гар утасны аппаараа нээнэ үү.</Text>
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
