import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { readDiagram } from "../../src/tools/read.js";
import { createDiagram } from "../../src/tools/create.js";
import { modifyDiagram } from "../../src/tools/modify.js";
import { renderDiagram } from "../../src/tools/render.js";

const TEST_DIR = resolve(__dirname, "../.tmp");

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("tool integration", () => {
  describe("create -> read roundtrip", () => {
    it("should create a diagram and read it back", async () => {
      const path = join(TEST_DIR, "test.excalidraw");

      const createResult = await createDiagram({
        path,
        spec: {
          nodes: [
            { text: "Start", type: "rectangle" },
            { text: "End", type: "rectangle" },
          ],
          edges: [{ from: "Start", to: "End" }],
          layout: { type: "vertical-flow" },
        },
      });

      expect(createResult.summary.nodes).toHaveLength(2);
      expect(createResult.summary.edges).toHaveLength(1);

      // Read it back
      const readResult = await readDiagram({ path });
      expect(readResult.summary.nodes).toHaveLength(2);
      expect(readResult.summary.edges).toHaveLength(1);

      const startNode = readResult.summary.nodes.find((n) => n.text === "Start");
      const endNode = readResult.summary.nodes.find((n) => n.text === "End");
      expect(startNode).toBeDefined();
      expect(endNode).toBeDefined();
    });
  });

  describe("create -> modify -> read", () => {
    it("should modify text in a diagram", async () => {
      const path = join(TEST_DIR, "modify-test.excalidraw");

      await createDiagram({
        path,
        spec: {
          nodes: [
            { text: "Original" },
            { text: "Other" },
          ],
        },
      });

      const modResult = await modifyDiagram({
        path,
        operations: [
          { type: "change_text", target: "Original", text: "Modified" },
        ],
      });

      expect(modResult.operationsApplied).toBe(1);

      const readResult = await readDiagram({ path });
      expect(readResult.summary.nodes.some((n) => n.text === "Modified")).toBe(true);
      expect(readResult.summary.nodes.some((n) => n.text === "Original")).toBe(false);
    });

    it("should add a node to a diagram", async () => {
      const path = join(TEST_DIR, "add-node.excalidraw");

      await createDiagram({
        path,
        spec: {
          nodes: [{ text: "Existing" }],
        },
      });

      const modResult = await modifyDiagram({
        path,
        operations: [
          {
            type: "add_node",
            spec: { text: "New Node", type: "rectangle" },
            position: { type: "relative", anchor: "Existing", direction: "below" },
          },
        ],
      });

      const readResult = await readDiagram({ path });
      expect(readResult.summary.nodes).toHaveLength(2);
      expect(readResult.summary.nodes.some((n) => n.text === "New Node")).toBe(true);
    });

    it("should connect and disconnect nodes", async () => {
      const path = join(TEST_DIR, "connect.excalidraw");

      await createDiagram({
        path,
        spec: {
          nodes: [{ text: "A" }, { text: "B" }],
        },
      });

      // Connect
      await modifyDiagram({
        path,
        operations: [{ type: "connect", from: "A", to: "B" }],
      });

      let readResult = await readDiagram({ path });
      expect(readResult.summary.edges).toHaveLength(1);

      // Disconnect
      await modifyDiagram({
        path,
        operations: [{ type: "disconnect", from: "A", to: "B" }],
      });

      readResult = await readDiagram({ path });
      expect(readResult.summary.edges).toHaveLength(0);
    });

    it("should remove a node and clean up bindings", async () => {
      const path = join(TEST_DIR, "remove.excalidraw");

      await createDiagram({
        path,
        spec: {
          nodes: [{ text: "Keep" }, { text: "Remove" }],
          edges: [{ from: "Keep", to: "Remove" }],
        },
      });

      await modifyDiagram({
        path,
        operations: [{ type: "remove", target: "Remove" }],
      });

      const readResult = await readDiagram({ path });
      expect(readResult.summary.nodes).toHaveLength(1);
      expect(readResult.summary.nodes[0].text).toBe("Keep");
      // Arrow should be gone or have cleared binding
    });
  });

  describe("create -> render", () => {
    it("should render to SVG", async () => {
      const path = join(TEST_DIR, "render.excalidraw");

      await createDiagram({
        path,
        spec: {
          nodes: [
            { text: "Hello" },
            { text: "World" },
          ],
          edges: [{ from: "Hello", to: "World" }],
        },
      });

      const result = await renderDiagram({ path, format: "svg" });

      expect(result.mimeType).toBe("image/svg+xml");
      expect(result.isBase64).toBe(false);
      expect(result.data).toContain("<svg");
      expect(result.data).toContain("</svg>");
    });
  });

  describe(".excalidraw.md format", () => {
    it("should create and read .excalidraw.md files", async () => {
      const path = join(TEST_DIR, "test.excalidraw.md");

      await createDiagram({
        path,
        spec: {
          nodes: [{ text: "Obsidian" }],
        },
      });

      // Verify file contains expected markdown structure
      const content = readFileSync(path, "utf-8");
      expect(content).toContain("excalidraw-plugin: parsed");
      expect(content).toContain("```compressed-json");

      // Read back
      const readResult = await readDiagram({ path });
      expect(readResult.summary.nodes).toHaveLength(1);
      expect(readResult.summary.nodes[0].text).toBe("Obsidian");
      expect(readResult.summary.metadata.format).toBe("excalidraw.md");
    });
  });

  describe("atomic batch operations", () => {
    it("should roll back all operations if one fails", async () => {
      const path = join(TEST_DIR, "atomic.excalidraw");

      await createDiagram({
        path,
        spec: {
          nodes: [{ text: "Keep" }],
        },
      });

      // Second operation should fail (nonexistent target)
      await expect(
        modifyDiagram({
          path,
          operations: [
            { type: "change_text", target: "Keep", text: "Changed" },
            { type: "remove", target: "Nonexistent" },
          ],
        }),
      ).rejects.toThrow();

      // Original should be unchanged
      const readResult = await readDiagram({ path });
      expect(readResult.summary.nodes[0].text).toBe("Keep");
    });
  });
});
