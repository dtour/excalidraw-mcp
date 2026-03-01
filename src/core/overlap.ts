import type { ExcalidrawElement } from "../types/index.js";
import { generateVersionNonce } from "./ids.js";

// === Constants ===

/** Minimum clearance in pixels between text and line segments */
export const OVERLAP_PADDING = 8;

/** Maximum nudge iterations to prevent oscillation */
export const MAX_NUDGE_ITERATIONS = 3;

/** Element types that produce line segments */
const SEGMENT_TYPES = new Set(["line", "arrow"]);

// === Types ===

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

// === Geometry ===

/**
 * Liang–Barsky line-segment vs axis-aligned bounding box intersection test.
 * Returns true if any part of the segment lies inside or crosses the box.
 */
export function segmentIntersectsAABB(seg: Segment, box: AABB): boolean {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;

  // Degenerate segment (zero length) – test point containment
  if (dx === 0 && dy === 0) {
    return (
      seg.x1 >= box.x &&
      seg.x1 <= box.x + box.width &&
      seg.y1 >= box.y &&
      seg.y1 <= box.y + box.height
    );
  }

  let tMin = 0;
  let tMax = 1;

  const p = [-dx, dx, -dy, dy];
  const q = [
    seg.x1 - box.x,
    box.x + box.width - seg.x1,
    seg.y1 - box.y,
    box.y + box.height - seg.y1,
  ];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      // Parallel to this edge – check if outside
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        tMin = Math.max(tMin, t);
      } else {
        tMax = Math.min(tMax, t);
      }
      if (tMin > tMax) return false;
    }
  }

  return true;
}

// === Element Extraction ===

/**
 * Filter text elements that are standalone (not bound to a container).
 * Excludes deleted elements.
 */
export function findStandaloneTexts(
  elements: readonly ExcalidrawElement[],
): ExcalidrawElement[] {
  return elements.filter(
    (e) =>
      e.type === "text" &&
      !e.isDeleted &&
      (e.containerId === null || e.containerId === undefined),
  );
}

/**
 * Convert line/arrow elements' relative `points` arrays into
 * absolute-coordinate segments.
 */
export function extractSegments(
  elements: readonly ExcalidrawElement[],
): Segment[] {
  const segments: Segment[] = [];

  for (const el of elements) {
    if (el.isDeleted) continue;
    if (!SEGMENT_TYPES.has(el.type)) continue;
    if (!el.points || el.points.length < 2) continue;

    for (let i = 0; i < el.points.length - 1; i++) {
      segments.push({
        x1: el.x + el.points[i][0],
        y1: el.y + el.points[i][1],
        x2: el.x + el.points[i + 1][0],
        y2: el.y + el.points[i + 1][1],
      });
    }
  }

  return segments;
}

/** Extract the axis-aligned bounding box from an element's position and size. */
export function elementToAABB(el: ExcalidrawElement): AABB {
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}

// === Overlap Detection ===

export interface Overlap {
  textId: string;
  segment: Segment;
}

/**
 * Detect all (textId, segment) pairs where a standalone text's bounding box
 * intersects a line/arrow segment.
 */
export function detectOverlaps(
  texts: readonly ExcalidrawElement[],
  segments: readonly Segment[],
): Overlap[] {
  const overlaps: Overlap[] = [];

  for (const text of texts) {
    const box = elementToAABB(text);

    for (const seg of segments) {
      if (segmentIntersectsAABB(seg, box)) {
        overlaps.push({ textId: text.id, segment: seg });
      }
    }
  }

  return overlaps;
}

// === Nudge Computation ===

/**
 * Compute the perpendicular displacement vector to clear a text box off a
 * line segment.
 *
 * 1. Compute line normal n = normalize(-dy, dx)
 * 2. Orient n toward text center (flip if signed distance is negative)
 * 3. Project all 4 bbox corners onto n; find the minimum projection
 * 4. Required shift = padding - minProj (along n). If <= 0, no nudge needed
 */
export function computeNudge(
  textBox: AABB,
  segment: Segment,
  padding: number = OVERLAP_PADDING,
): Vec2 {
  const sdx = segment.x2 - segment.x1;
  const sdy = segment.y2 - segment.y1;
  const len = Math.sqrt(sdx * sdx + sdy * sdy);

  // Degenerate segment – can't compute a meaningful normal
  if (len < 1e-9) {
    return { x: 0, y: padding };
  }

  // Line normal (perpendicular)
  let nx = -sdy / len;
  let ny = sdx / len;

  // Text center
  const cx = textBox.x + textBox.width / 2;
  const cy = textBox.y + textBox.height / 2;

  // Signed distance from a point on the segment to the text center, along n
  const signedDist = (cx - segment.x1) * nx + (cy - segment.y1) * ny;
  if (signedDist < 0) {
    nx = -nx;
    ny = -ny;
  }

  // Project all 4 bbox corners onto n, relative to the line
  const corners = [
    { x: textBox.x, y: textBox.y },
    { x: textBox.x + textBox.width, y: textBox.y },
    { x: textBox.x, y: textBox.y + textBox.height },
    { x: textBox.x + textBox.width, y: textBox.y + textBox.height },
  ];

  let minProj = Infinity;
  for (const c of corners) {
    const proj = (c.x - segment.x1) * nx + (c.y - segment.y1) * ny;
    if (proj < minProj) minProj = proj;
  }

  const shift = padding - minProj;
  if (shift <= 0) return { x: 0, y: 0 };

  return { x: nx * shift, y: ny * shift };
}

// === Orchestrator ===

/**
 * Detect and resolve text-line overlaps by nudging standalone text elements
 * away from line/arrow segments.
 *
 * - Runs up to MAX_NUDGE_ITERATIONS rounds
 * - Only moves standalone text (containerId == null); bound text is never moved
 * - Returns a new array (immutable transform)
 */
export function resolveOverlaps(
  elements: readonly ExcalidrawElement[],
  padding: number = OVERLAP_PADDING,
): ExcalidrawElement[] {
  let result = elements.slice();

  // Segments are invariant – only text positions change across iterations
  const segments = extractSegments(result);

  for (let iter = 0; iter < MAX_NUDGE_ITERATIONS; iter++) {
    const texts = findStandaloneTexts(result);
    const overlaps = detectOverlaps(texts, segments);

    if (overlaps.length === 0) break;

    // Accumulate nudge vectors per text element
    const nudges = new Map<string, Vec2>();
    const textById = new Map(texts.map((t) => [t.id, t]));

    for (const { textId, segment } of overlaps) {
      const text = textById.get(textId)!;
      const nudge = computeNudge(elementToAABB(text), segment, padding);

      const existing = nudges.get(textId);
      if (existing) {
        nudges.set(textId, {
          x: existing.x + nudge.x,
          y: existing.y + nudge.y,
        });
      } else {
        nudges.set(textId, nudge);
      }
    }

    // Apply nudges immutably
    result = result.map((e) => {
      const nudge = nudges.get(e.id);
      if (!nudge || (nudge.x === 0 && nudge.y === 0)) return e;

      return {
        ...e,
        x: e.x + nudge.x,
        y: e.y + nudge.y,
        version: e.version + 1,
        versionNonce: generateVersionNonce(),
        updated: Date.now(),
      };
    });
  }

  return result;
}
