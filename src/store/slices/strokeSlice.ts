import type { StateCreator } from "zustand";
import type { StrokeInfo } from "../../types/stroke";

export interface StrokeSlice {
  strokes: StrokeInfo[];
  selectedStroke: StrokeInfo | null;
  setStrokes: (strokes: StrokeInfo[]) => void;
  addStroke: (stroke: StrokeInfo) => void;
  updateStroke: (strokeId: string, updates: Partial<StrokeInfo>) => void;
  removeStroke: (strokeId: string) => void;
  setSelectedStroke: (stroke: StrokeInfo | null) => void;
}

export const createStrokeSlice: StateCreator<StrokeSlice> = (set) => ({
  strokes: [],
  selectedStroke: null,

  setStrokes: (strokes) => set({ strokes }),
  addStroke: (stroke) =>
    set((state) => ({ strokes: [...state.strokes, stroke] })),
  updateStroke: (strokeId, updates) =>
    set((state) => ({
      strokes: state.strokes.map((s) =>
        s.stroke_id === strokeId ? { ...s, ...updates } : s
      ),
      selectedStroke:
        state.selectedStroke?.stroke_id === strokeId
          ? { ...state.selectedStroke, ...updates }
          : state.selectedStroke,
    })),
  removeStroke: (strokeId) =>
    set((state) => ({
      strokes: state.strokes.filter((s) => s.stroke_id !== strokeId),
      selectedStroke:
        state.selectedStroke?.stroke_id === strokeId
          ? null
          : state.selectedStroke,
    })),
  setSelectedStroke: (stroke) => set({ selectedStroke: stroke }),
});
