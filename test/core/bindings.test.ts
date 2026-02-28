import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseFile } from "../../src/core/parser.js";
import {
  validateBindings,
  repairBindings,
  setupArrowBindings,
  removeElementClean,
  setupTextBinding,
} from "../../src/core/bindings.js";
import type { ExcalidrawElement } from "../../src/types/index.js";

const FIXTURES_DIR = resolve(__dirname, "../fixtures");

function loadFixtureElements(): ExcalidrawElement[] {
  const content = readFileSync(
    resolve(FIXTURES_DIR, "simple.excalidraw"),
    "utf-8",
  );
  return parseFile("test.excalidraw", content).document.elements;
}

describe("bindings", () => {
  describe("validateBindings", () => {
    it("should find no violations in a valid diagram", () => {
      const elements = loadFixtureElements();
      const violations = validateBindings(elements);
      expect(violations).toHaveLength(0);
    });

    it("should detect orphaned arrow binding", () => {
      const elements = loadFixtureElements();
      // Remove rect2 but keep arrow pointing to it
      const broken = elements.filter((e) => e.id !== "rect2" && e.id !== "text2");
      const violations = validateBindings(broken);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.message.includes("rect2"))).toBe(true);
    });

    it("should detect missing boundElements back-reference", () => {
      const elements = loadFixtureElements().map((e) => {
        // Remove arrow from rect1's boundElements
        if (e.id === "rect1") {
          return {
            ...e,
            boundElements: e.boundElements?.filter((b) => b.type !== "arrow") ?? null,
          };
        }
        return e;
      });

      const violations = validateBindings(elements);
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe("repairBindings", () => {
    it("should remove orphaned arrow bindings", () => {
      const elements = loadFixtureElements();
      const broken = elements.filter((e) => e.id !== "rect2" && e.id !== "text2");
      const repaired = repairBindings(broken);

      const arrow = repaired.find((e) => e.id === "arrow1")!;
      expect(arrow.endBinding).toBeNull();
    });

    it("should remove orphaned boundElements entries", () => {
      const elements = loadFixtureElements();
      const broken = elements.filter((e) => e.id !== "arrow1");
      const repaired = repairBindings(broken);

      const rect1 = repaired.find((e) => e.id === "rect1")!;
      expect(rect1.boundElements?.some((b) => b.id === "arrow1")).toBeFalsy();
    });
  });

  describe("setupArrowBindings", () => {
    it("should wire up bidirectional arrow bindings", () => {
      const elements = loadFixtureElements();
      // Add a new dummy arrow
      const newArrow: ExcalidrawElement = {
        id: "newArrow",
        type: "arrow",
        x: 0, y: 0, width: 100, height: 100,
        angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent",
        fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
        roughness: 1, opacity: 100, seed: 1, version: 1,
        versionNonce: 1, updated: Date.now(), isDeleted: false,
        groupIds: [], frameId: null, boundElements: null,
        link: null, locked: false, roundness: null,
        points: [[0, 0], [100, 100]],
        startBinding: null, endBinding: null,
        startArrowhead: null, endArrowhead: "arrow",
      };

      const withArrow = [...elements, newArrow];
      const result = setupArrowBindings("newArrow", "rect1", "rect2", withArrow);

      const arrow = result.find((e) => e.id === "newArrow")!;
      expect(arrow.startBinding?.elementId).toBe("rect1");
      expect(arrow.endBinding?.elementId).toBe("rect2");

      const rect1 = result.find((e) => e.id === "rect1")!;
      expect(rect1.boundElements?.some((b) => b.id === "newArrow")).toBe(true);

      const rect2 = result.find((e) => e.id === "rect2")!;
      expect(rect2.boundElements?.some((b) => b.id === "newArrow")).toBe(true);
    });
  });

  describe("removeElementClean", () => {
    it("should remove element and clean up all references", () => {
      const elements = loadFixtureElements();
      const result = removeElementClean("rect1", elements);

      // rect1 and its bound text should be gone
      expect(result.find((e) => e.id === "rect1")).toBeUndefined();
      expect(result.find((e) => e.id === "text1")).toBeUndefined();

      // arrow's startBinding should be cleared
      const arrow = result.find((e) => e.id === "arrow1")!;
      expect(arrow.startBinding).toBeNull();
    });

    it("should clean up boundElements on other shapes", () => {
      const elements = loadFixtureElements();
      const result = removeElementClean("arrow1", elements);

      // rect1 should no longer list arrow1
      const rect1 = result.find((e) => e.id === "rect1")!;
      expect(rect1.boundElements?.some((b) => b.id === "arrow1")).toBeFalsy();
    });
  });
});
