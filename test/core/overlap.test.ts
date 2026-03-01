import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseFile } from "../../src/core/parser.js";
import {
  segmentIntersectsAABB,
  findStandaloneTexts,
  extractSegments,
  computeNudge,
  detectOverlaps,
  resolveOverlaps,
  OVERLAP_PADDING,
} from "../../src/core/overlap.js";
import type { ExcalidrawElement } from "../../src/types/index.js";

// === Helpers ===

function makeText(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts?: { containerId?: string | null; isDeleted?: boolean },
): ExcalidrawElement {
  return {
    id,
    type: "text",
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    seed: 1,
    version: 1,
    versionNonce: 1,
    updated: 1,
    isDeleted: opts?.isDeleted ?? false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    link: null,
    locked: false,
    roundness: null,
    text: "test",
    originalText: "test",
    fontSize: 20,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    containerId: opts?.containerId ?? null,
    autoResize: true,
    lineHeight: 1.25,
  } as ExcalidrawElement;
}

function makeLine(
  id: string,
  x: number,
  y: number,
  points: [number, number][],
  opts?: { type?: "line" | "arrow"; isDeleted?: boolean },
): ExcalidrawElement {
  const dx = points.reduce((max, p) => Math.max(max, p[0]), 0) -
    points.reduce((min, p) => Math.min(min, p[0]), Infinity);
  const dy = points.reduce((max, p) => Math.max(max, p[1]), 0) -
    points.reduce((min, p) => Math.min(min, p[1]), Infinity);

  return {
    id,
    type: opts?.type ?? "line",
    x,
    y,
    width: Math.abs(dx),
    height: Math.abs(dy),
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    seed: 1,
    version: 1,
    versionNonce: 1,
    updated: 1,
    isDeleted: opts?.isDeleted ?? false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    link: null,
    locked: false,
    roundness: null,
    points,
    startArrowhead: null,
    endArrowhead: opts?.type === "arrow" ? "arrow" : null,
    lastCommittedPoint: null,
  } as ExcalidrawElement;
}

// === Tests ===

describe("segmentIntersectsAABB", () => {
  const box = { x: 10, y: 10, width: 20, height: 20 };

  it("detects horizontal crossing", () => {
    expect(
      segmentIntersectsAABB({ x1: 0, y1: 20, x2: 40, y2: 20 }, box),
    ).toBe(true);
  });

  it("detects diagonal crossing", () => {
    expect(
      segmentIntersectsAABB({ x1: 0, y1: 0, x2: 40, y2: 40 }, box),
    ).toBe(true);
  });

  it("detects vertical segment crossing", () => {
    expect(
      segmentIntersectsAABB({ x1: 20, y1: 0, x2: 20, y2: 40 }, box),
    ).toBe(true);
  });

  it("returns false for miss", () => {
    expect(
      segmentIntersectsAABB({ x1: 0, y1: 0, x2: 5, y2: 5 }, box),
    ).toBe(false);
  });

  it("handles zero-length segment inside box", () => {
    expect(
      segmentIntersectsAABB({ x1: 15, y1: 15, x2: 15, y2: 15 }, box),
    ).toBe(true);
  });

  it("handles zero-length segment outside box", () => {
    expect(
      segmentIntersectsAABB({ x1: 0, y1: 0, x2: 0, y2: 0 }, box),
    ).toBe(false);
  });

  it("detects segment touching box edge", () => {
    // Segment ending exactly at box left edge
    expect(
      segmentIntersectsAABB({ x1: 0, y1: 20, x2: 10, y2: 20 }, box),
    ).toBe(true);
  });

  it("detects segment fully inside box", () => {
    expect(
      segmentIntersectsAABB({ x1: 15, y1: 15, x2: 25, y2: 25 }, box),
    ).toBe(true);
  });
});

describe("findStandaloneTexts", () => {
  it("includes standalone text elements", () => {
    const texts = findStandaloneTexts([
      makeText("t1", 0, 0, 50, 20),
      makeText("t2", 100, 0, 50, 20),
    ]);
    expect(texts).toHaveLength(2);
    expect(texts.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("excludes bound text (containerId set)", () => {
    const texts = findStandaloneTexts([
      makeText("t1", 0, 0, 50, 20),
      makeText("t2", 100, 0, 50, 20, { containerId: "rect1" }),
    ]);
    expect(texts).toHaveLength(1);
    expect(texts[0].id).toBe("t1");
  });

  it("excludes deleted text", () => {
    const texts = findStandaloneTexts([
      makeText("t1", 0, 0, 50, 20, { isDeleted: true }),
      makeText("t2", 100, 0, 50, 20),
    ]);
    expect(texts).toHaveLength(1);
    expect(texts[0].id).toBe("t2");
  });
});

describe("extractSegments", () => {
  it("extracts a single segment from a 2-point line", () => {
    const segments = extractSegments([
      makeLine("l1", 10, 20, [[0, 0], [100, 50]]),
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({ x1: 10, y1: 20, x2: 110, y2: 70 });
  });

  it("extracts multiple segments from a multi-point line", () => {
    const segments = extractSegments([
      makeLine("l1", 0, 0, [[0, 0], [10, 10], [20, 0]]),
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({ x1: 0, y1: 0, x2: 10, y2: 10 });
    expect(segments[1]).toEqual({ x1: 10, y1: 10, x2: 20, y2: 0 });
  });

  it("handles arrows the same as lines", () => {
    const segments = extractSegments([
      makeLine("a1", 5, 5, [[0, 0], [50, 50]], { type: "arrow" }),
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({ x1: 5, y1: 5, x2: 55, y2: 55 });
  });

  it("skips deleted elements", () => {
    const segments = extractSegments([
      makeLine("l1", 0, 0, [[0, 0], [10, 10]], { isDeleted: true }),
    ]);
    expect(segments).toHaveLength(0);
  });

  it("skips elements with fewer than 2 points", () => {
    const el = makeLine("l1", 0, 0, [[0, 0]]);
    const segments = extractSegments([el]);
    expect(segments).toHaveLength(0);
  });
});

describe("computeNudge", () => {
  it("pushes text away from horizontal line", () => {
    // Text overlapping a horizontal line, center above the line
    const box = { x: 40, y: 85, width: 50, height: 20 };
    const seg = { x1: 0, y1: 100, x2: 200, y2: 100 };
    const nudge = computeNudge(box, seg);

    // Text center is above the line, so nudge should push up (negative y)
    expect(nudge.y).toBeLessThan(0);
    expect(Math.abs(nudge.x)).toBeLessThan(0.001);
  });

  it("pushes text away from diagonal line", () => {
    // Text near a 45-degree diagonal
    const box = { x: 45, y: 45, width: 20, height: 10 };
    const seg = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const nudge = computeNudge(box, seg);

    // Should have non-zero displacement
    expect(Math.abs(nudge.x) + Math.abs(nudge.y)).toBeGreaterThan(0);
  });

  it("returns zero nudge for already-clear text", () => {
    const box = { x: 0, y: 0, width: 20, height: 10 };
    const seg = { x1: 0, y1: 100, x2: 200, y2: 100 };
    const nudge = computeNudge(box, seg);

    expect(nudge.x).toBe(0);
    expect(nudge.y).toBe(0);
  });

  it("handles degenerate (zero-length) segment", () => {
    const box = { x: 0, y: 0, width: 20, height: 10 };
    const seg = { x1: 10, y1: 5, x2: 10, y2: 5 };
    const nudge = computeNudge(box, seg);

    // Falls back to a default direction
    expect(nudge.y).toBe(OVERLAP_PADDING);
    expect(nudge.x).toBe(0);
  });
});

describe("resolveOverlaps", () => {
  it("returns unchanged elements when there are no overlaps", () => {
    const elements = [
      makeText("t1", 0, 0, 50, 20),
      makeLine("l1", 0, 200, [[0, 0], [100, 0]]),
    ];
    const result = resolveOverlaps(elements);
    expect(result).toHaveLength(2);
    // Text should not have moved
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(0);
  });

  it("nudges overlapping text away from a line", () => {
    // Text placed directly on a horizontal line
    const elements = [
      makeText("t1", 40, 95, 50, 20),
      makeLine("l1", 0, 100, [[0, 0], [200, 0]]),
    ];
    const result = resolveOverlaps(elements);

    const text = result.find((e) => e.id === "t1")!;
    // Text should have been moved (y changed)
    expect(text.y).not.toBe(95);
    // Line should be unchanged
    const line = result.find((e) => e.id === "l1")!;
    expect(line.x).toBe(0);
    expect(line.y).toBe(100);
  });

  it("skips bound text (containerId set)", () => {
    const elements = [
      makeText("t1", 40, 95, 50, 20, { containerId: "rect1" }),
      makeLine("l1", 0, 100, [[0, 0], [200, 0]]),
    ];
    const result = resolveOverlaps(elements);
    const text = result.find((e) => e.id === "t1")!;
    // Bound text should not be moved
    expect(text.x).toBe(40);
    expect(text.y).toBe(95);
  });

  it("handles multiple overlapping lines", () => {
    // Text at intersection of two lines
    const elements = [
      makeText("t1", 45, 45, 20, 10),
      makeLine("l1", 0, 50, [[0, 0], [100, 0]]),
      makeLine("l2", 50, 0, [[0, 0], [0, 100]]),
    ];
    const result = resolveOverlaps(elements);
    const text = result.find((e) => e.id === "t1")!;
    // Text should have moved away from both lines
    expect(text.x !== 45 || text.y !== 45).toBe(true);
  });

  it("converges within max iterations", () => {
    // Multiple overlaps that require iteration
    const elements = [
      makeText("t1", 95, 95, 20, 10),
      makeLine("l1", 0, 100, [[0, 0], [200, 0]]),
      makeLine("l2", 100, 0, [[0, 0], [0, 200]]),
    ];
    // Should not throw or loop forever
    const result = resolveOverlaps(elements);
    expect(result).toHaveLength(3);
  });

  it("preserves element count", () => {
    const elements = [
      makeText("t1", 40, 95, 50, 20),
      makeText("t2", 200, 200, 50, 20),
      makeLine("l1", 0, 100, [[0, 0], [200, 0]]),
    ];
    const result = resolveOverlaps(elements);
    expect(result).toHaveLength(elements.length);
  });

  it("preserves identity of non-overlapping elements", () => {
    const farText = makeText("t2", 500, 500, 50, 20);
    const elements = [
      makeText("t1", 40, 95, 50, 20),
      farText,
      makeLine("l1", 0, 100, [[0, 0], [200, 0]]),
    ];
    const result = resolveOverlaps(elements);

    // Non-overlapping text should be the same object reference
    const resultFarText = result.find((e) => e.id === "t2")!;
    expect(resultFarText).toBe(farText);
  });
});

describe("integration: insurance-tree fixture", () => {
  const EXAMPLES_DIR = resolve(__dirname, "../../examples");

  it("has no overlaps in the resolved fixture", () => {
    const content = readFileSync(
      resolve(EXAMPLES_DIR, "insurance-tree.excalidraw"),
      "utf-8",
    );
    const parsed = parseFile("insurance-tree.excalidraw", content);
    const elements = parsed.document.elements;

    const texts = findStandaloneTexts(elements);
    const segments = extractSegments(elements);
    const overlaps = detectOverlaps(texts, segments);
    expect(overlaps).toHaveLength(0);
  });

  it("resolveOverlaps is a no-op on the clean fixture", () => {
    const content = readFileSync(
      resolve(EXAMPLES_DIR, "insurance-tree.excalidraw"),
      "utf-8",
    );
    const parsed = parseFile("insurance-tree.excalidraw", content);
    const elements = parsed.document.elements;

    const fixed = resolveOverlaps(elements);

    // Every element should be at its original position
    for (const el of fixed) {
      const original = elements.find((e) => e.id === el.id)!;
      expect(el.x).toBe(original.x);
      expect(el.y).toBe(original.y);
    }
  });

  it("detects and resolves overlaps when labels are moved back onto lines", () => {
    const content = readFileSync(
      resolve(EXAMPLES_DIR, "insurance-tree.excalidraw"),
      "utf-8",
    );
    const parsed = parseFile("insurance-tree.excalidraw", content);
    const elements = parsed.document.elements;

    // Artificially move a standalone text label onto the horizontal line
    // The horizontal line goes from (120, 480) to (680, 480)
    const tampered = elements.map((e) => {
      if (e.id === "my0lnoDz") {
        // "1.98%" – place it right on the horizontal line
        return { ...e, x: 340, y: 458 };
      }
      return e;
    });

    const texts = findStandaloneTexts(tampered);
    const segments = extractSegments(tampered);
    const overlapsBefore = detectOverlaps(texts, segments);
    expect(overlapsBefore.length).toBeGreaterThan(0);

    const fixed = resolveOverlaps(tampered);
    const textsAfter = findStandaloneTexts(fixed);
    const segmentsAfter = extractSegments(fixed);
    const overlapsAfter = detectOverlaps(textsAfter, segmentsAfter);
    expect(overlapsAfter).toHaveLength(0);
  });
});
