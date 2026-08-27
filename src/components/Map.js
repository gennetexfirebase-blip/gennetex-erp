// Native (iOS/Android) — react-native-maps-г шууд ашиглана.
//
// ⚠️ 2026-08-27: Android дээр Google Maps API key нь AndroidManifest-д
// `com.google.android.geo.API_KEY` meta-data байхгүй бол `MapView`-ийн
// НАТИВ constructor нь `IllegalStateException: API key not found` шидэж,
// БҮТЭН аппыг унагаадаг (JS-ийн try/catch, ErrorBoundary барьж чадахгүй —
// алдаа UI thread дээр гардаг). Ирц дэлгэц газрын зурагтай тул түлхүүр
// дутуу build дээр "Ирц рүү орох бүрд апп хаагдана".
//
// Тиймээс түлхүүр байхгүй бол натив газрын зургийг ОГТ mount хийхгүй,
// оронд нь тайлбартай орлуулагч харуулна. Ингэснээр газрын зураг
// харагдахгүй ч ирц бүртгэл (Ирлээ/Явлаа), бусад бүх функц ажиллана.
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import NativeMapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';

// `app.config.js` нь ЯГ энэ env-ээс manifest-ийн meta-data-г бөглөдөг тул
// JS талын энэ шалгалт натив талын байдалтай үргэлж таарна.
const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// iOS дээр түлхүүргүй үед Apple Maps руу уначихдаг тул зөвхөн Android л
// бүрэн орлуулагч шаардана.
const NEEDS_KEY = Platform.OS === 'android';
const MAPS_READY = Boolean(MAPS_KEY) || !NEEDS_KEY;

const MapFallback = React.forwardRef(function MapFallback({ style }, ref) {
  React.useImperativeHandle(ref, () => ({
    animateCamera() {},
    animateToRegion() {},
    fitToCoordinates() {},
  }));
  return (
    <View style={[styles.fallback, style]}>
      <Text style={styles.emoji}>🗺️</Text>
      <Text style={styles.text}>Газрын зураг түр ажиллахгүй байна</Text>
      <Text style={styles.sub}>
        Google Maps түлхүүр тохируулаагүй хувилбар. Ирц бүртгэл хэвийн
        ажиллана — байршил зөвхөн зурган дээр харагдахгүй.
      </Text>
    </View>
  );
});

const MapView = MAPS_READY ? NativeMapView : MapFallback;

// Орлуулагч үед children нь render хийгддэггүй ч, дуудагдвал натив view
// үүсгэхээс сэргийлж null буцаана.
const SafeMarker = MAPS_READY ? Marker : () => null;
const SafeCircle = MAPS_READY ? Circle : () => null;

export { SafeMarker as Marker, SafeCircle as Circle, PROVIDER_GOOGLE, MAPS_READY };
export default MapView;

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9EEF3',
    padding: 24,
  },
  emoji: { fontSize: 44, marginBottom: 12 },
  text: { color: '#1F2933', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  sub: {
    color: '#5A6672',
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
  },
});
