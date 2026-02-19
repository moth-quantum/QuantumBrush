export interface ParamSpec {
  type: "int" | "float" | "bool" | "color" | "string";
  min?: number;
  max?: number;
  default: number | boolean | string;
}

export interface Effect {
  name: string;
  id: string;
  author: string;
  version: string;
  description: string;
  dependencies: Record<string, string>;
  user_input: Record<string, ParamSpec>;
  stroke_input: Record<string, string>;
  flags: Record<string, boolean>;
}
