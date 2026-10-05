const test = require('node:test');
const assert = require('node:assert/strict');
const createLoader = require('./helpers/load-app-module.cjs');

const { diagnosisCompliance, taxCompliance } = createLoader()('src/lib/vehicleCompliance.js');

test('diagnosis is green when more than 30 days remain', () => {
  const state = diagnosisCompliance(
    { diagnosisValidUntil: '2027-09-09T10:43:00.000Z' },
    new Date(2026, 8, 28, 12),
  );
  assert.equal(state.tone, 'success');
  assert.ok(state.daysLeft > 30);
});

test('diagnosis becomes red when expiry is close or passed', () => {
  const close = diagnosisCompliance(
    { diagnosisRows: [['1234 УБА', 'VIN', '2025-10-01', '2026-10-05 10:00']] },
    new Date(2026, 8, 28, 12),
  );
  const expired = diagnosisCompliance(
    { diagnosisValidUntil: '2026-09-20T10:00:00.000Z' },
    new Date(2026, 8, 28, 12),
  );
  assert.equal(close.tone, 'danger');
  assert.equal(expired.tone, 'danger');
  assert.ok(expired.daysLeft < 0);
});

test('current-year paid tax is green and unpaid or stale tax is red', () => {
  const paid = taxCompliance(
    { taxRows: [['1234 УБА', 2026, '', '', '', '2026-02-01', 'Төлсөн', true]] },
    new Date(2026, 8, 28),
  );
  const unpaid = taxCompliance(
    { taxRows: [['1234 УБА', 2026, '', '', '', '', 'Төлөөгүй', false]] },
    new Date(2026, 8, 28),
  );
  const stale = taxCompliance(
    { taxRows: [['1234 УБА', 2025, '', '', '', '2025-02-01', 'Төлсөн', true]] },
    new Date(2026, 8, 28),
  );
  assert.equal(paid.tone, 'success');
  assert.equal(unpaid.tone, 'danger');
  assert.equal(stale.tone, 'danger');
});
