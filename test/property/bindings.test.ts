import { describe, it, expect } from "bun:test";
import * as fc from "fast-check";
import {
  validateBindings,
  setupArrowBindings,
  removeElementClean,
  repairBindings,
} from "../../src/core/bindings.js";
import { createRectangle, createArrow } from "../../src/core/elements.js";
import type { ExcalidrawElement } from "../../src/types/index.js";

/**
 * Generate a random diagram with N shapes and M arrows.
 */
function arbitraryDiagram() {
  return fc
    .record({
      nodeCount: fc.integer({ min: 2, max: 10 }),
      edgeCount: fc.integer({ min: 0, max: 5 }),
    })
    .chain(({ nodeCount, edgeCount }) => {
      return fc.record({
        nodeCount: fc.constant(nodeCount),
        edgePairs: fc.array(
          fc.record({
            from: fc.integer({ min: 0, max: nodeCount - 1 }),
            to: fc.integer({ min: 0, max: nodeCount - 1 }),
          }),
          { minLength: 0, maxLength: edgeCount },
        ),
      });
    });
}

function buildDiagram(spec: { nodeCount: number; edgePairs: Array<{ from: number; to: number }> }): ExcalidrawElement[] {
  const shapes: ReturnType<typeof createRectangle>[] = [];

  for (let i = 0; i < spec.nodeCount; i++) {
    shapes.push(createRectangle(i * 200, 0, `Node${i}`));
  }

  let elements: ExcalidrawElement[] = [];
  for (const s of shapes) {
    elements.push(s.shape);
    if (s.text) elements.push(s.text);
  }

  for (const { from, to } of spec.edgePairs) {
    if (from === to) continue; // skip self-loops

    const fromShape = shapes[from].shape;
    const toShape = shapes[to].shape;

    const result = createArrow(
      fromShape.x + fromShape.width / 2,
      fromShape.y + fromShape.height / 2,
      toShape.x + toShape.width / 2,
      toShape.y + toShape.height / 2,
      { fromId: fromShape.id, toId: toShape.id },
    );

    elements.push(result.arrow);
    if (result.label) elements.push(result.label);

    elements = setupArrowBindings(result.arrow.id, fromShape.id, toShape.id, elements);
  }

  return elements;
}

describe("property-based binding tests", () => {
  it("bindings are always valid after construction", () => {
    fc.assert(
      fc.property(arbitraryDiagram(), (spec) => {
        const elements = buildDiagram(spec);
        const violations = validateBindings(elements);
        expect(violations).toHaveLength(0);
      }),
      { numRuns: 50 },
    );
  });

  it("bindings remain valid after removing any element", () => {
    fc.assert(
      fc.property(
        arbitraryDiagram().chain((spec) =>
          fc.record({
            spec: fc.constant(spec),
            removeIndex: fc.integer({ min: 0, max: Math.max(0, spec.nodeCount - 1) }),
          }),
        ),
        ({ spec, removeIndex }) => {
          const elements = buildDiagram(spec);
          // Find shape elements (not text)
          const shapes = elements.filter(
            (e) => e.type === "rectangle" && !e.isDeleted,
          );
          if (shapes.length === 0) return;

          const idx = removeIndex % shapes.length;
          const targetId = shapes[idx].id;
          const after = removeElementClean(targetId, elements);

          const violations = validateBindings(after);
          expect(violations).toHaveLength(0);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("repair always produces valid bindings", () => {
    fc.assert(
      fc.property(arbitraryDiagram(), (spec) => {
        const elements = buildDiagram(spec);

        // Artificially break some bindings
        const broken = elements.map((e) => {
          if (e.type === "arrow" && Math.random() > 0.5) {
            return {
              ...e,
              startBinding: { elementId: "nonexistent", focus: 0, gap: 1, fixedPoint: null },
            };
          }
          return e;
        });

        const repaired = repairBindings(broken);
        const violations = validateBindings(repaired);
        expect(violations).toHaveLength(0);
      }),
      { numRuns: 50 },
    );
  });
});
