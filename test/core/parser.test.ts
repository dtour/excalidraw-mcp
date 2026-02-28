import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseFile, createEmptyDocument } from "../../src/core/parser.js";

const FIXTURES_DIR = resolve(__dirname, "../fixtures");

describe("parser", () => {
  describe("parseFile", () => {
    it("should parse a .excalidraw JSON file", () => {
      const content = readFileSync(
        resolve(FIXTURES_DIR, "simple.excalidraw"),
        "utf-8",
      );
      const result = parseFile("test.excalidraw", content);

      expect(result.format).toBe("excalidraw");
      expect(result.document.type).toBe("excalidraw");
      expect(result.document.version).toBe(2);
      expect(result.document.elements).toHaveLength(5);
      expect(result.markdownTemplate).toBeUndefined();
    });

    it("should preserve appState on parse", () => {
      const content = readFileSync(
        resolve(FIXTURES_DIR, "simple.excalidraw"),
        "utf-8",
      );
      const result = parseFile("test.excalidraw", content);

      expect(result.document.appState.viewBackgroundColor).toBe("#ffffff");
    });

    it("should preserve files on parse", () => {
      const content = readFileSync(
        resolve(FIXTURES_DIR, "simple.excalidraw"),
        "utf-8",
      );
      const result = parseFile("test.excalidraw", content);

      expect(result.document.files).toEqual({});
    });

    it("should detect format from file extension", () => {
      const json = JSON.stringify({ type: "excalidraw", version: 2, elements: [] });
      expect(parseFile("foo.excalidraw", json).format).toBe("excalidraw");
      expect(parseFile("foo.excalidraw.md", `---\nexcalidraw-plugin: parsed\n---\n%%\n# Excalidraw Data\n## Drawing\n\`\`\`json\n${json}\n\`\`\`\n%%`).format).toBe("excalidraw.md");
    });

    it("should parse elements with correct types", () => {
      const content = readFileSync(
        resolve(FIXTURES_DIR, "simple.excalidraw"),
        "utf-8",
      );
      const result = parseFile("test.excalidraw", content);
      const types = result.document.elements.map((e) => e.type);

      expect(types).toContain("rectangle");
      expect(types).toContain("text");
      expect(types).toContain("arrow");
    });
  });

  describe("createEmptyDocument", () => {
    it("should create a valid empty document", () => {
      const doc = createEmptyDocument();

      expect(doc.type).toBe("excalidraw");
      expect(doc.version).toBe(2);
      expect(doc.elements).toEqual([]);
      expect(doc.appState.viewBackgroundColor).toBe("#ffffff");
      expect(doc.files).toEqual({});
    });
  });
});
