export type Language = "en" | "si" | "ta";

export interface SessionInfo {
  session_id: string;
  worker_id: string;
  worker_name: string;
}

export interface Pss10Answers {
  [itemNumber: string]: number; // 0-4, keys "1".."10"
}

export interface InflatorTrial {
  avg_touch_pressure: number;
  peak_pressure: number;
  time_on_target_ms: number;
  jitter_index: number;
  overshoot_count: number;
}

export interface PredictResult {
  avg_game_pressure: number;
  pressure_gap: number;
  pressure_status: "Increased" | "Stable" | "Decreased";
  model_output: 0 | 1;
  model_confidence: number;
  intervention_recommendation: string;
}

export type StepId =
  | "welcome"
  | "instructions-pss10"
  | "instructions-game1"
  | "instructions-game2"
  | "icebreaker"
  | "pss10"
  | "game1"
  | "game2"
  | "complete";

export const STEP_ORDER: StepId[] = [
  "welcome",
  "instructions-pss10",
  "instructions-game1",
  "instructions-game2",
  "icebreaker",
  "pss10",
  "game1",
  "game2",
  "complete",
];
