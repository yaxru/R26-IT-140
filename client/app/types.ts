export interface SingleMove {
  operator_id: string;
  from_station: string | null;
  to_station: string;
  proficiency_grade: string;
  cost_of_move: number;
  expected_production_gain: number;
  net_profit: number;
  donor_cascade_risk: boolean;
  donor_risk_detail: string | null;
  donor_replacement_id: string | null;
  donor_replacement_grade: string | null;
}

export interface RecommendResponse {
  recommended: boolean;
  no_move_reason: string | null;
  // Multi-worker plan
  moves: SingleMove[];
  workers_needed: number;
  workers_found: number;
  gap_coverage_pct: number;
  total_net_profit: number;
  cascade_warnings: string[];
  instruction: string;
  // Legacy single-worker fields (first worker in plan)
  operator_id: string;
  from_station: string | null;
  to_station: string;
  proficiency_grade: string;
  cost_of_move: number;
  expected_production_gain: number;
  net_profit: number;
}

export interface Bottleneck {
  station_id: string;
  wip: number;
  required_skill: string;
  is_bottleneck: boolean;
  targeted_productivity: number | null;
  actual_productivity: number | null;
}

export interface SkillMatrixEntry {
  operator_id: string;
  machine_type: string;
  proficiency_grade: string;
  efficiency_pct: number;
}

// ── risk_analyze (Digital Job Card) ─────────────────────────────────────────

export type Shift = "day" | "night";
export type OperatorSkill = "A" | "B" | "C";
export type MachineStatus = "ok" | "maintenance" | "breakdown";
export type DowntimeReason =
  | "Mechanical Failure"
  | "Supply Delay"
  | "Power Outage"
  | "Absenteeism"
  | "Rework / Quality Issue"
  | "Other";

export interface JobCardEntry {
  id: number;
  operator_id: string;
  station_id: string | null;
  output: number;
  smv: number;
  manpower: number;
  working_minutes: number;
  shift: string;
  operator_skill: string;
  machine_status: string;
  downtime_reason: string | null;
  efficiency: number;
  status: "HIGH" | "MEDIUM" | "LOW";
  predicted_output: number | null;
  predicted_efficiency: number | null;
  efficiency_class: string | null;
  batch_completion_time: number | null;
  risk_score: number | null;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | null;
  is_outlier: boolean;
  created_at: string;
}

export interface JobCardPrediction {
  predicted_output: number;
  predicted_efficiency: number;
  efficiency_class: string;
  batch_completion_time: number | null;
}

export interface JobCardRisk {
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  is_outlier: boolean;
}

export interface JobCardSubmitResponse {
  entry: JobCardEntry;
  prediction: JobCardPrediction;
  risk: JobCardRisk;
  flagged: boolean;
  flagged_now: boolean;
  submission_count: number;
  notification: string | null;
}

export interface FlaggedOperator {
  operator_id: string;
  current_station: string | null;
  submission_count: number;
  is_flagged: boolean;
  flagged_at: string | null;
  flag_reason: string | null;
}

export interface RiskNotification {
  id: number;
  operator_id: string | null;
  audience: "operator" | "supervisor";
  type: "FLAG" | "RISK_ALERT";
  message: string;
  is_read: boolean;
  created_at: string;
}
