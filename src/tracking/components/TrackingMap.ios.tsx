import React, { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { SvgXml } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { LocationPoint, lastSeen, trackingStatus } from '../utils/locationUtils';
import { sanitizeAvatarUrl } from '../../lib/avatarUrl';
import PERSON_AVATARS from '../../theme/personAvatars';

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
  sites?: any[]; now: number; onSelect?: (id: string) => void; onPan?: () => void; interactive?: boolean; meId?: string;
};

// Улаанбаатар — өгөгдөл ирэхээс өмнөх анхны харагдац.
const UB = { latitude: 47.9184, longitude: 106.9177, latitudeDelta: 0.12, longitudeDelta: 0.12 };
const STATUS_COLOR: Record<string, string> = { online: '#15924A', weak: '#B86E00', offline: '#98A2B1' };
const BRAND = '#0B6E4F';
const AV = ['#8A63D2', '#1F9D74', '#E07A3F', '#3B7DD8', '#C2410C', '#0E8A86', '#DD3F7C', '#4652DE'];
function avColor(name: string) { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AV[h % AV.length]; }
/** ≥10 км/ц бол машинтай явж байна гэж үзнэ (алхах ~5 км/ц). */
function driving(p: LocationPoint, offline: boolean) { return !offline && p.speed != null && p.speed >= 2.8; }
function avIndex(name: string) { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % (PERSON_AVATARS.length || 1); }
function initials(name: string) { return name.replace(/[-.]/g, ' ').trim().split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase() || '?'; }

export default memo(forwardRef<TrackingMapHandle, Props>(function TrackingMap(
  { employees, points, selected, follow, satellite, sites, now, onSelect, onPan, interactive = true, meId }, ref) {
  const map = useRef<MapView>(null);
  const fitted = useRef(false);
  const [track, setTrack] = useState(true);
  useEffect(() => {
    if (!track) return undefined;
    const t = setTimeout(() => setTrack(false), 2500);
    return () => clearTimeout(t);
  }, [track]);
  // Шинэ ажилтан нэмэгдэх эсвэл сонголт солигдоход дүрсийг дахин зурна.
  // Машинтай/явган төлөв, хурд (5 км/ц алхамаар) солигдоход мөн дахин зурна.
  const driveSig = employees.map(p => (driving(p, trackingStatus(p, now) === 'offline') ? Math.round((p.speed || 0) * 3.6 / 5) : '-')).join(',');
  useEffect(() => { setTrack(true); }, [employees.length, selected, driveSig]);

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
        {route.length > 1 ? <Polyline coordinates={route} strokeColor={BRAND} strokeWidth={4} /> : null}
        {route.length ? <Circle center={route[0]} radius={14} fillColor="#15924A" strokeColor="#ffffff" strokeWidth={2} /> : null}
        {(sites || []).filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude)).map((s, i) => (
          <Marker key={`site-${i}`} coordinate={{ latitude: s.latitude, longitude: s.longitude }} title={s.name || s.customer || 'Үйлчилгээний байршил'} pinColor="#6F4FD8" />
        ))}
        {coords.map(p => {
          const status = trackingStatus(p, now);
          const offline = status === 'offline';
          const active = p.employee_id === selected;
          const name = String(p.name || 'Ажилтан').trim();
          const uri = sanitizeAvatarUrl(p.avatar_url);
          const me = !!meId && p.employee_id === meId;
          return (
            <Marker
              key={p.employee_id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={me ? 10 : active ? 8 : driving(p, offline) ? 6 : offline ? 1 : 3}
              // Зураг ачаалагдах хүртэл дүрсийг шинэчилнэ, дараа нь зогсооно (гүйцэтгэл).
              tracksViewChanges={track}
              onPress={() => onSelect?.(p.employee_id)}
              accessibilityLabel={`${name}, ${lastSeen(p.timestamp, now)}`}
            >
              {driving(p, offline) ? (
                // Машинтай явж байна: ногоон дугуй + машин, буланд нь жижиг зураг, хурд.
                <View style={styles.pinWrap}>
                  <View style={[styles.car, active && styles.phActive]}>
                    <Ionicons name="car-outline" size={20} color="#ffffff" />
                    <View style={styles.mini}>
                      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} onLoad={() => setTrack(true)} />
                        : PERSON_AVATARS.length ? <SvgXml xml={PERSON_AVATARS[avIndex(name)]} width="100%" height="100%" /> : null}
                    </View>
                  </View>
                  <View style={[styles.nm, active && { backgroundColor: BRAND }]}>
                    <View style={[styles.dot, { backgroundColor: STATUS_COLOR.online }]} />
                    <Text style={[styles.pinText, active && { color: '#ffffff' }]} numberOfLines={1}>
                      {me ? 'Та' : name.split(' ')[0]} <Text style={{ color: active ? '#C9F2DA' : '#15924A', fontWeight: '800' }}>{Math.round((p.speed || 0) * 3.6)} км/ц</Text>
                    </Text>
                  </View>
                </View>
              ) : (
              /* Дизайн: дугуй зураг + доор нь нэр; өөрөө бол «Та». */
              <View style={styles.pinWrap}>
                {me ? <View style={styles.halo} /> : null}
                <View style={[styles.ph, { backgroundColor: uri || PERSON_AVATARS.length ? '#ffffff' : offline ? '#98A2B1' : avColor(name) }, me && styles.phMe, active && styles.phActive]}>
                  {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} onLoad={() => setTrack(true)} />
                    : PERSON_AVATARS.length ? <SvgXml xml={PERSON_AVATARS[avIndex(name)]} width="100%" height="100%" />
                      : <Text style={styles.phText}>{initials(name)}</Text>}
                </View>
                <View style={[styles.nm, (active || me) && { backgroundColor: BRAND }]}>
                  <View style={[styles.dot, { backgroundColor: me ? '#7CE0A6' : STATUS_COLOR[status] || STATUS_COLOR.online }]} />
                  <Text style={[styles.pinText, offline && { color: '#677284' }, (active || me) && { color: '#ffffff' }]} numberOfLines={1}>{me ? 'Та' : name.split(' ')[0]}</Text>
                </View>
              </View>
              )}
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
  ph: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#0F1722', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5,
  },
  phActive: { borderColor: BRAND, transform: [{ scale: 1.15 }] },
  car: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, borderColor: '#ffffff', backgroundColor: '#15924A', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0F1722', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5,
  },
  mini: { position: 'absolute', top: -6, right: -10, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ffffff', backgroundColor: '#ffffff', overflow: 'hidden' },
  phMe: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, overflow: 'hidden' },
  halo: { position: 'absolute', top: -13, width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(21,146,74,0.15)', borderWidth: 1.5, borderColor: 'rgba(21,146,74,0.35)' },
  phText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  nm: {
    flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 130, marginTop: -6,
    backgroundColor: '#ffffff', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2,
    shadowColor: '#0F1722', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 3,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pinText: { color: '#0F1722', fontSize: 11, fontWeight: '700' },
});
