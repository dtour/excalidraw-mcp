import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseFile, createEmptyDocument } from "../../src/core/parser.js";
import { serializeDocument } from "../../src/core/serializer.js";

const FIXTURES_DIR = resolve(__dirname, "../fixtures");

describe("serializer", () => {
  describe("serializeDocument", () => {
    it("should roundtrip .excalidraw format", () => {
      const content = readFileSync(
        resolve(FIXTURES_DIR, "simple.excalidraw"),
        "utf-8",
      );
      const parsed = parseFile("test.excalidraw", content);
      const serialized = serializeDocument(parsed.document, "excalidraw");
      const reparsed = parseFile("test.excalidraw", serialized);

      expect(reparsed.document.elements).toHaveLength(
        parsed.document.elements.length,
      );
      expect(reparsed.document.appState.viewBackgroundColor).toBe(
        parsed.document.appState.viewBackgroundColor,
      );
    });

    it("should generate valid .excalidraw.md format", () => {
      const doc = createEmptyDocument();
      doc.elements = [
        {
          id: "t1",
          type: "text",
          x: 0, y: 0, width: 50, height: 20,
          angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent",
          fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
          roughness: 1, opacity: 100, seed: 1, version: 1,
          versionNonce: 1, updated: Date.now(), isDeleted: false,
          groupIds: [], frameId: null, boundElements: null,
          link: null, locked: false, roundness: null,
          text: "Test Element", originalText: "Test Element",
          fontSize: 20, fontFamily: 1,
        },
      ];

      const md = serializeDocument(doc, "excalidraw.md");

      expect(md).toContain("excalidraw-plugin: parsed");
      expect(md).toContain("## Text Elements");
      expect(md).toContain("Test Element");
      expect(md).toContain("```compressed-json");
    });

    it("should roundtrip .excalidraw.md format", () => {
      const doc = createEmptyDocument();
      doc.elements = [
        {
          id: "r1",
          type: "rectangle",
          x: 0, y: 0, width: 100, height: 50,
          angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent",
          fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
          roughness: 1, opacity: 100, seed: 1, version: 1,
          versionNonce: 1, updated: Date.now(), isDeleted: false,
          groupIds: [], frameId: null, boundElements: null,
          link: null, locked: false, roundness: null,
        },
      ];

      const md = serializeDocument(doc, "excalidraw.md");
      const reparsed = parseFile("test.excalidraw.md", md);

      expect(reparsed.document.elements).toHaveLength(1);
      expect(reparsed.document.elements[0].id).toBe("r1");
      expect(reparsed.format).toBe("excalidraw.md");
    });

    it("should preserve markdown template on roundtrip", () => {
      const template = [
        "---",
        "excalidraw-plugin: parsed",
        "tags: [excalidraw]",
        "---",
        "",
        "# My Custom Notes",
        "",
        "Some user content here.",
        "",
        "%%",
        "# Excalidraw Data",
        "## Drawing",
        "```compressed-json",
        "OLD_DATA",
        "```",
        "%%",
      ].join("\n");

      const doc = createEmptyDocument();
      const serialized = serializeDocument(doc, "excalidraw.md", template);

      expect(serialized).toContain("# My Custom Notes");
      expect(serialized).toContain("Some user content here.");
      expect(serialized).not.toContain("OLD_DATA");
      expect(serialized).toContain("```compressed-json");
    });
  });
});
