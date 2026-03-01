# excalidraw-mcp

A file-based [MCP server](https://modelcontextprotocol.io) that makes Excalidraw diagrams a first-class data type for LLMs. The server owns all spatial reasoning – coordinate math, element bindings, text measurement, overlap detection – so the LLM operates purely at the semantic level of nodes and edges.

Supports both `.excalidraw` (raw JSON) and `.excalidraw.md` (Obsidian plugin format with LZ-String compression).

**Best suited for:** flowcharts, state machines, ER diagrams, architecture diagrams, and other graph-shaped diagrams – rectangles, ellipses, and diamonds connected by arrows.

**Not suited for:** wireframes, freeform sketches, annotated screenshots, or spatial layouts where precise pixel positioning matters more than connectivity. These elements are still readable via `read_diagram` (they appear in the `other` bucket) but cannot be created through the semantic API.

## Install

```bash
bun add excalidraw-mcp
```

Or build from source:

```bash
git clone https://github.com/dtour/excalidraw-mcp.git
cd excalidraw-mcp
bun install && bun run build
```

For PNG rendering support (optional – SVG works out of the box):

```bash
bun add @resvg/resvg-js
```

## Configure

**Claude Code** (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "bunx",
      "args": ["excalidraw-mcp"]
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "bunx",
      "args": ["excalidraw-mcp"]
    }
  }
}
```

Or point directly to a local build:

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "node",
      "args": ["/path/to/excalidraw-mcp/dist/index.js"]
    }
  }
}
```

## Tools

### `read_diagram`

Parse any Excalidraw file and return a semantic **GraphSummary**.

```json
{ "path": "./diagram.excalidraw" }
```

Returns nodes, edges, groups, and an `other` bucket for non-graph elements (freehand, images, frames) – everything the LLM needs to reason about the diagram's structure:

```json
{
  "nodes": [
    { "id": "abc123", "type": "rectangle", "text": "API Gateway", "x": 100, "y": 50, "width": 180, "height": 60 }
  ],
  "edges": [
    { "id": "def456", "from": "abc123", "to": "ghi789", "label": "REST" }
  ],
  "groups": [],
  "other": [],
  "boundingBox": { "x": 50, "y": 20, "width": 600, "height": 400 }
}
```

---

### `create_diagram`

Create a new diagram from a declarative spec. The server handles coordinates, layout, bindings, and IDs. Output format is determined by file extension.

```json
{
  "path": "./flowchart.excalidraw",
  "spec": {
    "nodes": [
      { "type": "rectangle", "text": "Start" },
      { "type": "diamond", "text": "Decision?" },
      { "type": "rectangle", "text": "End" }
    ],
    "edges": [
      { "from": "Start", "to": "Decision?" },
      { "from": "Decision?", "to": "End", "label": "yes" }
    ],
    "layout": { "type": "vertical-flow", "spacing": 100 }
  }
}
```

Three layout algorithms are available:

| Layout | Description |
|---|---|
| `vertical-flow` | Nodes stacked top to bottom (default) |
| `horizontal-flow` | Nodes arranged left to right |
| `grid` | N-column grid (set `columns` to configure) |

A **low-level escape hatch** is available for pixel-precise control:

```json
{
  "path": "./precise.excalidraw",
  "spec": {
    "elements": [{ "type": "rectangle", "x": 100, "y": 100, "width": 200, "height": 80 }]
  }
}
```

---

### `modify_diagram`

Apply semantic operations to an existing diagram. All operations are **atomic** – if any fails, no changes are written.

```json
{
  "path": "./flowchart.excalidraw",
  "operations": [
    { "type": "change_text", "target": "Start", "text": "Begin" },
    {
      "type": "add_node",
      "spec": { "type": "rectangle", "text": "Retry" },
      "position": { "type": "relative", "anchor": "End", "direction": "below" }
    },
    { "type": "connect", "from": "End", "to": "Retry" },
    {
      "type": "restyle",
      "target": "Decision?",
      "style": { "backgroundColor": "#ffc9c9", "fillStyle": "solid" }
    }
  ]
}
```

Seven operations:

| Operation | Description |
|---|---|
| `change_text` | Update an element's text content |
| `add_node` | Create a new shape with absolute or relative positioning |
| `remove` | Delete an element and clean up all bindings |
| `connect` | Create an arrow between two elements |
| `disconnect` | Remove an arrow connection |
| `restyle` | Update visual properties (colors, stroke, fill, opacity) |
| `reposition` | Move an element to absolute coordinates or relative to another |

Target elements by **ID** or **text content**. If a text match is ambiguous (multiple elements share the same text), the server returns an error listing all candidates with their IDs so the LLM can disambiguate – it never silently picks the first match.

**Relative positioning** lets you place nodes relative to existing elements:

```json
{ "type": "relative", "anchor": "Error", "direction": "right", "gap": 120 }
```

Directions: `above`, `below`, `left`, `right`. Default gap is 80px.

---

### `render_diagram`

Render to SVG (built-in, no dependencies) or PNG (requires optional `@resvg/resvg-js`).

```json
{ "path": "./flowchart.excalidraw", "format": "svg", "scale": 1.5 }
```

Returns an inline image so the LLM can visually verify its work. The built-in SVG renderer is useful for checking topology (are the right things connected?) but does not match Excalidraw's full visual fidelity – no roughness textures or hachure fills.

## Style Reference

All style properties are optional and can be used with `create_diagram` node specs or `modify_diagram`'s `restyle` operation.

| Property | Values | Default |
|---|---|---|
| `strokeColor` | Any CSS color | `#1e1e1e` |
| `backgroundColor` | Any CSS color or `transparent` | `transparent` |
| `fillStyle` | `solid`, `hachure`, `cross-hatch`, `dots` | `hachure` |
| `strokeWidth` | Number (px) | `2` |
| `strokeStyle` | `solid`, `dashed`, `dotted` | `solid` |
| `roughness` | `0` precise, `1` normal, `2` rough | `1` |
| `opacity` | `0`–`100` | `100` |
| `fontSize` | Number (px) | `20` |
| `fontFamily` | `1` Excalifont, `2` Nunito, `3` Cascadia, `4` Liberation Sans, `5` CJK | `1` |

## Resource

### `excalidraw://schema`

Element type definitions, valid style properties, layout types, operation types, and example specs. MCP clients can load this on demand for validation and autocompletion.

## Architecture

```
src/
├── index.ts                # MCP server entry, tool registration
├── schemas/spec.ts         # Zod input validation
├── tools/
│   ├── read.ts             # read_diagram
│   ├── create.ts           # create_diagram
│   ├── modify.ts           # modify_diagram
│   └── render.ts           # render_diagram
├── core/
│   ├── bindings.ts         # Binding integrity engine
│   ├── elements.ts         # Element factories (rect, ellipse, diamond, arrow)
│   ├── graph.ts            # Raw elements → GraphSummary
│   ├── ids.ts              # ID, seed, and nonce generation
│   ├── layout.ts           # Auto-layout algorithms
│   ├── overlap.ts          # Text–line overlap detection and nudging
│   ├── parser.ts           # Format detection, .excalidraw / .excalidraw.md parsing
│   ├── resolve-target.ts   # Target resolution with disambiguation errors
│   ├── serializer.ts       # Serialization (JSON + LZ-String)
│   └── text.ts             # Text measurement (character-width averages)
└── types/index.ts          # TypeScript type definitions
```

### Design decisions

- **GraphSummary abstraction** – the LLM sees a semantic graph (nodes, edges, groups), not raw Excalidraw elements. Non-graph elements like freehand drawings and images land in the `other` bucket, preserving round-trip fidelity.
- **Binding integrity engine** – Excalidraw uses bidirectional references between arrows and shapes. The engine validates and repairs these after every mutation, preventing orphaned or dangling bindings.
- **Atomic writes** – files are written via temp file + `rename(2)`, so a crash mid-write never corrupts the original.
- **Text measurement without native deps** – pre-computed character-width tables for all five Excalidraw font families. Intentionally over-estimates by ~15% so containers never clip; Excalidraw recalculates precisely on load.

## Development

```bash
bun install          # Install dependencies
bun test             # Run all tests (unit + property-based + integration)
bun run typecheck    # Type-check without emitting
bun run dev          # Run server directly
bun run build        # Build to dist/
```

Tests use `bun:test` with [`fast-check`](https://github.com/dubzzz/fast-check) for property-based testing of the binding integrity engine and overlap resolution.

## Known Limitations

- **Text sizing is approximate** – character-width averages mean diagrams reflow slightly when opened in Excalidraw. Opening and saving in Excalidraw recalculates text metrics.
- **Straight-line arrow routing** – arrows use direct point-to-point paths. Excalidraw applies its own curve routing when you open the file.
- **No appState/files round-trip** – viewport position, theme, and embedded images are not preserved through edits.
- **No concurrency handling** – concurrent writes to the same file use last-writer-wins semantics.
- **SVG renderer is simplified** – useful for topology verification but does not reproduce Excalidraw's roughness textures or hachure fills.

## License

[MIT](LICENSE)
