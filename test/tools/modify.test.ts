import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { createDiagram } from "../../src/tools/create.js";
import { modifyDiagram } from "../../src/tools/modify.js";
import { readDiagram } from "../../src/tools/read.js";

const TEST_DIR = resolve(__dirname, "../.tmp");

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("modify", () => {
  describe("resolvePosition", () => {
    it("should place 'below' at anchor.y + anchor.height + gap", async () => {
      const path = join(TEST_DIR, "below.excalidraw");
      await createDiagram({
        path,
        spec: { nodes: [{ text: "Anchor" }] },
      });

      const before = await readDiagram({ path });
      const anchor = before.summary.nodes[0];

      await modifyDiagram({
        path,
        operations: [
          {
            type: "add_node",
            spec: { text: "Below" },
            position: { type: "relative", anchor: "Anchor", direction: "below", gap: 50 },
          },
        ],
      });

      const after = await readDiagram({ path });
      const added = after.summary.nodes.find((n) => n.text === "Below")!;
      expect(added.y).toBe(anchor.y + anchor.height + 50);
    });

    it("should place 'above' at anchor.y - gap - anchor.height", async () => {
      const path = join(TEST_DIR, "above.excalidraw");
      await createDiagram({
        path,
        spec: { nodes: [{ text: "Anchor" }] },
      });

      const before = await readDiagram({ path });
      const anchor = before.summary.nodes[0];

      await modifyDiagram({
        path,
        operations: [
          {
            type: "add_node",
            spec: { text: "Above" },
            position: { type: "relative", anchor: "Anchor", direction: "above", gap: 50 },
          },
        ],
      });

      const after = await readDiagram({ path });
      const added = after.summary.nodes.find((n) => n.text === "Above")!;
      expect(added.y).toBe(anchor.y - 50 - anchor.height);
    });

    it("should place 'right' at anchor.x + anchor.width + gap", async () => {
      const path = join(TEST_DIR, "right.excalidraw");
      await createDiagram({
        path,
        spec: { nodes: [{ text: "Anchor" }] },
      });

      const before = await readDiagram({ path });
      const anchor = before.summary.nodes[0];

      await modifyDiagram({
        path,
        operations: [
          {
            type: "add_node",
            spec: { text: "Right" },
            position: { type: "relative", anchor: "Anchor", direction: "right", gap: 50 },
          },
        ],
      });

      const after = await readDiagram({ path });
      const added = after.summary.nodes.find((n) => n.text === "Right")!;
      expect(added.x).toBe(anchor.x + anchor.width + 50);
    });

    it("should place 'left' at anchor.x - gap - anchor.width", async () => {
      const path = join(TEST_DIR, "left.excalidraw");
      await createDiagram({
        path,
        spec: { nodes: [{ text: "Anchor" }] },
      });

      const before = await readDiagram({ path });
      const anchor = before.summary.nodes[0];

      await modifyDiagram({
        path,
        operations: [
          {
            type: "add_node",
            spec: { text: "Left" },
            position: { type: "relative", anchor: "Anchor", direction: "left", gap: 50 },
          },
        ],
      });

      const after = await readDiagram({ path });
      const added = after.summary.nodes.find((n) => n.text === "Left")!;
      expect(added.x).toBe(anchor.x - 50 - anchor.width);
    });

    it("should use default gap of 80 when omitted", async () => {
      const path = join(TEST_DIR, "defaultgap.excalidraw");
      await createDiagram({
        path,
        spec: { nodes: [{ text: "Anchor" }] },
      });

      const before = await readDiagram({ path });
      const anchor = before.summary.nodes[0];

      await modifyDiagram({
        path,
        operations: [
          {
            type: "add_node",
            spec: { text: "Below" },
            position: { type: "relative", anchor: "Anchor", direction: "below" },
          },
        ],
      });

      const after = await readDiagram({ path });
      const added = after.summary.nodes.find((n) => n.text === "Below")!;
      expect(added.y).toBe(anchor.y + anchor.height + 80);
    });
  });

  describe("atomicWrite error handling", () => {
    it("should throw when writing to nonexistent directory", async () => {
      const badPath = join(TEST_DIR, "nonexistent", "deep", "path", "test.excalidraw");
      await expect(
        createDiagram({
          path: badPath,
          spec: { nodes: [{ text: "X" }] },
        }),
      ).rejects.toThrow();
    });

    it("should not leak .tmp files after failed create", async () => {
      const badPath = join(TEST_DIR, "nonexistent", "test.excalidraw");
      try {
        await createDiagram({
          path: badPath,
          spec: { nodes: [{ text: "X" }] },
        });
      } catch {
        // expected
      }

      // The parent dir doesn't exist, so no temp files should be there
      // Check the TEST_DIR for any .tmp files
      const files = readdirSync(TEST_DIR);
      const tmpFiles = files.filter((f) => f.includes(".tmp."));
      expect(tmpFiles).toHaveLength(0);
    });

    it("should leave original file unchanged after modify failure", async () => {
      const path = join(TEST_DIR, "unchanged.excalidraw");
      await createDiagram({
        path,
        spec: { nodes: [{ text: "Original" }] },
      });

      // Attempt a modify with an operation that will fail
      await expect(
        modifyDiagram({
          path,
          operations: [
            { type: "remove", target: "DoesNotExist" },
          ],
        }),
      ).rejects.toThrow();

      // Original file should be unchanged
      const result = await readDiagram({ path });
      expect(result.summary.nodes[0].text).toBe("Original");
    });
  });
});
