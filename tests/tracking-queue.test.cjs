const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function compile(path, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => imports[name], Date, Math, Number, Map, Promise, JSON, setInterval, clearInterval });
  return exports;
}
test('offline queue persists, syncs original timestamps and never crosses login identity', async () => {
  const storage = new Map(); let connected = false, user = 'employee-a'; const received = [];
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: user } } } }) },
    rpc: async (_, args) => { if (!connected) return { error: new Error('offline') }; received.push(...(args.points || [args.p])); return { error: null }; } };
  const service = compile('src/tracking/services/locationService.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async key => storage.get(key) || null, setItem: async (key,value) => storage.set(key,value) } },
    'expo-battery': { getBatteryLevelAsync: async () => 0.68 },
    '@react-native-community/netinfo': { __esModule: true, default: {} },
    './realtimeLocationService': { trackingClient: () => client },
    '../utils/locationUtils': compile('src/tracking/utils/locationUtils.ts'),
  });
  const timestamp=Date.now()-10000;
  await assert.rejects(service.sendLocation(user,{timestamp,coords:{latitude:47.91891,longitude:106.91842,accuracy:4,speed:3,heading:86}}),/offline/);
  const saved=JSON.parse(storage.get('@erp_tracking_v1:employee-a'));
  assert.equal(saved[0].timestamp,timestamp); assert.equal(saved[0].battery,68);
  connected=true;user='employee-b';await service.syncLocations('employee-a');assert.equal(received.length,0);
  user='employee-a';await service.syncLocations(user);
  assert.equal(received[0].timestamp,timestamp);assert.equal(JSON.parse(storage.get('@erp_tracking_v1:employee-a')).length,0);
});
