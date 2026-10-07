const test = require('node:test');
const assert = require('node:assert/strict');
const createLoader = require('./helpers/load-app-module.cjs');

function setup() {
  const timers = new Map(), events = [];
  let nextTimer = 0, signaling, update, sessionOptions;
  const React = {
    createContext: () => ({ Provider: 'Provider' }),
    createElement: (type, props) => ({ type, props }),
    useState: initial => { let value = initial; return [value, next => { value = typeof next === 'function' ? next(value) : next; }]; },
    useRef: current => ({ current }), useMemo: fn => fn(), useCallback: fn => fn, useEffect() {},
  };
  const session = { localStream: {}, createOffer: async () => {}, acceptAnswer: async () => {}, close: () => events.push('closed') };
  const load = createLoader({
    react: React,
    'react-native': { Platform: { OS: 'web' }, Alert: { alert: (...args) => events.push(args) } },
    './AppContext': { useApp: () => ({ currentUser: { id: 'me' }, isCloud: true }) },
    '../lib/runtimeEnv': { isExpoGo: false },
    '../services/voipCallService': {
      CALL_STATE: { RINGING: 'ringing', CONNECTING: 'connecting', CONNECTED: 'connected', ENDED: 'ended', MISSED: 'missed' },
      CALL_TEXT: {}, toUiState: status => status, isTerminal: status => status === 'ended',
      startCall: async () => ({ call: { id: 'call-1' } }),
      subscribeCall: (id, callback) => { update = callback; return () => {}; },
      cancelCall: async () => events.push('cancelled'), endCall: async () => events.push('ended'),
    },
    '../services/webrtcService': {
      isWebRtcAvailable: () => true, ensureCallPermissions: async () => ({ ok: true }), hasTurn: () => true,
      openSignaling: (id, handlers) => { signaling = handlers; return { close() {}, send: async () => {} }; },
      createCallSession: async options => { sessionOptions = options; return session; },
    },
    'react-native-webrtc': { RTCView: 'RTCView' },
    '../services/callAlertService': { stopIncomingCallAlert() {} },
    '../services/nativeIncomingCallService': { isNativeIncomingCallAvailable: () => false, hideNativeIncomingCall() {} },
    '../lib/incomingCallBridge': {}, '../lib/navigationRef': {},
  }, {
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id),
  });
  const api = load('src/context/CallContext.js').CallProvider({}).props.value;
  return { api, timers, events, accepted: () => update({ status: 'accepted' }),
    connect: async () => { await signaling.onRinging(); sessionOptions.onStateChange('connected'); },
    expire: () => { for (const callback of [...timers.values()]) callback(); timers.clear(); } };
}

for (const type of ['audio', 'video']) test(`${type}: accepted/connected calls survive ringing timeout until hangup`, async () => {
  const h = setup();
  await h.api.placeCall({ id: 'peer' }, type);
  assert.equal(h.timers.size, 1);
  const staleCallback = [...h.timers.values()][0];
  h.accepted();
  assert.equal(h.timers.size, 0);
  await h.connect();
  staleCallback(); // A timeout already queued before acceptance must also be harmless.
  h.expire();
  assert.equal(h.events.includes('cancelled'), false);
  assert.equal(h.events.includes('closed'), false);
  await h.api.hangUp();
  assert.ok(h.events.includes('ended'));
  assert.ok(h.events.includes('closed'));
});

test('unanswered calls still time out', async () => {
  const h = setup();
  await h.api.placeCall({ id: 'peer' });
  h.expire();
  assert.ok(h.events.includes('cancelled'));
});

test('WebRTC connection cancels timeout even if server acceptance event was lost', async () => {
  const h = setup();
  await h.api.placeCall({ id: 'peer' });
  await h.connect();
  assert.equal(h.timers.size, 0);
  h.expire();
  assert.equal(h.events.includes('cancelled'), false);
});
