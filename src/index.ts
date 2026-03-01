#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readDiagram } from "./tools/read.js";
import { createDiagram } from "./tools/create.js";
import { modifyDiagram } from "./tools/modify.js";
import { renderDiagram } from "./tools/render.js";
import {
  readDiagramInputSchema,
  createDiagramInputSchema,
  modifyDiagramInputSchema,
  renderDiagramInputSchema,
} from "./schemas/spec.js";

const server = new McpServer({
  name: "excalidraw-mcp",
  version: "0.1.0",
});

// === Tool: read_diagram ===

server.tool(
  "read_diagram",
  "Read an Excalidraw diagram and return its GraphSummary (nodes, edges, groups). Supports .excalidraw and .excalidraw.md.",
  readDiagramInputSchema.shape,
  async (params) => {
    try {
      const validated = readDiagramInputSchema.parse(params);
      const result = await readDiagram(validated);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.summary, null, 2),
          },
        ],
      };
    } catch (err) {
      return errorResult(err);
    }
  },
);

// === Tool: create_diagram ===

server.tool(
  "create_diagram",
  "Create a new Excalidraw diagram from nodes/edges. Read excalidraw://schema for spec format.",
  createDiagramInputSchema.shape,
  async (params) => {
    try {
      const validated = createDiagramInputSchema.parse(params);
      const result = await createDiagram(validated);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { path: result.path, summary: result.summary },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return errorResult(err);
    }
  },
);

// === Tool: modify_diagram ===

server.tool(
  "modify_diagram",
  "Apply atomic operations to an existing diagram. Target elements by ID or text. Read excalidraw://schema for operations.",
  modifyDiagramInputSchema.shape,
  async (params) => {
    try {
      const validated = modifyDiagramInputSchema.parse(params);
      const result = await modifyDiagram(validated);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                operationsApplied: result.operationsApplied,
                summary: result.summary,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return errorResult(err);
    }
  },
);

// === Tool: render_diagram ===

server.tool(
  "render_diagram",
  "Render an Excalidraw diagram to SVG or PNG. Returns an inline image.",
  renderDiagramInputSchema.shape,
  async (params) => {
    try {
      const validated = renderDiagramInputSchema.parse(params);
      const result = await renderDiagram(validated);
      if (result.isBase64) {
        return {
          content: [
            {
              type: "image" as const,
              data: result.data,
              mimeType: result.mimeType,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: result.data,
          },
        ],
      };
    } catch (err) {
      return errorResult(err);
    }
  },
);

// === Resource: excalidraw://schema ===

server.resource(
  "schema",
  "excalidraw://schema",
  {
    description:
      "Excalidraw element type definitions, valid style properties, and create_diagram spec format.",
    mimeType: "application/json",
  },
  async () => ({
    contents: [
      {
        uri: "excalidraw://schema",
        mimeType: "application/json",
        text: JSON.stringify(SCHEMA_REFERENCE, null, 2),
      },
    ],
  }),
);

// === Start Server ===

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start excalidraw-mcp:", err);
  process.exit(1);
});

// === Helpers ===

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

const SCHEMA_REFERENCE = {
  elementTypes: ["rectangle", "ellipse", "diamond", "arrow", "text", "line", "freedraw", "image", "frame"],
  nodeTypes: ["rectangle", "ellipse", "diamond"],
  styleProperties: {
    strokeColor: "CSS color string (default: '#1e1e1e')",
    backgroundColor: "CSS color string or 'transparent'",
    fillStyle: "solid | hachure | cross-hatch | dots",
    strokeWidth: "number (default: 2)",
    strokeStyle: "solid | dashed | dotted",
    roughness: "0 (precise) | 1 (normal) | 2 (rough)",
    opacity: "0-100 (default: 100)",
    fontSize: "number in pixels (default: 20)",
    fontFamily: "1=Excalifont | 2=Nunito | 3=Cascadia | 4=Liberation | 5=CJK",
  },
  layoutTypes: ["vertical-flow", "horizontal-flow", "grid"],
  operationTypes: [
    "change_text",
    "add_node",
    "remove",
    "connect",
    "disconnect",
    "restyle",
    "reposition",
  ],
  createSpecExample: {
    nodes: [
      { type: "rectangle", text: "Start" },
      { type: "diamond", text: "Decision?" },
      { type: "rectangle", text: "End" },
    ],
    edges: [
      { from: "Start", to: "Decision?" },
      { from: "Decision?", to: "End", label: "yes" },
    ],
    layout: { type: "vertical-flow", spacing: 100 },
  },
  modifyExample: {
    operations: [
      { type: "change_text", target: "Start", text: "Begin" },
      {
        type: "add_node",
        spec: { type: "rectangle", text: "New Step" },
        position: { type: "relative", anchor: "End", direction: "below" },
      },
      { type: "connect", from: "End", to: "New Step" },
      {
        type: "restyle",
        target: "Decision?",
        style: { backgroundColor: "#ffc9c9", fillStyle: "solid" },
      },
    ],
  },
};
