import LZString from "lz-string";
import type { ExcalidrawDocument, ExcalidrawElement, FileFormat } from "../types/index.js";

/**
 * Serialize an Excalidraw document to its file content.
 */
export function serializeDocument(
  document: ExcalidrawDocument,
  format: FileFormat,
  markdownTemplate?: string,
): string {
  if (format === "excalidraw.md") {
    return serializeToMd(document, markdownTemplate);
  }
  return serializeToJson(document);
}

/**
 * Serialize to raw .excalidraw JSON.
 */
function serializeToJson(document: ExcalidrawDocument): string {
  return JSON.stringify(document, null, 2) + "\n";
}

/**
 * Build the ## Text Elements section from current element state.
 * This is always regenerated to prevent desync with compressed JSON.
 */
function buildTextElementsSection(elements: ExcalidrawElement[]): string {
  const textElements = elements.filter(
    (el) => el.type === "text" && el.text && !el.isDeleted,
  );

  if (textElements.length === 0) return "";

  const lines = textElements.map((el) => {
    const text = el.text ?? "";
    return `${text} ^${el.id}`;
  });

  return `## Text Elements\n${lines.join("\n\n")}\n`;
}

/**
 * Serialize to .excalidraw.md (Obsidian plugin format).
 *
 * Always regenerates ## Text Elements and ## Drawing sections.
 * Preserves frontmatter and any user Markdown content before the Excalidraw data block.
 */
function serializeToMd(
  document: ExcalidrawDocument,
  template?: string,
): string {
  const json = JSON.stringify(document);
  const compressed = LZString.compressToBase64(json);
  const textSection = buildTextElementsSection(document.elements);

  const drawingBlock = [
    "## Drawing",
    "```compressed-json",
    compressed,
    "```",
  ].join("\n");

  const excalidrawData = [
    "%%",
    "# Excalidraw Data",
    textSection,
    drawingBlock,
    "%%",
  ].join("\n");

  if (template) {
    // Replace existing Excalidraw data block, preserving everything before it
    const dataBlockStart = template.indexOf("%%\n# Excalidraw Data");
    if (dataBlockStart !== -1) {
      const beforeData = template.slice(0, dataBlockStart);
      return beforeData + excalidrawData + "\n";
    }

    // If no data block found, append to template
    return template.trimEnd() + "\n\n" + excalidrawData + "\n";
  }

  // Generate new .excalidraw.md from scratch
  return [
    "---",
    "excalidraw-plugin: parsed",
    "tags: [excalidraw]",
    "---",
    "",
    excalidrawData,
    "",
  ].join("\n");
}
