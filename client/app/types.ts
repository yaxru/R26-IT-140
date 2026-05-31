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
