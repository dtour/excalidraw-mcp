import type {
  ExcalidrawElement,
  GraphSummary,
  GraphNode,
  GraphEdge,
  GraphGroup,
  OtherElement,
  FileFormat,
} from "../types/index.js";

/** Shape types that become graph nodes */
const NODE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);

/** Types that are neither nodes nor edges – reported in `other` */
const OTHER_TYPES = new Set(["freedraw", "image", "frame"]);

/**
 * Convert an ExcalidrawElement array to a GraphSummary.
 *
 * Mapping rules:
 * - rectangle/ellipse/diamond -> nodes
 * - arrows with startBinding + endBinding -> edges
 * - text with containerId -> merged into parent node's text field
 * - standalone text (no container) -> nodes with type "text"
 * - lines without bindings -> other
 * - freedraw/image/frame -> other
 * - groups -> extracted from groupIds
 */
export function toGraphSummary(
  elements: ExcalidrawElement[],
  format: FileFormat,
): GraphSummary {
  const liveElements = elements.filter((e) => !e.isDeleted);
  const elementMap = new Map(liveElements.map((e) => [e.id, e]));

  // Collect bound text -> container mapping
  const boundTextMap = new Map<string, string>(); // textId -> containerId
  for (const el of liveElements) {
    if (el.type === "text" && el.containerId) {
      boundTextMap.set(el.id, el.containerId);
    }
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const other: OtherElement[] = [];
  const groupMap = new Map<string, Set<string>>();

  for (const el of liveElements) {
    // Skip bound text – it's merged into its container's node
    if (el.type === "text" && el.containerId) {
      continue;
    }

    // Collect group memberships
    for (const gid of el.groupIds) {
      if (!groupMap.has(gid)) groupMap.set(gid, new Set());
      groupMap.get(gid)!.add(el.id);
    }

    if (NODE_TYPES.has(el.type)) {
      // Find bound text for this node
      const boundText = liveElements.find(
        (t) => t.type === "text" && t.containerId === el.id,
      );

      nodes.push({
        id: el.id,
        type: el.type,
        text: boundText?.text ?? "",
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        style: extractStyle(el),
      });
    } else if (el.type === "arrow" && (el.startBinding || el.endBinding)) {
      // Arrow with at least one binding -> edge
      const from = el.startBinding?.elementId ?? "";
      const to = el.endBinding?.elementId ?? "";

      // Find bound text for arrow label
      const arrowLabel = liveElements.find(
        (t) => t.type === "text" && t.containerId === el.id,
      );

      edges.push({
        id: el.id,
        from,
        to,
        label: arrowLabel?.text ?? "",
        style: extractStyle(el),
      });
    } else if (el.type === "text") {
      // Standalone text (not bound to any container)
      nodes.push({
        id: el.id,
        type: "text",
        text: el.text ?? "",
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        style: extractStyle(el),
      });
    } else if (el.type === "line" || el.type === "arrow") {
      // Unbound line or arrow -> other
      other.push({
        id: el.id,
        type: el.type,
        description: el.type === "arrow" ? "unbound arrow" : "decorative line",
      });
    } else if (OTHER_TYPES.has(el.type)) {
      other.push({
        id: el.id,
        type: el.type,
        description: describeOther(el),
      });
    }
  }

  // Build groups
  const groups: GraphGroup[] = [];
  for (const [gid, memberIds] of groupMap) {
    groups.push({
      id: gid,
      label: "",
      memberIds: [...memberIds],
    });
  }

  // Compute bounding box
  const bbox = computeBoundingBox(liveElements);

  return {
    nodes,
    edges,
    groups,
    other,
    metadata: {
      format,
      elementCount: liveElements.length,
      boundingBox: bbox,
    },
  };
}

// === Helpers ===

function extractStyle(el: ExcalidrawElement) {
  return {
    strokeColor: el.strokeColor,
    backgroundColor: el.backgroundColor,
    fillStyle: el.fillStyle,
    strokeWidth: el.strokeWidth,
    strokeStyle: el.strokeStyle,
    roughness: el.roughness,
    opacity: el.opacity,
  };
}

function describeOther(el: ExcalidrawElement): string {
  switch (el.type) {
    case "freedraw":
      return "freehand drawing";
    case "image":
      return `embedded image (${el.width}x${el.height})`;
    case "frame":
      return `frame: ${el.name ?? "unnamed"}`;
    default:
      return el.type;
  }
}

function computeBoundingBox(elements: ExcalidrawElement[]) {
  if (elements.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
