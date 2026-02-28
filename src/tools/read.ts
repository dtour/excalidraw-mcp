import { readFile } from "node:fs/promises";
import { parseFile } from "../core/parser.js";
import { toGraphSummary } from "../core/graph.js";
import type { GraphSummary } from "../types/index.js";

export interface ReadDiagramInput {
  path: string;
}

export interface ReadDiagramResult {
  summary: GraphSummary;
}

/**
 * Read and parse an Excalidraw diagram, returning a semantic GraphSummary.
 */
export async function readDiagram(input: ReadDiagramInput): Promise<ReadDiagramResult> {
  const content = await readFile(input.path, "utf-8");
  const parsed = parseFile(input.path, content);
  const summary = toGraphSummary(parsed.document.elements, parsed.format);
  return { summary };
}
