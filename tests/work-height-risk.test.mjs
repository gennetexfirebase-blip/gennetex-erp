import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HIGH_RISK_THRESHOLD,
  approvalBlockReason,
  isPpeComplete,
  maxRiskScore,
  riskLevel,
  riskScore,
  validateAssessment,
} from '../src/modules/workHeightRisk/domain.ts';

const completePpe = [
  { item_key: 'helmet', item_label: 'Каск', required: true, passed: true },
  { item_key: 'harness', item_label: 'Бүс', required: true, passed: true },
];

test('эрсдэлийн оноо магадлал × үр дагавраар 1–25 дотор бодогдоно', () => {
  assert.equal(riskScore(3, 5), 15);
  assert.equal(riskScore(0, 9), 5);
  assert.equal(maxRiskScore([
    { hazard_type: 'a', description: 'A', likelihood: 2, consequence: 4, control_measure: 'x' },
    { hazard_type: 'b', description: 'B', likelihood: 4, consequence: 5, control_measure: 'y' },
  ]), 20);
  assert.equal(riskLevel(HIGH_RISK_THRESHOLD).key, 'high');
});

test('өндөр эрсдэлтэй ажлыг хамгаалах хэрэгсэл бүрэн байсан ч зөвшөөрөхгүй', () => {
  const reason = approvalBlockReason({
    hazards: [{ hazard_type: 'fall', description: 'Унах', likelihood: 3, consequence: 5, control_measure: 'Бэхэлгээ' }],
    ppe_checks: completePpe,
  });
  assert.match(reason, /Өндөр эрсдэлтэй/);
});

test('шаардлагатай PPE дутуу бол зөвшөөрөл хаагдана', () => {
  const checks = completePpe.map((item, index) => ({ ...item, passed: index !== 0 }));
  assert.equal(isPpeComplete(checks), false);
  assert.match(approvalBlockReason({
    hazards: [{ hazard_type: 'fall', description: 'Унах', likelihood: 2, consequence: 5, control_measure: 'Бэхэлгээ' }],
    ppe_checks: checks,
  }), /хамгаалах хэрэгслийн шалгалт/);
});

test('бага/дунд эрсдэл болон PPE бүрэн үед зөвшөөрлийн блок байхгүй', () => {
  assert.equal(approvalBlockReason({
    hazards: [{ hazard_type: 'fall', description: 'Унах', likelihood: 2, consequence: 5, control_measure: 'Бэхэлгээ' }],
    ppe_checks: completePpe,
  }), null);
});

test('үнэлгээний шаардлагатай талбар, хугацаа, аюулын хяналтыг шалгана', () => {
  const base = {
    employee_id: 'u1', employee_name: 'Бат', location_name: 'Төв байр', height_m: 8,
    work_type: 'Антен угсрах', starts_at: '2026-09-28T01:00:00Z', ends_at: '2026-09-28T03:00:00Z',
    weather: 'Тогтуун', partner_ids: [], partner_names: [], equipment: [], status: 'draft',
    hazards: [{ hazard_type: 'fall', description: 'Унах', likelihood: 2, consequence: 5, control_measure: 'Бүс' }],
    ppe_checks: completePpe,
  };
  assert.deepEqual(validateAssessment(base), []);
  assert.ok(validateAssessment({ ...base, ends_at: base.starts_at, hazards: [{ ...base.hazards[0], control_measure: '' }] }).length >= 2);
});

