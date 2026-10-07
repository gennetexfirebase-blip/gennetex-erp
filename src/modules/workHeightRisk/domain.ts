import type { PpeCheck, WorkHeightAssessment, WorkHeightHazard, WorkHeightStatus } from './types';

export const HIGH_RISK_THRESHOLD = 15;

export const STATUS_LABELS: Record<WorkHeightStatus, string> = {
  draft: 'Ноорог',
  pending_review: 'Үнэлгээ хүлээгдэж байна',
  changes_required: 'Засвар шаардлагатай',
  hse_approved: 'ХАБЭА баталгаажуулсан',
  management_approved: 'Удирдлага зөвшөөрсөн',
  in_progress: 'Ажил үргэлжилж байна',
  completed: 'Ажил дууссан',
  stopped: 'Ажил зогсоосон',
};

export const STATUS_TONES: Record<WorkHeightStatus, 'neutral' | 'warning' | 'danger' | 'info' | 'success'> = {
  draft: 'neutral',
  pending_review: 'warning',
  changes_required: 'danger',
  hse_approved: 'info',
  management_approved: 'success',
  in_progress: 'info',
  completed: 'success',
  stopped: 'danger',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: 'Үнэлгээ үүсгэсэн',
  updated: 'Үнэлгээ шинэчилсэн',
  submit: 'Үнэлгээнд илгээсэн',
  request_changes: 'Засвар шаардсан',
  hse_approve: 'ХАБЭА баталгаажуулсан',
  management_approve: 'Удирдлага зөвшөөрсөн',
  start: 'Ажил эхлүүлсэн',
  complete: 'Ажил дуусгасан',
  stop: 'Ажил зогсоосон',
  incident_auto_stop: 'Ноцтой зөрчлөөр автоматаар зогсоосон',
};

export const DEFAULT_HAZARDS: WorkHeightHazard[] = [
  { hazard_type: 'fall', description: 'Өндрөөс унах', likelihood: 3, consequence: 5, control_measure: 'Хамгаалах бүс, амь шугам, найдвартай бэхэлгээ ашиглах' },
  { hazard_type: 'falling_object', description: 'Дээрээс эд зүйл унах', likelihood: 3, consequence: 4, control_measure: 'Ажлын бүсийг тусгаарлаж, багажийг уналтаас бэхлэх' },
  { hazard_type: 'ladder_scaffold', description: 'Шат, тавцан эвдрэх эсвэл хазайх', likelihood: 2, consequence: 5, control_measure: 'Шат, тавцангийн бүрэн бүтэн байдал ба суурийг шалгах' },
  { hazard_type: 'weather', description: 'Салхи, бороо, мөстөлт', likelihood: 2, consequence: 5, control_measure: 'Цаг агаарын нөхцөл муудвал ажлыг зогсоох' },
  { hazard_type: 'electricity', description: 'Цахилгаанд цохиулах', likelihood: 2, consequence: 5, control_measure: 'Хүчдэлээс тусгаарлах, аюулгүй зай барих' },
];

export const DEFAULT_PPE: PpeCheck[] = [
  { item_key: 'helmet', item_label: 'Бэхэлгээтэй хамгаалалтын каск', required: true, passed: false },
  { item_key: 'harness', item_label: 'Бүтэн биеийн хамгаалах бүс', required: true, passed: false },
  { item_key: 'anchor', item_label: 'Бэхэлгээ ба амь шугам', required: true, passed: false },
  { item_key: 'ladder', item_label: 'Шат / ажлын тавцан', required: true, passed: false },
  { item_key: 'guardrail', item_label: 'Хашлага / уналтаас хамгаалалт', required: true, passed: false },
  { item_key: 'shoes', item_label: 'Хальтиргаагүй хамгаалалтын гутал', required: true, passed: false },
  { item_key: 'tools', item_label: 'Багажны уналтаас хамгаалах бэхэлгээ', required: true, passed: false },
  { item_key: 'rescue', item_label: 'Аврах төлөвлөгөө ба хэрэгсэл', required: true, passed: false },
];

export function riskScore(likelihood: number, consequence: number) {
  const l = Math.max(1, Math.min(5, Number(likelihood) || 1));
  const c = Math.max(1, Math.min(5, Number(consequence) || 1));
  return l * c;
}

export function riskLevel(score: number) {
  if (score >= HIGH_RISK_THRESHOLD) return { key: 'high', label: 'Өндөр', color: '#dc2626' };
  if (score >= 8) return { key: 'medium', label: 'Дунд', color: '#d97706' };
  return { key: 'low', label: 'Бага', color: '#16a34a' };
}

export function maxRiskScore(hazards: WorkHeightHazard[] = []) {
  return hazards.reduce((max, item) => Math.max(max, riskScore(item.likelihood, item.consequence)), 0);
}

export function isPpeComplete(checks: PpeCheck[] = []) {
  return checks.length > 0 && checks.every((item) => !item.required || item.passed);
}

export function approvalBlockReason(assessment: Pick<WorkHeightAssessment, 'hazards' | 'ppe_checks'>) {
  const score = maxRiskScore(assessment.hazards);
  if (score >= HIGH_RISK_THRESHOLD) return `Өндөр эрсдэлтэй (${score}). Хяналтын арга хэмжээг сайжруулна уу.`;
  if (!isPpeComplete(assessment.ppe_checks)) return 'Шаардлагатай хамгаалах хэрэгслийн шалгалт бүрэн биш байна.';
  return null;
}

export function validateAssessment(input: WorkHeightAssessment) {
  const errors: string[] = [];
  if (!input.employee_id || !input.employee_name.trim()) errors.push('Ажилтны мэдээлэл дутуу.');
  if (!input.location_name.trim()) errors.push('Байршил сонгоно уу.');
  if (!(Number(input.height_m) > 0)) errors.push('Ажиллах өндрийг зөв оруулна уу.');
  if (!input.work_type.trim()) errors.push('Ажлын төрлийг оруулна уу.');
  if (!input.weather.trim()) errors.push('Цаг агаарын нөхцөлийг оруулна уу.');
  if (!input.starts_at || !input.ends_at || new Date(input.ends_at) <= new Date(input.starts_at)) errors.push('Ажлын хугацаа буруу байна.');
  if (!input.hazards.length) errors.push('Дор хаяж нэг аюул үнэлнэ үү.');
  input.hazards.forEach((hazard, index) => {
    if (!hazard.description.trim() || !hazard.control_measure.trim()) errors.push(`${index + 1}-р аюулын тайлбар эсвэл хяналтын арга хэмжээ дутуу.`);
  });
  return errors;
}

export function splitList(value: string) {
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}
