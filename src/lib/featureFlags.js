/**
 * Feature flags — env + runtime overrides.
 * Хуучин модулиудыг устгахгүй; шинэ боломжуудыг асаах/унтраана.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@gennetex/feature_flags_v1';

const ENV_BOOL = (key, fallback = false) => {
  const v = process.env[key];
  if (v == null || v === '') return fallback;
  return v === '1' || v === 'true' || v === 'yes';
};

/** Анхдагч утга — бүх шинэ боломж ON (production-д env-ээр хязгаарлана) */
export const DEFAULT_FLAGS = {
  offlineFirst: ENV_BOOL('EXPO_PUBLIC_OFFLINE_FIRST', true),
  forceUpdate: ENV_BOOL('EXPO_PUBLIC_FORCE_UPDATE', true),
  crashReporting: ENV_BOOL('EXPO_PUBLIC_CRASH_REPORTING', true),
  smartToday: ENV_BOOL('EXPO_PUBLIC_SMART_TODAY', true),
  callWorkflowStrict: ENV_BOOL('EXPO_PUBLIC_CALL_WORKFLOW_STRICT', false),
  routeOptimize: ENV_BOOL('EXPO_PUBLIC_ROUTE_OPTIMIZE', true),
  customerNotify: ENV_BOOL('EXPO_PUBLIC_CUSTOMER_NOTIFY', true),
  materialSuggest: ENV_BOOL('EXPO_PUBLIC_MATERIAL_SUGGEST', true),
  lowStockAlerts: ENV_BOOL('EXPO_PUBLIC_LOW_STOCK', true),
  callCost: ENV_BOOL('EXPO_PUBLIC_CALL_COST', true),
  toolCondition: ENV_BOOL('EXPO_PUBLIC_TOOL_CONDITION', true),
  liveOps: ENV_BOOL('EXPO_PUBLIC_LIVE_OPS', true),
  slaReports: ENV_BOOL('EXPO_PUBLIC_SLA_REPORTS', true),
  autoDispatch: ENV_BOOL('EXPO_PUBLIC_AUTO_DISPATCH', true),
  payrollExport: ENV_BOOL('EXPO_PUBLIC_PAYROLL_EXPORT', true),
  knowledgeBase: ENV_BOOL('EXPO_PUBLIC_KNOWLEDGE_BASE', true),
  multiBranch: ENV_BOOL('EXPO_PUBLIC_MULTI_BRANCH', true),
  predictive: ENV_BOOL('EXPO_PUBLIC_PREDICTIVE', true),
  digitalTwin: ENV_BOOL('EXPO_PUBLIC_DIGITAL_TWIN', true),
  subcontractorMode: ENV_BOOL('EXPO_PUBLIC_SUBCONTRACTOR', true),
  barcodeScanMode: ENV_BOOL('EXPO_PUBLIC_BARCODE_MODE', true),
  publicTickets: ENV_BOOL('EXPO_PUBLIC_PUBLIC_TICKETS', true),
};

let _overrides = {};
let _loaded = false;

export async function loadFeatureFlagOverrides() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    _overrides = raw ? JSON.parse(raw) : {};
  } catch {
    _overrides = {};
  }
  _loaded = true;
  return getFeatureFlags();
}

export async function setFeatureFlag(key, value) {
  if (!(key in DEFAULT_FLAGS)) return getFeatureFlags();
  _overrides = { ..._overrides, [key]: !!value };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_overrides));
  } catch {}
  return getFeatureFlags();
}

export async function resetFeatureFlags() {
  _overrides = {};
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
  return getFeatureFlags();
}

export function getFeatureFlags() {
  const out = { ...DEFAULT_FLAGS };
  for (const k of Object.keys(DEFAULT_FLAGS)) {
    if (typeof _overrides[k] === 'boolean') out[k] = _overrides[k];
  }
  return out;
}

export function isFlagOn(key) {
  return !!getFeatureFlags()[key];
}

export function flagsLoaded() {
  return _loaded;
}
