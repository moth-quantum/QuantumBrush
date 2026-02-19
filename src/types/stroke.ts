export interface StrokeInfo {
  stroke_id: string;
  project_id: string;
  effect_id: string;
  user_input: Record<string, unknown>;
  processing_status: "pending" | "running" | "completed" | "failed" | "canceled";
  has_output: boolean;
}

export interface StrokeStatusResponse {
  stroke_id: string;
  status: string;
}
