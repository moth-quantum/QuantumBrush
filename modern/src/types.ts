export interface EffectSummary {
  id: string;
  name: string;
  description: string;
  user_input: Record<string, ParamSpec>;
}

export interface ParamSpec {
  type: string;
  min?: number;
  max?: number;
  default?: string | number | boolean;
}

export interface ProjectMeta {
  project_id: string;
  project_name: string;
  modified_time: number;
  status: string;
}

export interface StrokeSummary {
  stroke_id: string;
  effect_id: string;
  effect_name: string;
  processing_status: string;
  effect_success: boolean | null;
  error_message?: string | null;
  input_path: string;
  output_path: string;
}

export interface DrawPath {
  click: { x: number; y: number };
  points: { x: number; y: number }[];
}

export interface AppInfo {
  root: string;
  python: string;
  root_exists: boolean;
}
