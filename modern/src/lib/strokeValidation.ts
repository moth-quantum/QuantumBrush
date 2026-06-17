// Per-brush path count rules (from Python brush assert / README).
const PATH_RULES: Record<string, { exact?: number; message: string }> = {
  clone: {
    exact: 2,
    message:
      "Collage needs exactly 2 strokes: (1) drag to select copy region, (2) click paste position. Clear paths and redraw.",
  },
};

/** Validate path count before create_stroke (e.g. Collage = exactly 2 clicks). */
export function validateStrokePaths(
  effectId: string,
  pathCount: number,
): string | null {
  const rule = PATH_RULES[effectId];
  if (!rule) return null;
  if (rule.exact !== undefined && pathCount !== rule.exact) {
    return rule.message;
  }
  return null;
}
