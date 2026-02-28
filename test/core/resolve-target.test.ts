import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseFile } from "../../src/core/parser.js";
import { resolveTarget } from "../../src/core/resolve-target.js";
import type { ExcalidrawElement } from "../../src/types/index.js";

const FIXTURES_DIR = resolve(__dirname, "../fixtures");

function loadFixtureElements(): ExcalidrawElement[] {
  const content = readFileSync(
    resolve(FIXTURES_DIR, "simple.excalidraw"),
    "utf-8",
  );
  return parseFile("test.excalidraw", content).document.elements;
}

describe("resolveTarget", () => {
  it("should resolve by exact ID", () => {
    const elements = loadFixtureElements();
    const result = resolveTarget("rect1", elements);

    expect(result.element.id).toBe("rect1");
    expect(result.matchType).toBe("id");
  });

  it("should resolve by text content (returns container)", () => {
    const elements = loadFixtureElements();
    const result = resolveTarget("Hello", elements);

    expect(result.element.id).toBe("rect1");
    expect(result.matchType).toBe("text");
  });

  it("should error on no match with available elements", () => {
    const elements = loadFixtureElements();

    expect(() => resolveTarget("Nonexistent", elements)).toThrow(
      /No element found matching "Nonexistent"/,
    );
    expect(() => resolveTarget("Nonexistent", elements)).toThrow(
      /Available elements/,
    );
  });

  it("should error on ambiguous match with disambiguation guidance", () => {
    // Create two elements with the same text
    const elements: ExcalidrawElement[] = [
      {
        id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 50,
        angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent",
        fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
        roughness: 1, opacity: 100, seed: 1, version: 1,
        versionNonce: 1, updated: Date.now(), isDeleted: false,
        groupIds: [], frameId: null,
        boundElements: [{ id: "ta", type: "text" }],
        link: null, locked: false, roundness: null,
      },
      {
        id: "ta", type: "text", x: 0, y: 0, width: 50, height: 20,
        angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent",
        fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
        roughness: 1, opacity: 100, seed: 2, version: 1,
        versionNonce: 2, updated: Date.now(), isDeleted: false,
        groupIds: [], frameId: null, boundElements: null,
        link: null, locked: false, roundness: null,
        text: "Service", containerId: "a",
      },
      {
        id: "b", type: "rectangle", x: 200, y: 0, width: 100, height: 50,
        angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent",
        fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
        roughness: 1, opacity: 100, seed: 3, version: 1,
        versionNonce: 3, updated: Date.now(), isDeleted: false,
        groupIds: [], frameId: null,
        boundElements: [{ id: "tb", type: "text" }],
        link: null, locked: false, roundness: null,
      },
      {
        id: "tb", type: "text", x: 200, y: 0, width: 50, height: 20,
        angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent",
        fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
        roughness: 1, opacity: 100, seed: 4, version: 1,
        versionNonce: 4, updated: Date.now(), isDeleted: false,
        groupIds: [], frameId: null, boundElements: null,
        link: null, locked: false, roundness: null,
        text: "Service", containerId: "b",
      },
    ];

    expect(() => resolveTarget("Service", elements)).toThrow(
      /2 elements match "Service"/,
    );
    expect(() => resolveTarget("Service", elements)).toThrow(/Use an element ID/);
  });
});
