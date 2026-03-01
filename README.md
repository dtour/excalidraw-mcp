# excalidraw-mcp

A file-based MCP server that makes Excalidraw diagrams a first-class data type for LLMs. The MCP owns all spatial reasoning, coordinate math, and internal consistency – the LLM operates at the semantic level.

Supports both `.excalidraw` (raw JSON) and `.excalidraw.md` (Obsidian plugin format with LZ-String compression).

**Best suited for:** flowcharts, state machines, ER diagrams, architecture diagrams, and other graph-shaped diagrams (nodes connected by edges). The semantic abstraction works with rectangle, ellipse, and diamond shapes connected by arrows.

**Not suited for:** wireframes, freeform sketches, annotated screenshots, or spatial layouts where precise positioning matters more than connectivity. These elements are readable via `read_diagram` (they appear in the `other` bucket) but cannot be created or meaningfully modified through the semantic API.

## Install

```bash
bun install
bun run build
```

## Configure

Add to your MCP client config (e.g. Claude Code's `~/.claude/settings.json`):

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

Or run directly with bun during development:

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "bun",
      "args": ["/path/to/excalidraw-mcp/src/index.ts"]
    }
  }
}
```

## Tools

### `read_diagram`

Parse any Excalidraw format and return a semantic GraphSummary.

```json
{ "path": "./diagram.excalidraw" }
```

Returns nodes, edges, groups, and metadata – everything the LLM needs to reason about the diagram's structure.

### `create_diagram`

Create a new diagram from a declarative spec. The MCP handles coordinates, layout, bindings, and IDs.

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

Layout types: `vertical-flow`, `horizontal-flow`, `grid`.

A low-level escape hatch is available for pixel-precise control:

```json
{
  "path": "./precise.excalidraw",
  "spec": {
    "elements": [{ "type": "rectangle", "x": 100, "y": 100, "width": 200, "height": 80 }]
  }
}
```

### `modify_diagram`

Apply semantic operations atomically – if any operation fails, no changes are written.

```json
{
  "path": "./flowchart.excalidraw",
  "operations": [
    { "type": "change_text", "target": "Start", "text": "Begin" },
    {
      "type": "add_node",
      "spec": { "type": "rectangle", "text": "New Step" },
      "position": { "type": "relative", "anchor": "End", "direction": "below" }
    },
    { "type": "connect", "from": "End", "to": "New Step" },
    {
      "type": "restyle",
      "target": "Decision?",
      "style": { "backgroundColor": "#ffc9c9", "fillStyle": "solid" }
    }
  ]
}
```

Operations: `change_text`, `add_node`, `remove`, `connect`, `disconnect`, `restyle`, `reposition`.

Target elements by ID or text content. Ambiguous text matches produce an error with disambiguation guidance.

### `render_diagram`

Render to SVG (built-in, no dependencies) or PNG (requires optional `@resvg/resvg-js`).

```json
{ "path": "./flowchart.excalidraw", "format": "svg", "scale": 1.5 }
```

Returns an inline image so the LLM can visually verify its work.

## Resource

### `excalidraw://schema`

Element type definitions, valid style properties, layout types, and spec format examples. Loaded on-demand by the client.

## Development

```bash
bun test           # Run tests
bun run typecheck  # TypeScript checking
bun run dev        # Run server directly
bun run build      # Build for distribution
```

## Known Limitations

- **Text measurement** uses character-width averages; diagrams reflow slightly when opened in Excalidraw. *Workaround:* opening and saving in Excalidraw recalculates text metrics.
- **No appState/files round-trip** – viewport position, theme, and embedded images are not preserved. *Workaround:* set these manually in Excalidraw after generation.
- **Straight-line arrow routing** – arrows use direct point-to-point paths. *Workaround:* Excalidraw applies its own curve routing when you open the file.
- **No concurrency handling** – last writer wins if the file is edited simultaneously.
- **PNG rendering** requires the optional `@resvg/resvg-js` package. Falls back to SVG if unavailable.
- **SVG renderer is simplified** – useful for checking topology (are the right things connected?) but does not match Excalidraw's visual fidelity (no roughness, no hachure fills).

## License

[MIT](LICENSE)
