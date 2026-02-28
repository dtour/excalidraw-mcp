import type {
  ExcalidrawElement,
  ExcalidrawElementType,
  NodeSpec,
  NodeStyle,
  FontFamily,
  Binding,
} from "../types/index.js";
import { generateId, generateSeed, generateVersionNonce } from "./ids.js";
import { measureText, getLineHeight, CONTAINER_PADDING } from "./text.js";

/**
 * Excalidraw format version we target.
 * Version 2 is the current stable format used by Excalidraw.
 */
export const TARGET_FORMAT_VERSION = 2;

/**
 * Base element with all common defaults.
 * Every element gets these properties; type-specific factories override as needed.
 */
function baseElement(overrides: Partial<ExcalidrawElement> = {}): ExcalidrawElement {
  const now = Date.now();
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
    updated: now,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    link: null,
    locked: false,
    roundness: { type: 3 },
    ...overrides,
  };
}

/**
 * Apply user style overrides to element defaults.
 */
function applyStyle(el: ExcalidrawElement, style?: NodeStyle): ExcalidrawElement {
  if (!style) return el;
  return {
    ...el,
    ...(style.strokeColor !== undefined && { strokeColor: style.strokeColor }),
    ...(style.backgroundColor !== undefined && { backgroundColor: style.backgroundColor }),
    ...(style.fillStyle !== undefined && { fillStyle: style.fillStyle }),
    ...(style.strokeWidth !== undefined && { strokeWidth: style.strokeWidth }),
    ...(style.strokeStyle !== undefined && { strokeStyle: style.strokeStyle }),
    ...(style.roughness !== undefined && { roughness: style.roughness }),
    ...(style.opacity !== undefined && { opacity: style.opacity }),
  };
}

// === Shape Factories ===

export interface ShapeResult {
  /** The container shape element */
  shape: ExcalidrawElement;
  /** The bound text element (if text was provided) */
  text: ExcalidrawElement | null;
}

/**
 * Create a rectangle element with optional bound text.
 */
export function createRectangle(
  x: number,
  y: number,
  text: string,
  style?: NodeStyle,
): ShapeResult {
  const fontSize = style?.fontSize ?? 20;
  const fontFamily = style?.fontFamily ?? 1;
  const textMetrics = text ? measureText(text, fontSize, fontFamily) : { width: 0, height: 0 };

  const width = text ? textMetrics.width + CONTAINER_PADDING * 2 : 100;
  const height = text ? textMetrics.height + CONTAINER_PADDING * 2 : 100;

  const shapeId = generateId();
  const shape = applyStyle(
    baseElement({
      id: shapeId,
      type: "rectangle",
      x,
      y,
      width,
      height,
      roundness: { type: 3 },
    }),
    style,
  );

  if (!text) {
    return { shape, text: null };
  }

  const textEl = createBoundText(shapeId, x, y, width, height, text, fontSize, fontFamily);

  // Wire up the container -> text binding
  shape.boundElements = [{ id: textEl.id, type: "text" }];

  return { shape, text: textEl };
}

/**
 * Create an ellipse element with optional bound text.
 */
export function createEllipse(
  x: number,
  y: number,
  text: string,
  style?: NodeStyle,
): ShapeResult {
  const fontSize = style?.fontSize ?? 20;
  const fontFamily = style?.fontFamily ?? 1;
  const textMetrics = text ? measureText(text, fontSize, fontFamily) : { width: 0, height: 0 };

  // Ellipses need extra space for text to fit within the curved boundary
  const width = text ? (textMetrics.width + CONTAINER_PADDING * 2) * 1.2 : 100;
  const height = text ? (textMetrics.height + CONTAINER_PADDING * 2) * 1.2 : 100;

  const shapeId = generateId();
  const shape = applyStyle(
    baseElement({
      id: shapeId,
      type: "ellipse",
      x,
      y,
      width,
      height,
      roundness: { type: 2 },
    }),
    style,
  );

  if (!text) {
    return { shape, text: null };
  }

  const textEl = createBoundText(shapeId, x, y, width, height, text, fontSize, fontFamily);
  shape.boundElements = [{ id: textEl.id, type: "text" }];

  return { shape, text: textEl };
}

/**
 * Create a diamond element with optional bound text.
 */
export function createDiamond(
  x: number,
  y: number,
  text: string,
  style?: NodeStyle,
): ShapeResult {
  const fontSize = style?.fontSize ?? 20;
  const fontFamily = style?.fontFamily ?? 1;
  const textMetrics = text ? measureText(text, fontSize, fontFamily) : { width: 0, height: 0 };

  // Diamonds need significant extra space since text sits in the center
  const width = text ? (textMetrics.width + CONTAINER_PADDING * 2) * 1.5 : 100;
  const height = text ? (textMetrics.height + CONTAINER_PADDING * 2) * 1.5 : 100;

  const shapeId = generateId();
  const shape = applyStyle(
    baseElement({
      id: shapeId,
      type: "diamond",
      x,
      y,
      width,
      height,
      roundness: { type: 2 },
    }),
    style,
  );

  if (!text) {
    return { shape, text: null };
  }

  const textEl = createBoundText(shapeId, x, y, width, height, text, fontSize, fontFamily);
  shape.boundElements = [{ id: textEl.id, type: "text" }];

  return { shape, text: textEl };
}

/**
 * Create a shape from a NodeSpec.
 */
export function createShape(
  spec: NodeSpec,
  x: number,
  y: number,
): ShapeResult {
  const type = spec.type ?? "rectangle";
  switch (type) {
    case "ellipse":
      return createEllipse(x, y, spec.text, spec.style);
    case "diamond":
      return createDiamond(x, y, spec.text, spec.style);
    default:
      return createRectangle(x, y, spec.text, spec.style);
  }
}

// === Arrow Factory ===

export interface ArrowResult {
  arrow: ExcalidrawElement;
  label: ExcalidrawElement | null;
}

/**
 * Create an arrow element between two points.
 * Optionally binds to from/to elements and adds a label.
 */
export function createArrow(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  options: {
    fromId?: string;
    toId?: string;
    label?: string;
    style?: NodeStyle;
  } = {},
): ArrowResult {
  const arrowId = generateId();
  const dx = toX - fromX;
  const dy = toY - fromY;

  const arrow = applyStyle(
    baseElement({
      id: arrowId,
      type: "arrow",
      x: fromX,
      y: fromY,
      width: Math.abs(dx),
      height: Math.abs(dy),
      points: [
        [0, 0],
        [dx, dy],
      ],
      startBinding: options.fromId
        ? { elementId: options.fromId, focus: 0, gap: 1, fixedPoint: null }
        : null,
      endBinding: options.toId
        ? { elementId: options.toId, focus: 0, gap: 1, fixedPoint: null }
        : null,
      startArrowhead: null,
      endArrowhead: "arrow",
      lastCommittedPoint: null,
      roundness: { type: 2 },
    }),
    options.style,
  );

  let label: ExcalidrawElement | null = null;
  if (options.label) {
    const midX = fromX + dx / 2;
    const midY = fromY + dy / 2;
    const fontSize = options.style?.fontSize ?? 16;
    const fontFamily = options.style?.fontFamily ?? 1;
    const metrics = measureText(options.label, fontSize, fontFamily);

    label = baseElement({
      type: "text",
      x: midX - metrics.width / 2,
      y: midY - metrics.height / 2,
      width: metrics.width,
      height: metrics.height,
      text: options.label,
      originalText: options.label,
      fontSize,
      fontFamily,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: arrowId,
      autoResize: true,
      lineHeight: getLineHeight(fontFamily),
    });

    arrow.boundElements = [{ id: label.id, type: "text" }];
  }

  return { arrow, label };
}

// === Standalone Text ===

/**
 * Create a standalone (unbound) text element.
 */
export function createStandaloneText(
  x: number,
  y: number,
  text: string,
  fontSize: number = 20,
  fontFamily: FontFamily = 1,
): ExcalidrawElement {
  const metrics = measureText(text, fontSize, fontFamily);
  return baseElement({
    type: "text",
    x,
    y,
    width: metrics.width,
    height: metrics.height,
    text,
    originalText: text,
    fontSize,
    fontFamily,
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    autoResize: true,
    lineHeight: getLineHeight(fontFamily),
  });
}

// === Helpers ===

/**
 * Create a text element bound inside a container shape.
 */
function createBoundText(
  containerId: string,
  containerX: number,
  containerY: number,
  containerWidth: number,
  containerHeight: number,
  text: string,
  fontSize: number,
  fontFamily: FontFamily,
): ExcalidrawElement {
  const metrics = measureText(text, fontSize, fontFamily);
  return baseElement({
    type: "text",
    // Position text at center of container
    x: containerX + (containerWidth - metrics.width) / 2,
    y: containerY + (containerHeight - metrics.height) / 2,
    width: metrics.width,
    height: metrics.height,
    text,
    originalText: text,
    fontSize,
    fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    containerId,
    autoResize: true,
    lineHeight: getLineHeight(fontFamily),
  });
}

/**
 * Update text content on an existing element, recalculating dimensions.
 */
export function updateTextContent(
  el: ExcalidrawElement,
  newText: string,
): ExcalidrawElement {
  const fontSize = el.fontSize ?? 20;
  const fontFamily = el.fontFamily ?? 1;
  const metrics = measureText(newText, fontSize, fontFamily);

  return {
    ...el,
    text: newText,
    originalText: newText,
    width: metrics.width,
    height: metrics.height,
    version: el.version + 1,
    versionNonce: generateVersionNonce(),
    updated: Date.now(),
  };
}

/**
 * Resize a container to fit updated bound text.
 */
export function resizeContainerForText(
  container: ExcalidrawElement,
  textWidth: number,
  textHeight: number,
): ExcalidrawElement {
  let widthMultiplier = 1;
  if (container.type === "ellipse") widthMultiplier = 1.2;
  if (container.type === "diamond") widthMultiplier = 1.5;

  let heightMultiplier = 1;
  if (container.type === "ellipse") heightMultiplier = 1.2;
  if (container.type === "diamond") heightMultiplier = 1.5;

  const newWidth = (textWidth + CONTAINER_PADDING * 2) * widthMultiplier;
  const newHeight = (textHeight + CONTAINER_PADDING * 2) * heightMultiplier;

  return {
    ...container,
    width: newWidth,
    height: newHeight,
    version: container.version + 1,
    versionNonce: generateVersionNonce(),
    updated: Date.now(),
  };
}
