/**
 * Subcontractor mode — гадны багт зөвхөн call + photo + material.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isFlagOn } from '../lib/featureFlags';

const KEY = '@gennetex/subcontractor_mode_v1';

/** Хязгаарлагдсан модулиуд */
export const SUBCONTRACTOR_ALLOWED_SCREENS = new Set([
  'Home',
  'MainTabs',
  'Calls',
  'CallDetail',
  'Attendance',
  'MyStock',
  'SiteWork',
  'Profile',
  'Ohaab',
  'KnowledgeBase',
  'Today',
  'RouteOptimize',
]);

export const SUBCONTRACTOR_HOME_MODULES = [
  { key: 'Calls', label: 'Дуудлага', icon: 'calls', color: '#0891b2' },
  { key: 'MyStock', label: 'Миний үлдэгдэл', icon: 'allocation', color: '#16a34a' },
  { key: 'SiteWork', label: 'Ажлын байр', icon: 'location', color: '#059669' },
  { key: 'Attendance', label: 'Ирц', icon: 'attendance', color: '#db2777' },
  { key: 'KnowledgeBase', label: 'Заавар', icon: 'report', color: '#6366f1' },
];

export async function isSubcontractorMode() {
  if (!isFlagOn('subcontractorMode')) return false;
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setSubcontractorMode(on) {
  await AsyncStorage.setItem(KEY, on ? '1' : '0');
  return !!on;
}

export function filterModulesForSubcontractor(modules = []) {
  return (modules || []).filter((m) => SUBCONTRACTOR_ALLOWED_SCREENS.has(m.key));
}
