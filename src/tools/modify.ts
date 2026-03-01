import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { parseFile } from "../core/parser.js";
import { serializeDocument } from "../core/serializer.js";
import { toGraphSummary } from "../core/graph.js";
import { resolveTarget } from "../core/resolve-target.js";
import {
  validateBindings,
  repairBindings,
  setupArrowBindings,
  removeElementClean,
  removeArrowClean,
} from "../core/bindings.js";
import {
  createShape,
  createArrow,
  updateTextContent,
  resizeContainerForText,
} from "../core/elements.js";
import { generateVersionNonce } from "../core/ids.js";
import type {
  ExcalidrawElement,
  GraphSummary,
  ModifyOperation,
  Position,
  NodeStyle,
} from "../types/index.js";

export interface ModifyDiagramInput {
  path: string;
  operations: ModifyOperation[];
}

export interface ModifyDiagramResult {
  summary: GraphSummary;
  operationsApplied: number;
}

/**
 * Apply a batch of semantic operations to an existing diagram.
 * All-or-nothing: if any operation fails, the file is not modified.
 */
export async function modifyDiagram(input: ModifyDiagramInput): Promise<ModifyDiagramResult> {
  const content = await readFile(input.path, "utf-8");
  const parsed = parseFile(input.path, content);

  // Deep-clone elements for rollback on failure
  const originalElements = structuredClone(parsed.document.elements);
  let elements = structuredClone(parsed.document.elements);

  try {
    for (let i = 0; i < input.operations.length; i++) {
      const op = input.operations[i];
      try {
        elements = applyOperation(op, elements);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Operation ${i + 1}/${input.operations.length} (${op.type}) failed: ${message}`,
        );
      }
    }

    // Validate and repair bindings after all operations
    const violations = validateBindings(elements);
    if (violations.length > 0) {
      elements = repairBindings(elements);
    }

    // Write back
    parsed.document.elements = elements;
    const serialized = serializeDocument(
      parsed.document,
      parsed.format,
      parsed.markdownTemplate,
    );
    await atomicWrite(input.path, serialized);

    const summary = toGraphSummary(elements, parsed.format);
    return { summary, operationsApplied: input.operations.length };
  } catch (err) {
    // Rollback: don't write the file. Re-throw with context.
    throw err;
  }
}

// === Operation Dispatch ===

function applyOperation(
  op: ModifyOperation,
  elements: ExcalidrawElement[],
): ExcalidrawElement[] {
  switch (op.type) {
    case "change_text":
      return applyChangeText(op.target, op.text, elements);
    case "add_node":
      return applyAddNode(op.spec, op.position, elements);
    case "remove":
      return applyRemove(op.target, elements);
    case "connect":
      return applyConnect(op.from, op.to, op.label, elements);
    case "disconnect":
      return applyDisconnect(op.from, op.to, elements);
    case "restyle":
      return applyRestyle(op.target, op.style, elements);
    case "reposition":
      return applyReposition(op.target, op.position, elements);
    default:
      throw new Error(`Unknown operation type: ${(op as ModifyOperation).type}`);
  }
}

// === Operations ===

function applyChangeText(
  target: string,
  newText: string,
  elements: ExcalidrawElement[],
): ExcalidrawElement[] {
  const resolved = resolveTarget(target, elements);
  const el = resolved.element;

  if (el.type === "text") {
    // Direct text element – update it
    return elements.map((e) =>
      e.id === el.id ? updateTextContent(e, newText) : e,
    );
  }

  // Shape with bound text – find and update the text element
  const textBound = el.boundElements?.find((b) => b.type === "text");
  if (!textBound) {
    throw new Error(
      `Element "${target}" (${el.type}, id: ${el.id}) has no text to change. ` +
      `It has no bound text element.`,
    );
  }

  return elements.map((e) => {
    if (e.id === textBound.id) {
      const updated = updateTextContent(e, newText);
      return updated;
    }
    if (e.id === el.id) {
      // Resize container to fit new text
      const textEl = elements.find((t) => t.id === textBound.id)!;
      const updatedText = updateTextContent(textEl, newText);
      return resizeContainerForText(e, updatedText.width, updatedText.height);
    }
    return e;
  });
}

function applyAddNode(
  spec: { type?: "rectangle" | "ellipse" | "diamond"; text: string; style?: NodeStyle },
  position: Position,
  elements: ExcalidrawElement[],
): ExcalidrawElement[] {
  const { x, y } = resolvePosition(position, elements);
  const result = createShape(spec, x, y);
  const newElements = [...elements, result.shape];
  if (result.text) newElements.push(result.text);
  return newElements;
}

function applyRemove(
  target: string,
  elements: ExcalidrawElement[],
): ExcalidrawElement[] {
  const resolved = resolveTarget(target, elements);
  return removeElementClean(resolved.element.id, elements);
}

function applyConnect(
  from: string,
  to: string,
  label: string | undefined,
  elements: ExcalidrawElement[],
): ExcalidrawElement[] {
  const fromResolved = resolveTarget(from, elements);
  const toResolved = resolveTarget(to, elements);

  const fromEl = fromResolved.element;
  const toEl = toResolved.element;

  const fromCX = fromEl.x + fromEl.width / 2;
  const fromCY = fromEl.y + fromEl.height / 2;
  const toCX = toEl.x + toEl.width / 2;
  const toCY = toEl.y + toEl.height / 2;

  const result = createArrow(fromCX, fromCY, toCX, toCY, {
    fromId: fromEl.id,
    toId: toEl.id,
    label,
  });

  let newElements = [...elements, result.arrow];
  if (result.label) newElements.push(result.label);

  newElements = setupArrowBindings(result.arrow.id, fromEl.id, toEl.id, newElements);
  return newElements;
}

function applyDisconnect(
  from: string,
  to: string,
  elements: ExcalidrawElement[],
): ExcalidrawElement[] {
  const fromResolved = resolveTarget(from, elements);
  const toResolved = resolveTarget(to, elements);

  // Find arrows connecting from -> to
  const connectingArrows = elements.filter(
    (e) =>
      e.type === "arrow" &&
      !e.isDeleted &&
      e.startBinding?.elementId === fromResolved.element.id &&
      e.endBinding?.elementId === toResolved.element.id,
  );

  if (connectingArrows.length === 0) {
    throw new Error(
      `No arrow found connecting "${from}" to "${to}". ` +
      `Check that the elements are connected and the direction is correct.`,
    );
  }

  let result = elements;
  for (const arrow of connectingArrows) {
    result = removeArrowClean(arrow.id, result);
  }
  return result;
}

function applyRestyle(
  target: string,
  style: NodeStyle,
  elements: ExcalidrawElement[],
): ExcalidrawElement[] {
  const resolved = resolveTarget(target, elements);
  return elements.map((e) => {
    if (e.id !== resolved.element.id) return e;
    return {
      ...e,
      ...(style.strokeColor !== undefined && { strokeColor: style.strokeColor }),
      ...(style.backgroundColor !== undefined && { backgroundColor: style.backgroundColor }),
      ...(style.fillStyle !== undefined && { fillStyle: style.fillStyle }),
      ...(style.strokeWidth !== undefined && { strokeWidth: style.strokeWidth }),
      ...(style.strokeStyle !== undefined && { strokeStyle: style.strokeStyle }),
      ...(style.roughness !== undefined && { roughness: style.roughness }),
      ...(style.opacity !== undefined && { opacity: style.opacity }),
      version: e.version + 1,
      versionNonce: generateVersionNonce(),
      updated: Date.now(),
    };
  });
}

function applyReposition(
  target: string,
  position: Position,
  elements: ExcalidrawElement[],
): ExcalidrawElement[] {
  const resolved = resolveTarget(target, elements);
  const { x, y } = resolvePosition(position, elements);
  const el = resolved.element;
  const dx = x - el.x;
  const dy = y - el.y;

  return elements.map((e) => {
    if (e.id === el.id) {
      return {
        ...e,
        x,
        y,
        version: e.version + 1,
        versionNonce: generateVersionNonce(),
        updated: Date.now(),
      };
    }

    // Move bound text with its container
    if (e.type === "text" && e.containerId === el.id) {
      return {
        ...e,
        x: e.x + dx,
        y: e.y + dy,
        version: e.version + 1,
        versionNonce: generateVersionNonce(),
        updated: Date.now(),
      };
    }

    return e;
  });
}

// === Helpers ===

function resolvePosition(
  position: Position,
  elements: ExcalidrawElement[],
): { x: number; y: number } {
  if (position.type === "absolute") {
    return { x: position.x, y: position.y };
  }

  const anchor = resolveTarget(position.anchor, elements).element;
  const gap = position.gap ?? 80;

  switch (position.direction) {
    case "below":
      return { x: anchor.x, y: anchor.y + anchor.height + gap };
    case "above":
      return { x: anchor.x, y: anchor.y - gap - anchor.height };
    case "right":
      return { x: anchor.x + anchor.width + gap, y: anchor.y };
    case "left":
      return { x: anchor.x - gap - anchor.width, y: anchor.y };
  }
}

async function atomicWrite(path: string, content: string): Promise<void> {
  const absPath = resolve(path);
  const tempPath = absPath + ".tmp." + Date.now();
  await writeFile(tempPath, content, "utf-8");
  try {
    await rename(tempPath, absPath);
  } catch (err) {
    // Clean up temp file on failed rename
    try { await unlink(tempPath); } catch {}
    throw err;
  }
}
