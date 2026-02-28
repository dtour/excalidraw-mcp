import type {
  NodeSpec,
  EdgeSpec,
  LayoutConfig,
  ExcalidrawElement,
} from "../types/index.js";
import { createShape, createArrow, type ShapeResult, type ArrowResult } from "./elements.js";
import { setupArrowBindings } from "./bindings.js";

const DEFAULT_SPACING = 80;
const DEFAULT_COLUMNS = 3;

export interface LayoutResult {
  elements: ExcalidrawElement[];
  /** Map from node index (or text) to shape element ID */
  nodeIdMap: Map<string, string>;
}

/**
 * Lay out nodes and edges according to a layout algorithm.
 * Returns a flat array of elements with all bindings wired up.
 */
export function layoutDiagram(
  nodes: NodeSpec[],
  edges: EdgeSpec[],
  layout?: LayoutConfig,
): LayoutResult {
  const type = layout?.type ?? "vertical-flow";
  const spacing = layout?.spacing ?? DEFAULT_SPACING;

  // Create shapes
  const shapes: ShapeResult[] = [];
  const positions = computePositions(nodes, type, spacing, layout?.columns);

  for (let i = 0; i < nodes.length; i++) {
    const pos = positions[i];
    shapes.push(createShape(nodes[i], pos.x, pos.y));
  }

  // Build node ID lookup: index-based and text-based
  const nodeIdMap = new Map<string, string>();
  for (let i = 0; i < nodes.length; i++) {
    nodeIdMap.set(String(i), shapes[i].shape.id);
    if (nodes[i].text) {
      nodeIdMap.set(nodes[i].text, shapes[i].shape.id);
    }
  }

  // Collect all elements
  let elements: ExcalidrawElement[] = [];
  for (const s of shapes) {
    elements.push(s.shape);
    if (s.text) elements.push(s.text);
  }

  // Create arrows
  for (const edge of edges) {
    const fromId = nodeIdMap.get(edge.from);
    const toId = nodeIdMap.get(edge.to);
    if (!fromId || !toId) continue;

    const fromShape = elements.find((e) => e.id === fromId)!;
    const toShape = elements.find((e) => e.id === toId)!;

    // Arrow goes from center of source to center of target
    const fromCX = fromShape.x + fromShape.width / 2;
    const fromCY = fromShape.y + fromShape.height / 2;
    const toCX = toShape.x + toShape.width / 2;
    const toCY = toShape.y + toShape.height / 2;

    const result: ArrowResult = createArrow(fromCX, fromCY, toCX, toCY, {
      fromId,
      toId,
      label: edge.label,
      style: edge.style,
    });

    elements.push(result.arrow);
    if (result.label) elements.push(result.label);

    // Wire up bindings on shapes
    elements = setupArrowBindings(result.arrow.id, fromId, toId, elements);
  }

  return { elements, nodeIdMap };
}

// === Position Computation ===

interface Point {
  x: number;
  y: number;
}

function computePositions(
  nodes: NodeSpec[],
  type: string,
  spacing: number,
  columns?: number,
): Point[] {
  switch (type) {
    case "horizontal-flow":
      return horizontalFlow(nodes, spacing);
    case "grid":
      return gridLayout(nodes, spacing, columns ?? DEFAULT_COLUMNS);
    default:
      return verticalFlow(nodes, spacing);
  }
}

/**
 * Vertical flow: nodes stacked top-to-bottom, centered horizontally.
 */
function verticalFlow(nodes: NodeSpec[], spacing: number): Point[] {
  const positions: Point[] = [];
  let y = 0;

  for (const node of nodes) {
    // Estimate width for centering (nodes are centered at x=0)
    const estWidth = estimateNodeWidth(node);
    positions.push({ x: -estWidth / 2, y });
    y += estimateNodeHeight(node) + spacing;
  }

  return positions;
}

/**
 * Horizontal flow: nodes in a left-to-right row.
 */
function horizontalFlow(nodes: NodeSpec[], spacing: number): Point[] {
  const positions: Point[] = [];
  let x = 0;

  for (const node of nodes) {
    const estHeight = estimateNodeHeight(node);
    positions.push({ x, y: -estHeight / 2 });
    x += estimateNodeWidth(node) + spacing;
  }

  return positions;
}

/**
 * Grid: nodes in an N-column grid.
 */
function gridLayout(nodes: NodeSpec[], spacing: number, columns: number): Point[] {
  const positions: Point[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    positions.push({
      x: col * (200 + spacing),
      y: row * (120 + spacing),
    });
  }

  return positions;
}

// === Size Estimation ===

import { measureText, CONTAINER_PADDING } from "./text.js";

function estimateNodeWidth(node: NodeSpec): number {
  if (!node.text) return 100;
  const metrics = measureText(node.text, node.style?.fontSize ?? 20, node.style?.fontFamily ?? 1);
  const base = metrics.width + CONTAINER_PADDING * 2;
  if (node.type === "ellipse") return base * 1.2;
  if (node.type === "diamond") return base * 1.5;
  return base;
}

function estimateNodeHeight(node: NodeSpec): number {
  if (!node.text) return 100;
  const metrics = measureText(node.text, node.style?.fontSize ?? 20, node.style?.fontFamily ?? 1);
  const base = metrics.height + CONTAINER_PADDING * 2;
  if (node.type === "ellipse") return base * 1.2;
  if (node.type === "diamond") return base * 1.5;
  return base;
}
