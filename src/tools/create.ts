import { writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { createEmptyDocument } from "../core/parser.js";
import { serializeDocument } from "../core/serializer.js";
import { layoutDiagram } from "../core/layout.js";
import { validateBindings, repairBindings } from "../core/bindings.js";
import { toGraphSummary } from "../core/graph.js";
import { generateId, generateSeed, generateVersionNonce } from "../core/ids.js";
import type {
  ExcalidrawElement,
  FileFormat,
  GraphSummary,
  CreateHighLevelSpec,
  CreateLowLevelSpec,
} from "../types/index.js";
import { isHighLevelSpec } from "../types/index.js";

export interface CreateDiagramInput {
  path: string;
  spec: CreateHighLevelSpec | CreateLowLevelSpec;
}

export interface CreateDiagramResult {
  summary: GraphSummary;
  path: string;
}

/**
 * Create a new Excalidraw diagram from a declarative spec.
 * Output format is determined by file extension.
 */
export async function createDiagram(input: CreateDiagramInput): Promise<CreateDiagramResult> {
  const format = detectFormatFromPath(input.path);
  const document = createEmptyDocument();

  if (isHighLevelSpec(input.spec)) {
    const { elements } = layoutDiagram(
      input.spec.nodes,
      input.spec.edges ?? [],
      input.spec.layout,
    );
    document.elements = elements;
  } else {
    // Low-level: use raw elements, filling in missing defaults
    document.elements = input.spec.elements.map((partial) =>
      fillDefaults(partial),
    );
  }

  // Validate and repair bindings
  const violations = validateBindings(document.elements);
  if (violations.length > 0) {
    document.elements = repairBindings(document.elements);
  }

  // Serialize and write atomically
  const content = serializeDocument(document, format);
  await atomicWrite(input.path, content);

  const summary = toGraphSummary(document.elements, format);
  return { summary, path: input.path };
}

// === Helpers ===

function detectFormatFromPath(path: string): FileFormat {
  if (path.endsWith(".excalidraw.md")) return "excalidraw.md";
  return "excalidraw";
}

function fillDefaults(partial: Partial<ExcalidrawElement>): ExcalidrawElement {
  return {
    id: generateId(),
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    seed: generateSeed(),
    version: 1,
    versionNonce: generateVersionNonce(),
    updated: Date.now(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    link: null,
    locked: false,
    roundness: { type: 3 },
    ...partial,
  } as ExcalidrawElement;
}

/**
 * Write file atomically: write to temp file, then rename.
 * Prevents data loss from interrupted writes.
 */
async function atomicWrite(path: string, content: string): Promise<void> {
  const absPath = resolve(path);
  const tempPath = absPath + ".tmp." + Date.now();
  await writeFile(tempPath, content, "utf-8");
  await rename(tempPath, absPath);
}
