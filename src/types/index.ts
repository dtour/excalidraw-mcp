// === Excalidraw Element Types ===

export type ExcalidrawElementType =
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "text"
  | "freedraw"
  | "image"
  | "frame";

export type StrokeStyle = "solid" | "dashed" | "dotted";
export type FillStyle = "solid" | "hachure" | "cross-hatch" | "dots";
export type TextAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";
export type RoundnessType = 1 | 2 | 3; // 1=legacy, 2=proportional, 3=adaptive
export type ArrowheadType = "arrow" | "bar" | "dot" | "triangle" | null;
export type FontFamily = 1 | 2 | 3 | 4 | 5; // 1=Excalifont, 2=Nunito, 3=Cascadia, 4=Liberation, 5=Chinese/Japanese/Korean

export interface BoundElement {
  id: string;
  type: "arrow" | "text";
}

export interface Binding {
  elementId: string;
  focus: number;
  gap: number;
  fixedPoint: [number, number] | null;
}

export interface ExcalidrawElement {
  id: string;
  type: ExcalidrawElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  seed: number;
  version: number;
  versionNonce: number;
  updated: number;
  isDeleted: boolean;
  groupIds: string[];
  frameId: string | null;
  boundElements: BoundElement[] | null;
  link: string | null;
  locked: boolean;
  roundness: { type: RoundnessType; value?: number } | null;

  // Text-specific
  text?: string;
  fontSize?: number;
  fontFamily?: FontFamily;
  textAlign?: TextAlign;
  verticalAlign?: VerticalAlign;
  containerId?: string | null;
  originalText?: string;
  autoResize?: boolean;
  lineHeight?: number;

  // Arrow/line-specific
  points?: [number, number][];
  startBinding?: Binding | null;
  endBinding?: Binding | null;
  startArrowhead?: ArrowheadType;
  endArrowhead?: ArrowheadType;
  lastCommittedPoint?: [number, number] | null;

  // Image-specific
  fileId?: string;
  status?: string;
  scale?: [number, number];

  // Frame-specific
  name?: string | null;
}

// === AppState (preserved on roundtrip) ===

export interface AppState {
  gridSize: number | null;
  gridStep: number;
  gridModeEnabled: boolean;
  viewBackgroundColor: string;
  theme?: string;
  [key: string]: unknown;
}

// === Files (embedded images, preserved on roundtrip) ===

export interface ExcalidrawFile {
  mimeType: string;
  id: string;
  dataURL: string;
  created: number;
  lastRetrieved?: number;
}

// === Top-level Excalidraw document ===

export interface ExcalidrawDocument {
  type: "excalidraw";
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState: AppState;
  files: Record<string, ExcalidrawFile>;
}

// === GraphSummary (semantic representation for LLMs) ===

export interface NodeStyle {
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: FillStyle;
  strokeWidth?: number;
  strokeStyle?: StrokeStyle;
  roughness?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: FontFamily;
}

export interface GraphNode {
  id: string;
  type: ExcalidrawElementType;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: NodeStyle;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  style: NodeStyle;
}

export interface GraphGroup {
  id: string;
  label: string;
  memberIds: string[];
}

/** Elements that don't fit the node/edge/group abstraction */
export interface OtherElement {
  id: string;
  type: ExcalidrawElementType;
  description: string;
}

export interface GraphSummary {
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  other: OtherElement[];
  metadata: {
    format: "excalidraw" | "excalidraw.md";
    elementCount: number;
    boundingBox: { x: number; y: number; width: number; height: number };
  };
}

// === Tool Input Types ===

export type LayoutType = "vertical-flow" | "horizontal-flow" | "grid";

export interface LayoutConfig {
  type: LayoutType;
  spacing?: number;
  columns?: number; // only for grid
}

export interface NodeSpec {
  type?: "rectangle" | "ellipse" | "diamond";
  text: string;
  style?: NodeStyle;
}

export interface EdgeSpec {
  from: string; // text or index reference
  to: string;
  label?: string;
  style?: NodeStyle;
}

export interface CreateHighLevelSpec {
  nodes: NodeSpec[];
  edges?: EdgeSpec[];
  layout?: LayoutConfig;
}

export interface CreateLowLevelSpec {
  elements: Partial<ExcalidrawElement>[];
}

export type CreateSpec = CreateHighLevelSpec | CreateLowLevelSpec;

export function isHighLevelSpec(spec: CreateSpec): spec is CreateHighLevelSpec {
  return "nodes" in spec;
}

// === Modify Operations ===

export type ModifyOperation =
  | { type: "change_text"; target: string; text: string }
  | { type: "add_node"; spec: NodeSpec; position: Position }
  | { type: "remove"; target: string }
  | { type: "connect"; from: string; to: string; label?: string }
  | { type: "disconnect"; from: string; to: string }
  | { type: "restyle"; target: string; style: NodeStyle }
  | { type: "reposition"; target: string; position: Position };

export type Position =
  | { type: "absolute"; x: number; y: number }
  | { type: "relative"; anchor: string; direction: "above" | "below" | "left" | "right"; gap?: number };

// === File format detection ===

export type FileFormat = "excalidraw" | "excalidraw.md";

export interface ParsedFile {
  document: ExcalidrawDocument;
  format: FileFormat;
  /** For .excalidraw.md, the original markdown template */
  markdownTemplate?: string;
}
