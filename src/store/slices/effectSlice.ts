import type { StateCreator } from "zustand";
import type { Effect } from "../../types/effect";

export interface EffectSlice {
  effects: Effect[];
  selectedEffect: Effect | null;
  paramValues: Record<string, unknown>;
  setEffects: (effects: Effect[]) => void;
  setSelectedEffect: (effect: Effect | null) => void;
  setParamValues: (values: Record<string, unknown>) => void;
  setParamValue: (key: string, value: unknown) => void;
  resetParamDefaults: () => void;
}

export const createEffectSlice: StateCreator<EffectSlice> = (set, get) => ({
  effects: [],
  selectedEffect: null,
  paramValues: {},

  setEffects: (effects) => set({ effects }),
  setSelectedEffect: (effect) => {
    if (effect) {
      const defaults: Record<string, unknown> = {};
      for (const [key, spec] of Object.entries(effect.user_input)) {
        defaults[key] = spec.default;
      }
      set({ selectedEffect: effect, paramValues: defaults });
    } else {
      set({ selectedEffect: null, paramValues: {} });
    }
  },
  setParamValues: (values) => set({ paramValues: values }),
  setParamValue: (key, value) =>
    set((state) => ({
      paramValues: { ...state.paramValues, [key]: value },
    })),
  resetParamDefaults: () => {
    const effect = get().selectedEffect;
    if (effect) {
      const defaults: Record<string, unknown> = {};
      for (const [key, spec] of Object.entries(effect.user_input)) {
        defaults[key] = spec.default;
      }
      set({ paramValues: defaults });
    }
  },
});
