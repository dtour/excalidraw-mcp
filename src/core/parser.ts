import LZString from "lz-string";
import type { ExcalidrawDocument, FileFormat, ParsedFile, AppState } from "../types/index.js";

const DEFAULT_APP_STATE: AppState = {
  gridSize: null,
  gridStep: 5,
  gridModeEnabled: false,
  viewBackgroundColor: "#ffffff",
};

/**
 * Detect the file format from extension and content.
 */
function detectFormat(filePath: string, content: string): FileFormat {
  if (filePath.endsWith(".excalidraw.md")) {
    return "excalidraw.md";
  }
  if (filePath.endsWith(".excalidraw")) {
    return "excalidraw";
  }
  // Fallback: try to detect from content
  const trimmed = content.trimStart();
  if (trimmed.startsWith("{")) {
    return "excalidraw";
  }
  if (trimmed.startsWith("---") || trimmed.includes("excalidraw-plugin")) {
    return "excalidraw.md";
  }
  return "excalidraw";
}

/**
 * Parse a raw .excalidraw JSON file.
 */
function parseExcalidraw(content: string): ExcalidrawDocument {
  let data: any;
  try {
    data = JSON.parse(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to parse Excalidraw JSON: ${message}. ` +
      `The file may be corrupted or not a valid Excalidraw document.`,
    );
  }

  return {
    type: "excalidraw",
    version: data.version ?? 2,
    source: data.source ?? "excalidraw-mcp",
    elements: Array.isArray(data.elements) ? data.elements : [],
    appState: { ...DEFAULT_APP_STATE, ...(data.appState ?? {}) },
    files: data.files ?? {},
  };
}

/**
 * Parse an .excalidraw.md (Obsidian plugin format) file.
 *
 * Structure:
 * ---
 * excalidraw-plugin: parsed
 * tags: [excalidraw]
 * ---
 *
 * (optional Markdown content)
 *
 * %%
 * # Excalidraw Data
 * ## Text Elements
 * (text elements listed here for Obsidian search)
 *
 * ## Drawing
 * ```compressed-json
 * <LZ-String compressed JSON>
 * ```
 * %%
 */
function parseExcalidrawMd(content: string): { document: ExcalidrawDocument; template: string } {
  // Try compressed-json block first
  const compressedMatch = content.match(
    /```compressed-json\s*\n([\s\S]*?)\n```/,
  );

  if (compressedMatch) {
    const compressed = compressedMatch[1].replace(/\n/g, "");
    const decompressed = LZString.decompressFromBase64(compressed);
    if (!decompressed) {
      throw new Error(
        "Failed to decompress LZ-String data from .excalidraw.md file. " +
        "The compressed-json block may be corrupted.",
      );
    }
    const document = parseExcalidraw(decompressed);
    return { document, template: content };
  }

  // Try raw JSON block (some older files use this)
  const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    const document = parseExcalidraw(jsonMatch[1]);
    return { document, template: content };
  }

  // Try excalidraw-data block
  const dataMatch = content.match(
    /%%\s*\n# Excalidraw Data\s*\n([\s\S]*?)%%/,
  );
  if (dataMatch) {
    // Look for inline JSON within the data section
    const inlineJson = dataMatch[1].match(/\{[\s\S]*\}/);
    if (inlineJson) {
      const document = parseExcalidraw(inlineJson[0]);
      return { document, template: content };
    }
  }

  throw new Error(
    "Could not find Excalidraw data in .excalidraw.md file. " +
    "Expected a ```compressed-json``` or ```json``` code block " +
    "within an Excalidraw data section.",
  );
}

/**
 * Parse any Excalidraw file format.
 */
export function parseFile(filePath: string, content: string): ParsedFile {
  const format = detectFormat(filePath, content);

  if (format === "excalidraw.md") {
    const { document, template } = parseExcalidrawMd(content);
    return { document, format, markdownTemplate: template };
  }

  return { document: parseExcalidraw(content), format };
}

/**
 * Create an empty Excalidraw document with sensible defaults.
 */
export function createEmptyDocument(): ExcalidrawDocument {
  return {
    type: "excalidraw",
    version: 2,
    source: "excalidraw-mcp",
    elements: [],
    appState: { ...DEFAULT_APP_STATE },
    files: {},
  };
}
