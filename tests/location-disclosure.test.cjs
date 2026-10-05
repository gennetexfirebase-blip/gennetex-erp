const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('@babel/core');

const code = transformSync(fs.readFileSync('src/services/backgroundLocationService.js', 'utf8'), {
  configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;

function setup(options = {}) {
  const events = [], alerts = [], storage = new Map();
  let running = false;
  const user = { id: 'employee-1', name: 'Employee' };
  const consentKey = '@gennetex_location_consent_v1';
  const userKey = '@bg_location_user';
  if (options.consent) storage.set(consentKey, JSON.stringify({ granted: true, userId: user.id }));
  if (options.saved) storage.set(userKey, JSON.stringify({ ...user, expiresAt: Date.now() + 60000 }));
  const permission = async (kind, status) => {
    events.push(kind);
    if (options.throwAt === kind) throw Error('Native permission failure');
    return { status: status || 'granted' };
  };
  const query = {};
  for (const name of ['select', 'eq', 'neq', 'in', 'gte', 'order']) query[name] = () => query;
  query.limit = async () => ({
    data: [{ type: options.checkedOut ? 'check_out' : 'check_in', created_at: new Date().toISOString() }],
    error: options.offline ? { message: 'Offline' } : null,
  });
  const mocks = {
    'expo-location': {
      Accuracy: { High: 4 },
      requestForegroundPermissionsAsync: () => permission('foreground', options.foreground),
      requestBackgroundPermissionsAsync: () => permission('background', options.background),
      getForegroundPermissionsAsync: () => permission('get-foreground', options.foreground),
      getBackgroundPermissionsAsync: () => permission('get-background', options.background),
      enableNetworkProviderAsync: async () => { events.push('gps'); },
      hasStartedLocationUpdatesAsync: async () => running,
      startLocationUpdatesAsync: async () => {
        events.push('start');
        if (options.startFails) throw Error('Native tracking failure');
        running = true;
      },
      stopLocationUpdatesAsync: async () => { events.push('stop'); running = false; },
    },
    'expo-task-manager': { defineTask() {} },
    '@react-native-async-storage/async-storage': {
      getItem: async key => storage.get(key) || null,
      setItem: async (key, value) => { storage.set(key, value); },
      removeItem: async key => { storage.delete(key); },
    },
    'react-native': {
      Alert: { alert(title, body, buttons) {
        alerts.push({ title, body, buttons });
        if (buttons) {
          events.push('disclosure');
          if (!options.manual) buttons[options.cancel ? 0 : 1].onPress();
        }
      } },
      DeviceEventEmitter: { emit() {} }, Platform: { OS: 'android' }, Linking: {},
    },
    'expo-application': {},
    '../lib/supabase': { supabase: { from: () => query, rpc: async () => ({}) } },
    '../tracking/services/locationService': { syncLocations: async () => {}, sendLocation: async () => {} },
    '../lib/runtimeEnv': { isExpoGo: false },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in mocks)) throw Error(`Unexpected import ${name}`);
    return mocks[name];
  }, Date, console });
  return { service: exports, user, events, alerts, storage, consentKey, userKey };
}

test('disclosure precedes foreground, background and native tracking', async () => {
  const h = setup();
  assert.equal((await h.service.startTracking(h.user, { requestPermissions: true })).ok, true);
  assert.deepEqual(h.events, ['disclosure', 'foreground', 'background', 'gps', 'start']);
  assert.equal(h.alerts[0].title, 'Байршлын зөвшөөрөл');
  assert.equal(h.alerts[0].body, 'Gennetex ERP нь идэвхтэй ажлын үеэр ажилтны ажлын байршлыг хянахын тулд байршлын мэдээлэл цуглуулдаг. Энэ нь апп хаалттай эсвэл ашиглагдаагүй үед ч ажиллаж болно. Мэдээллийг зөвхөн байгууллагын эрх бүхий администраторууд ажлын явцыг хянах зорилгоор ашиглана.');
  assert.deepEqual(Array.from(h.alerts[0].buttons, b => b.text), ['Цуцлах', 'Үргэлжлүүлэх']);
});

for (const [label, options, reason, events] of [
  ['cancel', { cancel: true }, 'consent-declined', ['disclosure']],
  ['foreground denied', { foreground: 'denied' }, 'no-foreground-permission', ['disclosure', 'foreground']],
  ['background denied', { background: 'denied' }, 'no-background-permission', ['disclosure', 'foreground', 'background']],
  ['native API throws', { throwAt: 'background' }, 'tracking-start-failed', ['disclosure', 'foreground', 'background']],
]) {
  test(`${label}: no tracking, no silent resume`, async () => {
    const h = setup({ ...options, consent: true, saved: true });
    const result = await h.service.startTracking(h.user, { requestPermissions: true });
    assert.equal(result.reason, reason);
    assert.deepEqual(h.events, events);
    assert.equal(JSON.parse(h.storage.get(h.consentKey)).granted, false);
    assert.equal((await h.service.startTracking(h.user)).ok, false);
    assert.deepEqual(h.events, events);
    assert.equal(h.alerts.length, options.cancel ? 1 : 2);
  });
}

test('startup never opens disclosure or system permission dialogs', async () => {
  for (const options of [{}, { consent: true }, { consent: true, saved: true, background: 'denied' }]) {
    const h = setup(options);
    assert.equal((await h.service.startTracking(h.user)).ok, false);
    assert.equal(h.alerts.length, 0);
    assert.equal(h.events.some(e => ['foreground', 'background', 'start', 'gps'].includes(e)), false);
  }
});

test('authorized active session resumes without prompting, including offline', async () => {
  for (const offline of [false, true]) {
    const h = setup({ consent: true, saved: true, offline });
    assert.equal((await h.service.startTracking(h.user)).ok, true);
    assert.deepEqual(h.events, ['get-foreground', 'get-background', 'start']);
    assert.equal(h.alerts.length, 0);
  }
});

test('checkout during permission flow prevents tracking', async () => {
  const h = setup({ checkedOut: true });
  assert.equal((await h.service.startTracking(h.user, { requestPermissions: true })).reason, 'outside-session');
  assert.equal(h.events.includes('start'), false);
});

test('failed native tracking startup cannot silently resume later', async () => {
  const h = setup({ startFails: true });
  assert.equal((await h.service.startTracking(h.user, { requestPermissions: true })).ok, false);
  assert.equal(h.storage.has(h.userKey), false);
  const attempts = h.events.filter(event => event === 'start').length;
  assert.equal((await h.service.startTracking(h.user)).ok, false);
  assert.equal(h.events.filter(event => event === 'start').length, attempts);
});

test('pending disclosure blocks competing starts and logout cancels continuation', async () => {
  const h = setup({ manual: true });
  let current = true;
  const pending = h.service.startTracking(h.user, { requestPermissions: true, isCurrent: () => current });
  while (!h.alerts.length) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await h.service.startTracking(h.user)).ok, false);
  assert.equal((await h.service.startTracking(h.user, { requestPermissions: true })).ok, false);
  current = false;
  h.alerts[0].buttons[1].onPress();
  assert.equal((await pending).ok, false);
  assert.deepEqual(h.events, ['disclosure']);
});
