import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@ai_inventory_settings_v1';

const DEFAULTS = {
  confidenceThreshold: 0.45,
  minDetectionSize: 0.04,
  trackingTimeout: 30,
  cameraResolution: '720p',
  fpsLimit: 15,
  modelSelection: 'yolov8n',
  matchIou: 0.3,
};

let state = { ...DEFAULTS };
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(state));
}

export async function loadInventorySettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) state = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {}
  emit();
  return state;
}

export function getInventorySettings() {
  return state;
}

export async function updateInventorySettings(patch) {
  state = { ...state, ...patch };
  emit();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {}
  return state;
}

export function subscribeInventorySettings(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function useInventorySettings() {
  const React = require('react');
  const [s, setS] = React.useState(state);
  React.useEffect(() => subscribeInventorySettings(setS), []);
  return s;
}
