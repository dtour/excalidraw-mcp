import { z } from "zod";

// === Style Schema ===

export const nodeStyleSchema = z.object({
  strokeColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  fillStyle: z.enum(["solid", "hachure", "cross-hatch", "dots"]).optional(),
  strokeWidth: z.number().optional(),
  strokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
  roughness: z.number().optional(),
  opacity: z.number().min(0).max(100).optional(),
  fontSize: z.number().optional(),
  fontFamily: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
}).strict();

// === Position Schema ===

export const absolutePositionSchema = z.object({
  type: z.literal("absolute"),
  x: z.number(),
  y: z.number(),
});

export const relativePositionSchema = z.object({
  type: z.literal("relative"),
  anchor: z.string().describe("Element ID or text to position relative to"),
  direction: z.enum(["above", "below", "left", "right"]),
  gap: z.number().optional().describe("Gap in pixels (default: 80)"),
});

export const positionSchema = z.discriminatedUnion("type", [
  absolutePositionSchema,
  relativePositionSchema,
]);

// === Node & Edge Specs ===

export const nodeSpecSchema = z.object({
  type: z.enum(["rectangle", "ellipse", "diamond"]).optional().default("rectangle"),
  text: z.string(),
  style: nodeStyleSchema.optional(),
});

export const edgeSpecSchema = z.object({
  from: z.string().describe("Node text or index (e.g. '0', '1')"),
  to: z.string().describe("Node text or index (e.g. '0', '1')"),
  label: z.string().optional(),
  style: nodeStyleSchema.optional(),
});

// === Layout Schema ===

export const layoutSchema = z.object({
  type: z.enum(["vertical-flow", "horizontal-flow", "grid"]).default("vertical-flow"),
  spacing: z.number().optional().describe("Gap between elements in pixels (default: 80)"),
  columns: z.number().optional().describe("Number of columns for grid layout"),
});

// === Create Diagram Spec ===

export const createHighLevelSchema = z.object({
  nodes: z.array(nodeSpecSchema).min(1),
  edges: z.array(edgeSpecSchema).optional().default([]),
  layout: layoutSchema.optional(),
});

export const createLowLevelSchema = z.object({
  elements: z.array(z.record(z.unknown())).min(1),
});

export const createSpecSchema = z.union([createHighLevelSchema, createLowLevelSchema]);

// === Modify Operations ===

export const changeTextOpSchema = z.object({
  type: z.literal("change_text"),
  target: z.string().describe("Element ID or text content to match"),
  text: z.string().describe("New text content"),
});

export const addNodeOpSchema = z.object({
  type: z.literal("add_node"),
  spec: nodeSpecSchema,
  position: positionSchema,
});

export const removeOpSchema = z.object({
  type: z.literal("remove"),
  target: z.string().describe("Element ID or text content to match"),
});

export const connectOpSchema = z.object({
  type: z.literal("connect"),
  from: z.string().describe("Source element ID or text"),
  to: z.string().describe("Target element ID or text"),
  label: z.string().optional(),
});

export const disconnectOpSchema = z.object({
  type: z.literal("disconnect"),
  from: z.string().describe("Source element ID or text"),
  to: z.string().describe("Target element ID or text"),
});

export const restyleOpSchema = z.object({
  type: z.literal("restyle"),
  target: z.string().describe("Element ID or text content to match"),
  style: nodeStyleSchema,
});

export const repositionOpSchema = z.object({
  type: z.literal("reposition"),
  target: z.string().describe("Element ID or text content to match"),
  position: positionSchema,
});

export const modifyOperationSchema = z.discriminatedUnion("type", [
  changeTextOpSchema,
  addNodeOpSchema,
  removeOpSchema,
  connectOpSchema,
  disconnectOpSchema,
  restyleOpSchema,
  repositionOpSchema,
]);

// === Tool Input Schemas ===

export const readDiagramInputSchema = z.object({
  path: z.string().describe("Path to the .excalidraw or .excalidraw.md file"),
});

export const createDiagramInputSchema = z.object({
  path: z.string().describe("Output path (.excalidraw or .excalidraw.md)"),
  spec: createSpecSchema,
});

export const modifyDiagramInputSchema = z.object({
  path: z.string().describe("Path to the existing diagram file"),
  operations: z.array(modifyOperationSchema).min(1),
});

export const renderDiagramInputSchema = z.object({
  path: z.string().describe("Path to the diagram file to render"),
  format: z.enum(["svg", "png"]).optional().default("svg"),
  scale: z.number().min(0.1).max(4).optional().default(1),
});
