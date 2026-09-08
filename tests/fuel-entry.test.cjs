const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/fuelEntry.js'), 'utf8');
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const valid = { vehicle_id: 'vehicle-1', consumed_on: '2026-09-01', liters: '12,50', cost: '35000', distance_km: '100', note: '  Site visit  ' };
test('employee can backfill and decimal comma is normalized', async () => {
  const { validateFuelEntry } = await modulePromise;
  assert.deepEqual(validateFuelEntry(valid, '2026-09-07'), { vehicle_id: 'vehicle-1', consumed_on: '2026-09-01', liters: 12.5, cost: 35000, distance_km: 100, note: 'Site visit' });
});
test('invalid calendar dates and future entries are rejected', async () => {
  const { validateFuelEntry } = await modulePromise;
  for (const consumed_on of ['2026-02-30', '2026-09-08', '09/01/2026', '1999-12-31', '']) {
    assert.throws(() => validateFuelEntry({ ...valid, consumed_on }, '2026-09-07'));
  }
  assert.equal(validateFuelEntry({ ...valid, consumed_on: '2024-02-29' }, '2026-09-07').consumed_on, '2024-02-29');
});
test('reject invalid amounts, sub-cent quantities, and missing vehicle', async () => {
  const { validateFuelEntry } = await modulePromise;
  for (const patch of [{ liters: '0' }, { liters: '.001' }, { liters: 'NaN' }, { cost: '-1' }, { cost: 'Infinity' }, { liters: '10001' }, { distance_km: '-1' }, { vehicle_id: '' }, { note: 'x'.repeat(501) }]) {
    assert.throws(() => validateFuelEntry({ ...valid, ...patch }, '2026-09-07'));
  }
  assert.equal(validateFuelEntry({ ...valid, distance_km: '' }, '2026-09-07').distance_km, 0);
});
test('backfill date boundary follows Ulaanbaatar rather than UTC', async () => {
  const { fuelToday } = await modulePromise;
  assert.equal(fuelToday(new Date('2026-09-07T15:59:59Z')), '2026-09-07');
  assert.equal(fuelToday(new Date('2026-09-07T16:00:00Z')), '2026-09-08');
});
