import { describe, it, expect } from "bun:test";
import {
  createRectangle,
  createEllipse,
  createDiamond,
  createArrow,
  createStandaloneText,
  updateTextContent,
  resizeContainerForText,
} from "../../src/core/elements.js";

describe("elements", () => {
  describe("createRectangle", () => {
    it("should create a rectangle with bound text", () => {
      const result = createRectangle(100, 200, "Hello");

      expect(result.shape.type).toBe("rectangle");
      expect(result.shape.x).toBe(100);
      expect(result.shape.y).toBe(200);
      expect(result.shape.width).toBeGreaterThan(0);
      expect(result.shape.height).toBeGreaterThan(0);
      expect(result.text).not.toBeNull();
      expect(result.text!.text).toBe("Hello");
      expect(result.text!.containerId).toBe(result.shape.id);
    });

    it("should create a rectangle without text", () => {
      const result = createRectangle(0, 0, "");

      expect(result.shape.type).toBe("rectangle");
      expect(result.shape.width).toBe(100);
      expect(result.shape.height).toBe(100);
      expect(result.text).toBeNull();
    });

    it("should wire container -> text binding", () => {
      const result = createRectangle(0, 0, "Test");

      expect(result.shape.boundElements).toHaveLength(1);
      expect(result.shape.boundElements![0].id).toBe(result.text!.id);
      expect(result.shape.boundElements![0].type).toBe("text");
    });
  });

  describe("createEllipse", () => {
    it("should create an ellipse with bound text", () => {
      const result = createEllipse(50, 50, "Circle");

      expect(result.shape.type).toBe("ellipse");
      expect(result.text!.text).toBe("Circle");
      expect(result.shape.roundness?.type).toBe(2);
    });
  });

  describe("createDiamond", () => {
    it("should create a diamond with bound text", () => {
      const result = createDiamond(50, 50, "Decision?");

      expect(result.shape.type).toBe("diamond");
      expect(result.text!.text).toBe("Decision?");
    });

    it("should be larger than rectangle for same text", () => {
      const diamond = createDiamond(0, 0, "Test");
      const rect = createRectangle(0, 0, "Test");

      expect(diamond.shape.width).toBeGreaterThan(rect.shape.width);
    });
  });

  describe("createArrow", () => {
    it("should create an arrow between two points", () => {
      const result = createArrow(0, 0, 100, 200);

      expect(result.arrow.type).toBe("arrow");
      expect(result.arrow.points).toEqual([[0, 0], [100, 200]]);
      expect(result.arrow.endArrowhead).toBe("arrow");
      expect(result.label).toBeNull();
    });

    it("should create an arrow with bindings", () => {
      const result = createArrow(0, 0, 100, 200, {
        fromId: "shape1",
        toId: "shape2",
      });

      expect(result.arrow.startBinding?.elementId).toBe("shape1");
      expect(result.arrow.endBinding?.elementId).toBe("shape2");
    });

    it("should create an arrow with label", () => {
      const result = createArrow(0, 0, 100, 200, {
        label: "yes",
      });

      expect(result.label).not.toBeNull();
      expect(result.label!.text).toBe("yes");
      expect(result.label!.containerId).toBe(result.arrow.id);
      expect(result.arrow.boundElements).toHaveLength(1);
    });
  });

  describe("createStandaloneText", () => {
    it("should create an unbound text element", () => {
      const text = createStandaloneText(10, 20, "Note");

      expect(text.type).toBe("text");
      expect(text.text).toBe("Note");
      expect(text.containerId).toBeNull();
      expect(text.x).toBe(10);
      expect(text.y).toBe(20);
    });
  });

  describe("updateTextContent", () => {
    it("should update text and recalculate dimensions", () => {
      const original = createStandaloneText(0, 0, "Hi");
      const updated = updateTextContent(original, "Hello World");

      expect(updated.text).toBe("Hello World");
      expect(updated.width).toBeGreaterThan(original.width);
      expect(updated.version).toBe(original.version + 1);
    });
  });

  describe("resizeContainerForText", () => {
    it("should resize container to fit text", () => {
      const { shape } = createRectangle(0, 0, "Short");
      const resized = resizeContainerForText(shape, 300, 50);

      expect(resized.width).toBeGreaterThan(300);
      expect(resized.version).toBe(shape.version + 1);
    });
  });
});
