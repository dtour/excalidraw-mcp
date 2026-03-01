import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { renderDiagram } from "../../src/tools/render.js";
import type { ExcalidrawElement } from "../../src/types/index.js";

const TEST_DIR = resolve(__dirname, "../.tmp");

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

/** Create a minimal element with sensible defaults and overrides. */
function el(overrides: Partial<ExcalidrawElement>): ExcalidrawElement {
  return {
    id: "test-id",
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 60,
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
    roundness: { type: 3 },
    ...overrides,
  } as ExcalidrawElement;
}

/** Write a test .excalidraw file with the given elements. */
function writeTestDiagram(name: string, elements: ExcalidrawElement[]): string {
  const path = join(TEST_DIR, name);
  const doc = {
    type: "excalidraw",
    version: 2,
    source: "test",
    elements,
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  };
  writeFileSync(path, JSON.stringify(doc), "utf-8");
  return path;
}

describe("render", () => {
  describe("basic shapes", () => {
    it("should render rectangle as <rect>", async () => {
      const path = writeTestDiagram("rect.excalidraw", [el({ id: "r1", type: "rectangle" })]);
      const result = await renderDiagram({ path });
      expect(result.data).toContain("<rect");
    });

    it("should render ellipse as <ellipse>", async () => {
      const path = writeTestDiagram("ell.excalidraw", [el({ id: "e1", type: "ellipse" })]);
      const result = await renderDiagram({ path });
      expect(result.data).toContain("<ellipse");
    });

    it("should render diamond as <polygon>", async () => {
      const path = writeTestDiagram("dia.excalidraw", [el({ id: "d1", type: "diamond" })]);
      const result = await renderDiagram({ path });
      expect(result.data).toContain("<polygon");
    });
  });

  describe("rotation", () => {
    it("should not include transform=rotate for angle: 0", async () => {
      const path = writeTestDiagram("norot.excalidraw", [
        el({ id: "r1", type: "rectangle", angle: 0 }),
      ]);
      const result = await renderDiagram({ path });
      expect(result.data).not.toContain('transform="rotate');
    });

    it("should include transform=rotate for non-zero angle", async () => {
      const path = writeTestDiagram("rot.excalidraw", [
        el({ id: "r1", type: "rectangle", angle: 0.5 }),
      ]);
      const result = await renderDiagram({ path });
      expect(result.data).toContain('transform="rotate(');
    });

    it("should render Math.PI/2 as 90 degrees", async () => {
      const path = writeTestDiagram("rot90.excalidraw", [
        el({ id: "r1", type: "rectangle", angle: Math.PI / 2 }),
      ]);
      const result = await renderDiagram({ path });
      expect(result.data).toContain("90");
    });

    it("should use element midpoint as rotation center", async () => {
      const elem = el({ id: "r1", type: "rectangle", x: 100, y: 200, width: 80, height: 40, angle: 1 });
      const path = writeTestDiagram("rotcenter.excalidraw", [elem]);
      const result = await renderDiagram({ path });
      // The rotation center should be at the midpoint of the element
      // In SVG coords: (x + offsetX + width/2, y + offsetY + height/2)
      // With padding=40, offset = -minX + 40, for single element: offset = -100 + 40 = -60, so svgX = 100 + (-60) = 40
      // midX = 40 + 80/2 = 80, midY offset = -200+40 = -160, svgY = 200+(-160) = 40, midY = 40 + 40/2 = 60
      expect(result.data).toContain("80");
      expect(result.data).toContain("60");
    });
  });

  describe("text rotation", () => {
    it("should wrap rotated text in <g> with transform", async () => {
      const path = writeTestDiagram("rottext.excalidraw", [
        el({ id: "t1", type: "text", text: "Hello", fontSize: 20, angle: 0.5 } as any),
      ]);
      const result = await renderDiagram({ path });
      expect(result.data).toContain("<g");
      expect(result.data).toContain("transform=");
    });

    it("should not wrap non-rotated text in <g>", async () => {
      const path = writeTestDiagram("norottext.excalidraw", [
        el({ id: "t1", type: "text", text: "Hello", fontSize: 20, angle: 0 } as any),
      ]);
      const result = await renderDiagram({ path });
      expect(result.data).toContain("<text");
      expect(result.data).not.toContain("<g");
    });
  });

  describe("per-arrow marker colors", () => {
    it("should produce marker with matching fill color and unique ID", async () => {
      const path = writeTestDiagram("arrowcolor.excalidraw", [
        el({
          id: "a1",
          type: "arrow",
          strokeColor: "#ff0000",
          endArrowhead: "arrow",
          points: [[0, 0], [100, 0]],
        } as any),
      ]);
      const result = await renderDiagram({ path });
      expect(result.data).toContain('fill="#ff0000"');
      expect(result.data).toContain('id="arrowhead-a1"');
    });

    it("should produce separate markers for arrows with different colors", async () => {
      const path = writeTestDiagram("arrowcolors.excalidraw", [
        el({
          id: "a1",
          type: "arrow",
          strokeColor: "#ff0000",
          endArrowhead: "arrow",
          points: [[0, 0], [100, 0]],
        } as any),
        el({
          id: "a2",
          type: "arrow",
          x: 0,
          y: 100,
          strokeColor: "#0000ff",
          endArrowhead: "arrow",
          points: [[0, 0], [100, 0]],
        } as any),
      ]);
      const result = await renderDiagram({ path });
      expect(result.data).toContain('id="arrowhead-a1"');
      expect(result.data).toContain('id="arrowhead-a2"');
      expect(result.data).toContain('fill="#ff0000"');
      expect(result.data).toContain('fill="#0000ff"');
    });

    it("should not produce <marker> for arrow without endArrowhead", async () => {
      const path = writeTestDiagram("noarrowhead.excalidraw", [
        el({
          id: "a1",
          type: "arrow",
          points: [[0, 0], [100, 0]],
        } as any),
      ]);
      const result = await renderDiagram({ path });
      expect(result.data).not.toContain("<marker");
    });

    it("should reference its own marker-end URL", async () => {
      const path = writeTestDiagram("arrowref.excalidraw", [
        el({
          id: "a1",
          type: "arrow",
          strokeColor: "#1e1e1e",
          endArrowhead: "arrow",
          points: [[0, 0], [100, 0]],
        } as any),
      ]);
      const result = await renderDiagram({ path });
      expect(result.data).toContain('marker-end="url(#arrowhead-a1)"');
    });
  });

  describe("other", () => {
    it("should render empty diagram as minimal SVG", async () => {
      const path = writeTestDiagram("empty.excalidraw", []);
      const result = await renderDiagram({ path });
      expect(result.data).toContain("<svg");
      expect(result.data).toContain("</svg>");
      expect(result.data).toContain('width="100"');
      expect(result.data).toContain('height="100"');
    });

    it("should scale SVG dimensions with scale parameter", async () => {
      const elem = el({ id: "r1", type: "rectangle", x: 0, y: 0, width: 100, height: 100 });
      const path = writeTestDiagram("scale.excalidraw", [elem]);

      const result1x = await renderDiagram({ path, scale: 1 });
      const result2x = await renderDiagram({ path, scale: 2 });

      // Extract width from SVG
      const getWidth = (svg: string) => {
        const match = svg.match(/width="(\d+)"/);
        return match ? parseInt(match[1]) : 0;
      };

      expect(getWidth(result2x.data)).toBeGreaterThan(getWidth(result1x.data));
    });

    it("should produce multiple <text> elements for multi-line text", async () => {
      const path = writeTestDiagram("multiline.excalidraw", [
        el({ id: "t1", type: "text", text: "Line 1\nLine 2\nLine 3", fontSize: 20 } as any),
      ]);
      const result = await renderDiagram({ path });
      const textCount = (result.data.match(/<text /g) || []).length;
      expect(textCount).toBe(3);
    });

    it("should escape XML special characters in text", async () => {
      const path = writeTestDiagram("escape.excalidraw", [
        el({ id: "t1", type: "text", text: "a < b & c > d", fontSize: 20 } as any),
      ]);
      const result = await renderDiagram({ path });
      expect(result.data).toContain("&lt;");
      expect(result.data).toContain("&amp;");
      expect(result.data).toContain("&gt;");
      expect(result.data).not.toContain(">d<"); // ">" should be escaped
    });
  });
});
