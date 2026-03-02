export type Tool = 'select' | 'brush' | 'eraser' | 'dot';

export interface EffectParam {
  type: 'int' | 'float' | 'color' | 'bool' | 'str';
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  label?: string;
  description?: string;
}

export interface EffectDefinition {
  name: string;
  id: string;
  author: string;
  version: string;
  description: string;
  long_description?: string;
  dependencies: Record<string, string>;
  user_input: Record<string, EffectParam>;
  stroke_input: Record<string, string>;
  flags: Record<string, boolean>;
}

export interface StrokeRecord {
  id: string;
  effectId: string;
  effectName: string;
  timestamp: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  params: Record<string, unknown>;
  pathData: number[][];
  clickData: number[][];
  error?: string;
  /** Canvas JSON snapshot taken before the effect was applied (for before/after compare) */
  beforeCanvasJson?: string;
  /** The data URL of the effect output image (for re-displaying after compare) */
  resultDataUrl?: string;
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface IpcResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
