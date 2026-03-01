import { describe, it, expect } from "bun:test";
import { layoutDiagram } from "../../src/core/layout.js";
import type { NodeSpec, EdgeSpec } from "../../src/types/index.js";

describe("layoutDiagram", () => {
  const twoNodes: NodeSpec[] = [
    { text: "A", type: "rectangle" },
    { text: "B", type: "rectangle" },
  ];

  describe("vertical-flow", () => {
    it("should produce correct top-to-bottom ordering", () => {
      const result = layoutDiagram(twoNodes, [], { type: "vertical-flow" });
      const shapes = result.elements.filter((e) => e.type === "rectangle");
      expect(shapes).toHaveLength(2);
      // First node should be above second node (lower y)
      expect(shapes[0].y).toBeLessThan(shapes[1].y);
    });
  });

  describe("horizontal-flow", () => {
    it("should produce correct left-to-right ordering", () => {
      const result = layoutDiagram(twoNodes, [], { type: "horizontal-flow" });
      const shapes = result.elements.filter((e) => e.type === "rectangle");
      expect(shapes).toHaveLength(2);
      // First node should be to the left of second node (lower x)
      expect(shapes[0].x).toBeLessThan(shapes[1].x);
    });
  });

  describe("edge validation", () => {
    it("should produce arrows for valid edges", () => {
      const edges: EdgeSpec[] = [{ from: "A", to: "B" }];
      const result = layoutDiagram(twoNodes, edges);
      const arrows = result.elements.filter((e) => e.type === "arrow");
      expect(arrows).toHaveLength(1);
    });

    it("should throw when source is not found", () => {
      const edges: EdgeSpec[] = [{ from: "Unknown", to: "B" }];
      expect(() => layoutDiagram(twoNodes, edges)).toThrow('source "Unknown" not found');
    });

    it("should throw when target is not found", () => {
      const edges: EdgeSpec[] = [{ from: "A", to: "Unknown" }];
      expect(() => layoutDiagram(twoNodes, edges)).toThrow('target "Unknown" not found');
    });

    it("should collect multiple bad edges in single error with Available nodes list", () => {
      const edges: EdgeSpec[] = [
        { from: "X", to: "B" },
        { from: "A", to: "Y" },
      ];
      expect(() => layoutDiagram(twoNodes, edges)).toThrow("Available nodes:");
    });
  });

  describe("dynamic grid sizing", () => {
    it("should adapt grid cell width to widest node", () => {
      const nodes: NodeSpec[] = [
        { text: "Short", type: "rectangle" },
        { text: "A much longer label text", type: "rectangle" },
        { text: "Med", type: "rectangle" },
        { text: "X", type: "rectangle" },
      ];
      const result = layoutDiagram(nodes, [], { type: "grid", columns: 2 });
      const shapes = result.elements.filter((e) => e.type === "rectangle");

      // Column 0 nodes (index 0, 2) and column 1 nodes (index 1, 3)
      // should have consistent x spacing based on the widest node
      const col0x = shapes[0].x;
      const col1x = shapes[1].x;
      expect(col1x).toBeGreaterThan(col0x);

      // Both col-0 elements should share the same x
      expect(shapes[2].x).toBe(col0x);
      // Both col-1 elements should share the same x
      expect(shapes[3].x).toBe(col1x);
    });

    it("should use consistent y values per row with increasing y between rows", () => {
      const nodes: NodeSpec[] = [
        { text: "A", type: "rectangle" },
        { text: "B", type: "rectangle" },
        { text: "C", type: "rectangle" },
        { text: "D", type: "rectangle" },
      ];
      const result = layoutDiagram(nodes, [], { type: "grid", columns: 2 });
      const shapes = result.elements.filter((e) => e.type === "rectangle");

      // Row 0: shapes[0], shapes[1] should share same y
      expect(shapes[0].y).toBe(shapes[1].y);
      // Row 1: shapes[2], shapes[3] should share same y
      expect(shapes[2].y).toBe(shapes[3].y);
      // Row 1 y should be greater than row 0 y
      expect(shapes[2].y).toBeGreaterThan(shapes[0].y);
    });

    it("should respect custom column count", () => {
      const nodes: NodeSpec[] = [
        { text: "A", type: "rectangle" },
        { text: "B", type: "rectangle" },
        { text: "C", type: "rectangle" },
      ];
      const result = layoutDiagram(nodes, [], { type: "grid", columns: 3 });
      const shapes = result.elements.filter((e) => e.type === "rectangle");

      // All 3 in one row – same y
      expect(shapes[0].y).toBe(shapes[1].y);
      expect(shapes[1].y).toBe(shapes[2].y);
    });
  });

  describe("nodeIdMap", () => {
    it("should contain both text and index keys mapping to same ID", () => {
      const result = layoutDiagram(twoNodes, []);

      expect(result.nodeIdMap.get("0")).toBeDefined();
      expect(result.nodeIdMap.get("A")).toBeDefined();
      expect(result.nodeIdMap.get("0")).toBe(result.nodeIdMap.get("A"));

      expect(result.nodeIdMap.get("1")).toBeDefined();
      expect(result.nodeIdMap.get("B")).toBeDefined();
      expect(result.nodeIdMap.get("1")).toBe(result.nodeIdMap.get("B"));
    });
  });

  describe("index-based edges", () => {
    it("should resolve edges using string indices", () => {
      const edges: EdgeSpec[] = [{ from: "0", to: "1" }];
      const result = layoutDiagram(twoNodes, edges);
      const arrows = result.elements.filter((e) => e.type === "arrow");
      expect(arrows).toHaveLength(1);
      expect(arrows[0].startBinding?.elementId).toBe(result.nodeIdMap.get("0"));
      expect(arrows[0].endBinding?.elementId).toBe(result.nodeIdMap.get("1"));
    });
  });

  describe("edge labels", () => {
    it("should produce label text elements for labeled edges", () => {
      const edges: EdgeSpec[] = [{ from: "A", to: "B", label: "connects" }];
      const result = layoutDiagram(twoNodes, edges);
      const texts = result.elements.filter(
        (e) => e.type === "text" && e.text === "connects",
      );
      expect(texts).toHaveLength(1);
    });
  });
});
