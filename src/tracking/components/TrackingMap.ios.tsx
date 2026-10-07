import React, { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { LocationPoint, lastSeen, trackingStatus } from '../utils/locationUtils';

/**
 * iPhone: Apple Maps (react-native-maps, түлхүүр шаардахгүй).
 *
 * Android/вэб нь `TrackingMap.tsx` (WebView + OpenStreetMap)-ийг хэвээр
 * ашиглана — Android дээр Google Maps түлхүүргүй үед апп унадаг байсан.
 * Props болон `command()` нь WebView хувилбартай ЯГ ИЖИЛ.
 */
export type TrackingMapHandle = { command: (command: string) => void };
type Props = {
  employees: LocationPoint[]; points?: LocationPoint[]; selected?: string; follow?: boolean; satellite?: boolean;
  sites?: any[]; now: number; onSelect?: (id: string) => void; onPan?: () => void; interactive?: boolean;
};

// Улаанбаатар — өгөгдөл ирэхээс өмнөх анхны харагдац.
const UB = { latitude: 47.9184, longitude: 106.9177, latitudeDelta: 0.12, longitudeDelta: 0.12 };
const STATUS_COLOR: Record<string, string> = { online: '#16a34a', weak: '#d97706', offline: '#64748b' };

export default memo(forwardRef<TrackingMapHandle, Props>(function TrackingMap(
  { employees, points, selected, follow, satellite, sites, now, onSelect, onPan, interactive = true }, ref) {
  const map = useRef<MapView>(null);
  const fitted = useRef(false);

  const coords = useMemo(() => employees.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)), [employees]);
  const route = useMemo(() => (points || []).map(p => ({ latitude: p.latitude, longitude: p.longitude })), [points]);

  const fitTo = (list: { latitude: number; longitude: number }[], animated = true) => {
    if (!list.length) return;
    if (list.length === 1) {
      map.current?.animateToRegion({ ...list[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }, animated ? 500 : 0);
      return;
    }
    map.current?.fitToCoordinates(list, { edgePadding: { top: 70, right: 50, bottom: 70, left: 50 }, animated });
  };

  useImperativeHandle(ref, () => ({
    command: (command: string) => {
      if (command === 'route') fitTo(route.length ? route : coords);
      else {
        const target = coords.find(p => p.employee_id === selected) || coords[0];
        if (target) fitTo([target]);
      }
    },
  }), [coords, route, selected]);

  // Анх өгөгдөл ирэхэд бүгдийг багтаана.
  useEffect(() => {
    if (fitted.current || !coords.length) return;
    fitted.current = true;
    setTimeout(() => fitTo(coords, false), 50);
  }, [coords]);

  // Follow: сонгосон ажилтан хөдлөх бүрд дагана.
  useEffect(() => {
    if (!follow) return;
    const target = coords.find(p => p.employee_id === selected);
    if (target) map.current?.animateCamera({ center: { latitude: target.latitude, longitude: target.longitude } }, { duration: 400 });
  }, [follow, selected, coords]);

  return (
    <View style={styles.wrap}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={UB}
        mapType={satellite ? 'hybrid' : 'standard'}
        showsCompass={interactive}
        showsScale={false}
        pitchEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        toolbarEnabled={false}
        onPanDrag={() => onPan?.()}
      >
        {route.length > 1 ? <Polyline coordinates={route} strokeColor="#0891b2" strokeWidth={4} /> : null}
        {route.length ? <Circle center={route[0]} radius={14} fillColor="#16a34a" strokeColor="#ffffff" strokeWidth={2} /> : null}
        {(sites || []).filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude)).map((s, i) => (
          <Marker key={`site-${i}`} coordinate={{ latitude: s.latitude, longitude: s.longitude }} title={s.name || s.customer || 'Үйлчилгээний байршил'} pinColor="#7c3aed" />
        ))}
        {coords.map(p => {
          const status = trackingStatus(p, now);
          const color = STATUS_COLOR[status] || STATUS_COLOR.online;
          const active = p.employee_id === selected;
          const name = String(p.name || 'Ажилтан').trim();
          return (
            <Marker
              key={p.employee_id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              onPress={() => onSelect?.(p.employee_id)}
              accessibilityLabel={`${name}, ${lastSeen(p.timestamp, now)}`}
            >
              <View style={styles.pinWrap}>
                <View style={[styles.pin, { borderColor: color }, active && styles.pinActive]}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={styles.pinText} numberOfLines={1}>{name.split(' ')[0]}</Text>
                </View>
                <View style={[styles.tail, { borderTopColor: active ? '#0075ad' : '#ffffff' }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}));

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 160, overflow: 'hidden' },
  pinWrap: { alignItems: 'center' },
  pin: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 140,
    backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 2, paddingHorizontal: 8, paddingVertical: 4,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  pinActive: { backgroundColor: '#e3f2fb', borderColor: '#0075ad' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pinText: { color: '#0f172a', fontSize: 12, fontWeight: '700' },
  tail: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },
});
