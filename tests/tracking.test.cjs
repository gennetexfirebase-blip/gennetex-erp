const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const code = ts.transpileModule(fs.readFileSync('src/tracking/utils/locationUtils.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exportsObject = {}; vm.runInNewContext(code, { exports: exportsObject, Date, Math, Number });
const u = exportsObject;
const now = 1788835811000;
const point = { employee_id: 'test', latitude: 47.91891, longitude: 106.91842, accuracy: 4, speed: 2, heading: 86, battery: 68, timestamp: now };
test('Haversine known equatorial degree and identical points', () => {
  assert.ok(Math.abs(u.distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111194.93) < 1);
  assert.equal(u.distanceMeters(point, point), 0);
});
test('reject impossible jumps and non chronological points', () => {
  assert.equal(u.plausible(point, { ...point, latitude: point.latitude + 0.03, timestamp: now + 5000 }), false);
  assert.equal(u.plausible(point, point), false);
  assert.equal(u.plausible(point, { ...point, latitude: point.latitude + 0.0001, timestamp: now + 5000 }), true);
});
test('status exact thresholds and ended work session', () => {
  assert.equal(u.trackingStatus(point, now + 30000), 'online');
  assert.equal(u.trackingStatus(point, now + 30001), 'weak');
  assert.equal(u.trackingStatus(point, now + 120000), 'weak');
  assert.equal(u.trackingStatus(point, now + 120001), 'offline');
  assert.equal(u.trackingStatus({ ...point, online: false }, now), 'offline');
});
test('validation rejects bad GPS, future and expired samples', () => {
  assert.equal(u.validPoint(point, now), true);
  for (const changes of [{ latitude: NaN }, { longitude: 181 }, { accuracy: 500 }, { speed: 100 }, { timestamp: now + 60001 }, { timestamp: now - 8 * 86400000 }]) assert.equal(u.validPoint({ ...point, ...changes }, now), false);
});
test('movement intervals, UB day boundary and accuracy categories', () => {
  assert.equal(u.updateInterval(10), 5000); assert.equal(u.updateInterval(1), 12000); assert.equal(u.updateInterval(0), 30000);
  assert.equal(u.trackingDay(Date.parse('2026-09-08T16:00:00Z')), '2026-09-09');
  assert.equal(u.accuracyLabel(10), 'Excellent'); assert.equal(u.accuracyLabel(30), 'Good'); assert.equal(u.accuracyLabel(31), 'Low accuracy');
});
test('route distance excludes jumps', () => {
  assert.equal(u.routeDistance([point, { ...point, latitude: 49, timestamp: now + 5000 }]), 0);
  assert.ok(u.routeDistance([point, { ...point, latitude: point.latitude + 0.0001, timestamp: now + 5000 }]) > 0.01);
});
