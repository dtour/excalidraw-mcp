import { describe, it, expect } from "bun:test";
import {
  nodeStyleSchema,
  renderDiagramInputSchema,
  modifyDiagramInputSchema,
  createDiagramInputSchema,
  createHighLevelSchema,
  nodeSpecSchema,
  layoutSchema,
} from "../../src/schemas/spec.js";

describe("schema validation", () => {
  describe("nodeStyleSchema", () => {
    it("should accept a valid style object", () => {
      const result = nodeStyleSchema.safeParse({
        strokeColor: "#ff0000",
        backgroundColor: "#00ff00",
        fillStyle: "solid",
        strokeWidth: 2,
        opacity: 50,
        fontSize: 16,
        fontFamily: 1,
      });
      expect(result.success).toBe(true);
    });

    it("should reject opacity below 0", () => {
      const result = nodeStyleSchema.safeParse({ opacity: -1 });
      expect(result.success).toBe(false);
    });

    it("should reject opacity above 100", () => {
      const result = nodeStyleSchema.safeParse({ opacity: 101 });
      expect(result.success).toBe(false);
    });

    it("should accept opacity boundary value 0", () => {
      const result = nodeStyleSchema.safeParse({ opacity: 0 });
      expect(result.success).toBe(true);
    });

    it("should accept opacity boundary value 100", () => {
      const result = nodeStyleSchema.safeParse({ opacity: 100 });
      expect(result.success).toBe(true);
    });

    it("should reject invalid fillStyle", () => {
      const result = nodeStyleSchema.safeParse({ fillStyle: "zigzag" });
      expect(result.success).toBe(false);
    });

    it("should accept all 4 valid fillStyle values", () => {
      for (const style of ["solid", "hachure", "cross-hatch", "dots"]) {
        const result = nodeStyleSchema.safeParse({ fillStyle: style });
        expect(result.success).toBe(true);
      }
    });

    it("should reject fontFamily out of range", () => {
      expect(nodeStyleSchema.safeParse({ fontFamily: 0 }).success).toBe(false);
      expect(nodeStyleSchema.safeParse({ fontFamily: 6 }).success).toBe(false);
    });

    it("should accept fontFamily values 1 through 5", () => {
      for (const f of [1, 2, 3, 4, 5]) {
        const result = nodeStyleSchema.safeParse({ fontFamily: f });
        expect(result.success).toBe(true);
      }
    });

    it("should reject unknown properties (strict mode)", () => {
      const result = nodeStyleSchema.safeParse({ unknownProp: "value" });
      expect(result.success).toBe(false);
    });

    it("should accept an empty object (all fields optional)", () => {
      const result = nodeStyleSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("renderDiagramInputSchema", () => {
    it("should reject scale below 0.1", () => {
      const result = renderDiagramInputSchema.safeParse({
        path: "test.excalidraw",
        scale: 0.05,
      });
      expect(result.success).toBe(false);
    });

    it("should reject scale above 4", () => {
      const result = renderDiagramInputSchema.safeParse({
        path: "test.excalidraw",
        scale: 5,
      });
      expect(result.success).toBe(false);
    });

    it("should accept scale boundary value 0.1", () => {
      const result = renderDiagramInputSchema.safeParse({
        path: "test.excalidraw",
        scale: 0.1,
      });
      expect(result.success).toBe(true);
    });

    it("should accept scale boundary value 4", () => {
      const result = renderDiagramInputSchema.safeParse({
        path: "test.excalidraw",
        scale: 4,
      });
      expect(result.success).toBe(true);
    });

    it("should default format to svg and scale to 1", () => {
      const result = renderDiagramInputSchema.parse({
        path: "test.excalidraw",
      });
      expect(result.format).toBe("svg");
      expect(result.scale).toBe(1);
    });

    it("should reject invalid format", () => {
      const result = renderDiagramInputSchema.safeParse({
        path: "test.excalidraw",
        format: "gif",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("modifyDiagramInputSchema", () => {
    it("should reject empty operations array", () => {
      const result = modifyDiagramInputSchema.safeParse({
        path: "test.excalidraw",
        operations: [],
      });
      expect(result.success).toBe(false);
    });

    it("should accept a valid single operation", () => {
      const result = modifyDiagramInputSchema.safeParse({
        path: "test.excalidraw",
        operations: [
          { type: "change_text", target: "Hello", text: "World" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should reject unknown operation type", () => {
      const result = modifyDiagramInputSchema.safeParse({
        path: "test.excalidraw",
        operations: [
          { type: "explode", target: "Hello" },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createDiagramInputSchema", () => {
    it("should reject empty nodes array", () => {
      const result = createDiagramInputSchema.safeParse({
        path: "test.excalidraw",
        spec: { nodes: [] },
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid high-level and low-level specs", () => {
      const highLevel = createDiagramInputSchema.safeParse({
        path: "test.excalidraw",
        spec: {
          nodes: [{ text: "A" }],
          edges: [{ from: "A", to: "A" }],
        },
      });
      expect(highLevel.success).toBe(true);

      const lowLevel = createDiagramInputSchema.safeParse({
        path: "test.excalidraw",
        spec: {
          elements: [{ type: "rectangle", x: 0, y: 0 }],
        },
      });
      expect(lowLevel.success).toBe(true);
    });
  });

  describe("nodeSpecSchema", () => {
    it("should default type to rectangle", () => {
      const result = nodeSpecSchema.parse({ text: "Hello" });
      expect(result.type).toBe("rectangle");
    });
  });

  describe("layoutSchema", () => {
    it("should default type to vertical-flow and reject invalid type", () => {
      const result = layoutSchema.parse({});
      expect(result.type).toBe("vertical-flow");

      const invalid = layoutSchema.safeParse({ type: "circular" });
      expect(invalid.success).toBe(false);
    });
  });
});
