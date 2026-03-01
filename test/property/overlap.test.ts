import { describe, it, expect } from "bun:test";
import * as fc from "fast-check";
import {
  segmentIntersectsAABB,
  findStandaloneTexts,
  extractSegments,
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
  containerId: string | null = null,
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
    isDeleted: false,
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
    containerId,
    autoResize: true,
    lineHeight: 1.25,
  } as ExcalidrawElement;
}

function makeLine(
  id: string,
  x: number,
  y: number,
  points: [number, number][],
): ExcalidrawElement {
  return {
    id,
    type: "line",
    x,
    y,
    width: 100,
    height: 100,
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
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    link: null,
    locked: false,
    roundness: null,
    points,
    startArrowhead: null,
    endArrowhead: null,
    lastCommittedPoint: null,
  } as ExcalidrawElement;
}

// === Property-based tests ===

describe("property-based overlap tests", () => {
  it("Liang–Barsky agrees with brute-force point sampling", () => {
    fc.assert(
      fc.property(
        // Random segment
        fc.record({
          x1: fc.float({ min: -100, max: 100, noNaN: true }),
          y1: fc.float({ min: -100, max: 100, noNaN: true }),
          x2: fc.float({ min: -100, max: 100, noNaN: true }),
          y2: fc.float({ min: -100, max: 100, noNaN: true }),
        }),
        // Random box
        fc.record({
          x: fc.float({ min: -50, max: 50, noNaN: true }),
          y: fc.float({ min: -50, max: 50, noNaN: true }),
          width: fc.float({ min: 1, max: 50, noNaN: true }),
          height: fc.float({ min: 1, max: 50, noNaN: true }),
        }),
        (seg, box) => {
          const liangBarsky = segmentIntersectsAABB(seg, box);

          // Brute-force: sample many points along the segment
          const SAMPLES = 200;
          let bruteForceHit = false;
          for (let i = 0; i <= SAMPLES; i++) {
            const t = i / SAMPLES;
            const px = seg.x1 + t * (seg.x2 - seg.x1);
            const py = seg.y1 + t * (seg.y2 - seg.y1);
            if (
              px >= box.x &&
              px <= box.x + box.width &&
              py >= box.y &&
              py <= box.y + box.height
            ) {
              bruteForceHit = true;
              break;
            }
          }

          // If brute force finds a hit, Liang-Barsky must too.
          // (Brute force may miss edge cases, so we only check one direction.)
          if (bruteForceHit) {
            expect(liangBarsky).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("resolveOverlaps is idempotent (running twice = running once)", () => {
    fc.assert(
      fc.property(
        fc.record({
          textX: fc.float({ min: 0, max: 200, noNaN: true }),
          textY: fc.float({ min: 0, max: 200, noNaN: true }),
          lineEndX: fc.float({ min: 50, max: 300, noNaN: true }),
          lineEndY: fc.float({ min: -100, max: 100, noNaN: true }),
        }),
        ({ textX, textY, lineEndX, lineEndY }) => {
          const elements: ExcalidrawElement[] = [
            makeText("t1", textX, textY, 50, 20),
            makeLine("l1", 0, 100, [
              [0, 0],
              [lineEndX, lineEndY],
            ]),
          ];

          const once = resolveOverlaps(elements);
          const twice = resolveOverlaps(once);

          const t1Once = once.find((e) => e.id === "t1")!;
          const t1Twice = twice.find((e) => e.id === "t1")!;
          expect(t1Twice.x).toBeCloseTo(t1Once.x, 5);
          expect(t1Twice.y).toBeCloseTo(t1Once.y, 5);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("bound text is never moved", () => {
    fc.assert(
      fc.property(
        fc.record({
          textX: fc.float({ min: 0, max: 200, noNaN: true }),
          textY: fc.float({ min: 0, max: 200, noNaN: true }),
        }),
        ({ textX, textY }) => {
          const elements: ExcalidrawElement[] = [
            makeText("bound", textX, textY, 50, 20, "container1"),
            makeLine("l1", 0, textY, [
              [0, 0],
              [300, 0],
            ]),
          ];

          const result = resolveOverlaps(elements);
          const boundText = result.find((e) => e.id === "bound")!;
          expect(boundText.x).toBe(textX);
          expect(boundText.y).toBe(textY);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("element count is preserved", () => {
    fc.assert(
      fc.property(
        fc.record({
          textCount: fc.integer({ min: 1, max: 5 }),
          lineCount: fc.integer({ min: 1, max: 3 }),
        }),
        ({ textCount, lineCount }) => {
          const elements: ExcalidrawElement[] = [];
          for (let i = 0; i < textCount; i++) {
            elements.push(makeText(`t${i}`, i * 30, 95, 25, 15));
          }
          for (let i = 0; i < lineCount; i++) {
            elements.push(
              makeLine(`l${i}`, 0, 100 + i * 10, [
                [0, 0],
                [200, 0],
              ]),
            );
          }

          const result = resolveOverlaps(elements);
          expect(result).toHaveLength(elements.length);
        },
      ),
      { numRuns: 50 },
    );
  });
});
