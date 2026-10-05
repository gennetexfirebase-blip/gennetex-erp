export type WorkHeightStatus =
  | 'draft'
  | 'pending_review'
  | 'changes_required'
  | 'hse_approved'
  | 'management_approved'
  | 'in_progress'
  | 'completed'
  | 'stopped';

export type IncidentType = 'unsafe_condition' | 'near_miss' | 'accident';
export type IncidentSeverity = 'low' | 'medium' | 'serious' | 'critical';

export interface WorkHeightHazard {
  id?: string;
  hazard_type: string;
  description: string;
  likelihood: number;
  consequence: number;
  risk_score?: number;
  control_measure: string;
  residual_likelihood?: number | null;
  residual_consequence?: number | null;
  residual_score?: number | null;
  sort_order?: number;
}

export interface PpeCheck {
  id?: string;
  item_key: string;
  item_label: string;
  required: boolean;
  passed: boolean;
  note?: string;
}

export interface WorkHeightEvidence {
  id?: string;
  assessment_id?: string | null;
  incident_id?: string | null;
  evidence_type: 'ppe' | 'site' | 'incident' | 'resolution';
  storage_path?: string;
  signed_url?: string;
  local_uri?: string;
  caption?: string;
  mime_type?: string;
}

export interface WorkHeightAssessment {
  id?: string;
  employee_id: string;
  employee_name: string;
  employee_code?: string | null;
  department_id?: string | null;
  location_id?: string | null;
  location_name: string;
  latitude?: number | null;
  longitude?: number | null;
  height_m: number;
  work_type: string;
  starts_at: string;
  ends_at: string;
  weather: string;
  partner_ids: string[];
  partner_names: string[];
  equipment: string[];
  notes?: string | null;
  status: WorkHeightStatus;
  max_risk_score?: number;
  ppe_complete?: boolean;
  hazards: WorkHeightHazard[];
  ppe_checks: PpeCheck[];
  evidence?: WorkHeightEvidence[];
  audit?: WorkHeightAudit[];
  approvals?: WorkHeightApproval[];
  created_at?: string;
  updated_at?: string;
  offline_id?: string;
}

export interface WorkHeightIncident {
  id?: string;
  assessment_id?: string | null;
  reporter_id?: string;
  reporter_name?: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  location_name: string;
  latitude?: number | null;
  longitude?: number | null;
  occurred_at: string;
  status?: 'open' | 'investigating' | 'resolved' | 'closed';
  resolution?: string | null;
  evidence?: WorkHeightEvidence[];
  created_at?: string;
}

export interface WorkHeightAudit {
  id: string;
  actor_name: string;
  action: string;
  from_status?: WorkHeightStatus | null;
  to_status?: WorkHeightStatus | null;
  note?: string | null;
  created_at: string;
}

export interface WorkHeightApproval {
  id: string;
  stage: 'hse' | 'management';
  decision: 'approved' | 'changes_required' | 'stopped';
  approver_name: string;
  note?: string | null;
  created_at: string;
}

export interface WorkHeightFilters {
  from?: string;
  to?: string;
  employeeId?: string;
  locationId?: string;
  status?: WorkHeightStatus | 'all';
}

