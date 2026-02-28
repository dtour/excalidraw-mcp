import type { FontFamily } from "../types/index.js";

/**
 * Average character width multipliers per font family, relative to fontSize.
 * These are approximations – Excalidraw re-measures on load, so over-estimating
 * is safe (elements may shrink slightly when opened).
 *
 * Known limitation: proportional fonts vary significantly per character.
 * "illicit" vs "MAMMOTH" can differ by 2-3x in the same font. We over-estimate
 * by ~15% to compensate, accepting that diagrams will reflow slightly on load.
 */
const CHAR_WIDTH_MULTIPLIERS: Record<FontFamily, number> = {
  1: 0.55,  // Excalifont (handwritten)
  2: 0.52,  // Nunito
  3: 0.60,  // Cascadia (monospace)
  4: 0.52,  // Liberation Sans
  5: 1.00,  // CJK – characters are roughly square
};

const LINE_HEIGHT_MULTIPLIERS: Record<FontFamily, number> = {
  1: 1.25,
  2: 1.35,
  3: 1.20,
  4: 1.35,
  5: 1.25,
};

const OVERESTIMATE_FACTOR = 1.15;
const DEFAULT_FONT_SIZE = 20;
const DEFAULT_FONT_FAMILY: FontFamily = 1;

export interface TextMetrics {
  width: number;
  height: number;
}

/**
 * Measure text dimensions using pre-computed font metrics.
 * Over-estimates width by ~15% – Excalidraw re-measures on load.
 */
export function measureText(
  text: string,
  fontSize: number = DEFAULT_FONT_SIZE,
  fontFamily: FontFamily = DEFAULT_FONT_FAMILY,
): TextMetrics {
  const lines = text.split("\n");
  const charWidth = CHAR_WIDTH_MULTIPLIERS[fontFamily] ?? CHAR_WIDTH_MULTIPLIERS[1];
  const lineHeight = (LINE_HEIGHT_MULTIPLIERS[fontFamily] ?? LINE_HEIGHT_MULTIPLIERS[1]) * fontSize;

  const maxLineWidth = Math.max(
    ...lines.map((line) => line.length * charWidth * fontSize * OVERESTIMATE_FACTOR),
  );

  return {
    width: Math.ceil(maxLineWidth),
    height: Math.ceil(lines.length * lineHeight),
  };
}

/**
 * Get the line height multiplier for a font family.
 */
export function getLineHeight(fontFamily: FontFamily = DEFAULT_FONT_FAMILY): number {
  return LINE_HEIGHT_MULTIPLIERS[fontFamily] ?? LINE_HEIGHT_MULTIPLIERS[1];
}

/**
 * Padding added inside containers around bound text.
 */
export const CONTAINER_PADDING = 20;
