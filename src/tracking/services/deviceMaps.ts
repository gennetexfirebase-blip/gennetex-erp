import { Linking, Platform } from 'react-native';
import { Coordinate } from '../utils/locationUtils';
export async function openLocationInMaps(point: Coordinate, name = '') {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) {
    throw new Error('Байршлын координат буруу байна.');
  }
  const coordinate = `${point.latitude},${point.longitude}`;
  const label = encodeURIComponent(name || 'Ажилтны байршил');
  if (Platform.OS === 'ios') {
    try { await Linking.openURL(`maps://?ll=${coordinate}&q=${label}`); }
    catch { await Linking.openURL(`https://maps.apple.com/?ll=${coordinate}&q=${label}`); }
  } else if (Platform.OS === 'android') {
    try { await Linking.openURL(`geo:${coordinate}?q=${coordinate}(${label})`); }
    catch { await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${coordinate}`); }
  } else {
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${coordinate}`);
  }
}
