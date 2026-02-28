import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseFile } from "../../src/core/parser.js";
import { toGraphSummary } from "../../src/core/graph.js";

const FIXTURES_DIR = resolve(__dirname, "../fixtures");

describe("graph", () => {
  describe("toGraphSummary", () => {
    it("should convert elements to a GraphSummary", () => {
      const content = readFileSync(
        resolve(FIXTURES_DIR, "simple.excalidraw"),
        "utf-8",
      );
      const parsed = parseFile("test.excalidraw", content);
      const summary = toGraphSummary(parsed.document.elements, "excalidraw");

      expect(summary.nodes).toHaveLength(2);
      expect(summary.edges).toHaveLength(1);
      expect(summary.other).toHaveLength(0);
    });

    it("should merge bound text into node text", () => {
      const content = readFileSync(
        resolve(FIXTURES_DIR, "simple.excalidraw"),
        "utf-8",
      );
      const parsed = parseFile("test.excalidraw", content);
      const summary = toGraphSummary(parsed.document.elements, "excalidraw");

      const helloNode = summary.nodes.find((n) => n.text === "Hello");
      expect(helloNode).toBeDefined();
      expect(helloNode!.type).toBe("rectangle");
    });

    it("should map arrows to edges with from/to", () => {
      const content = readFileSync(
        resolve(FIXTURES_DIR, "simple.excalidraw"),
        "utf-8",
      );
      const parsed = parseFile("test.excalidraw", content);
      const summary = toGraphSummary(parsed.document.elements, "excalidraw");

      const edge = summary.edges[0];
      expect(edge.from).toBe("rect1");
      expect(edge.to).toBe("rect2");
    });

    it("should compute bounding box", () => {
      const content = readFileSync(
        resolve(FIXTURES_DIR, "simple.excalidraw"),
        "utf-8",
      );
      const parsed = parseFile("test.excalidraw", content);
      const summary = toGraphSummary(parsed.document.elements, "excalidraw");

      expect(summary.metadata.boundingBox.x).toBe(100);
      expect(summary.metadata.boundingBox.y).toBe(100);
      expect(summary.metadata.boundingBox.width).toBeGreaterThan(0);
      expect(summary.metadata.boundingBox.height).toBeGreaterThan(0);
    });

    it("should include metadata", () => {
      const content = readFileSync(
        resolve(FIXTURES_DIR, "simple.excalidraw"),
        "utf-8",
      );
      const parsed = parseFile("test.excalidraw", content);
      const summary = toGraphSummary(parsed.document.elements, "excalidraw");

      expect(summary.metadata.format).toBe("excalidraw");
      expect(summary.metadata.elementCount).toBe(5);
    });

    it("should report freehand drawings in other", () => {
      const elements = [
        {
          id: "fd1",
          type: "freedraw" as const,
          x: 0, y: 0, width: 50, height: 50,
          angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent",
          fillStyle: "solid" as const, strokeWidth: 2, strokeStyle: "solid" as const,
          roughness: 1, opacity: 100, seed: 1, version: 1,
          versionNonce: 1, updated: Date.now(), isDeleted: false,
          groupIds: [], frameId: null, boundElements: null,
          link: null, locked: false, roundness: null,
        },
      ];

      const summary = toGraphSummary(elements, "excalidraw");
      expect(summary.other).toHaveLength(1);
      expect(summary.other[0].type).toBe("freedraw");
      expect(summary.other[0].description).toBe("freehand drawing");
    });
  });
});
