import { create } from "zustand";
import { createProjectSlice, type ProjectSlice } from "./slices/projectSlice";
import { createCanvasSlice, type CanvasSlice } from "./slices/canvasSlice";
import { createEffectSlice, type EffectSlice } from "./slices/effectSlice";
import { createStrokeSlice, type StrokeSlice } from "./slices/strokeSlice";

export type AppStore = ProjectSlice & CanvasSlice & EffectSlice & StrokeSlice;

export const useStore = create<AppStore>()((...a) => ({
  ...createProjectSlice(...a),
  ...createCanvasSlice(...a),
  ...createEffectSlice(...a),
  ...createStrokeSlice(...a),
}));
