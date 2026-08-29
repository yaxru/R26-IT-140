export interface SingleMove {
  operator_id: string;
  operator_name?: string; // Added for UI
  worker_pin?: string;    // Added for UI
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
  operator_name?: string; // Added for UI
  worker_pin?: string;    // Added for UI
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
  line_id?: string; // Added to support your line-grouping in the sidebar
}

export interface SkillMatrixEntry {
  operator_id: string;
  operator_name?: string; // Added for UI
  worker_pin?: string;    // Added for UI
  machine_type: string;
  proficiency_grade: string;
  efficiency_pct: number;
}

export interface FlaggedOperator {
  operator_id: string;
  current_station: string | null;
  flag_reason: string;
}

export interface JobCardSubmitResponse {
  entry: {
    status: string;
    efficiency: number;
    downtime_reason?: string | null;
  };
  prediction: {
    predicted_output: number;
    efficiency_class: string;
    batch_completion_time?: number | null;
  };
  risk: {
    risk_level: string;
    risk_score: number;
    is_outlier: boolean;
  };
  flagged_now: boolean;
  submission_count: number;
}

export interface RiskNotification {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}