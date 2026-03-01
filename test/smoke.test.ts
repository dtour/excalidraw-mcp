import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const TEST_DIR = resolve(__dirname, ".tmp");
const SERVER_ENTRY = resolve(__dirname, "../src/index.ts");

let client: Client;
let transport: StdioClientTransport;

beforeEach(async () => {
  mkdirSync(TEST_DIR, { recursive: true });

  transport = new StdioClientTransport({
    command: "bun",
    args: [SERVER_ENTRY],
    stderr: "pipe",
  });

  client = new Client(
    { name: "smoke-test", version: "1.0.0" },
    { capabilities: {} },
  );

  await client.connect(transport);
});

afterEach(async () => {
  await client.close();
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("MCP server smoke test", () => {
  it("should list all 4 tools", async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "create_diagram",
      "modify_diagram",
      "read_diagram",
      "render_diagram",
    ]);
  });

  it("should create a diagram via JSON-RPC", async () => {
    const path = join(TEST_DIR, "smoke.excalidraw");
    const result = await client.callTool({
      name: "create_diagram",
      arguments: {
        path,
        spec: {
          nodes: [
            { type: "rectangle", text: "Start" },
            { type: "diamond", text: "Decision?" },
          ],
          edges: [{ from: "Start", to: "Decision?" }],
          layout: { type: "vertical-flow" },
        },
      },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const body = JSON.parse(content[0].text);
    expect(body.summary.nodes).toHaveLength(2);
    expect(body.summary.edges).toHaveLength(1);
    expect(existsSync(path)).toBe(true);
  });

  it("should read back a created diagram", async () => {
    const path = join(TEST_DIR, "smoke-read.excalidraw");

    await client.callTool({
      name: "create_diagram",
      arguments: {
        path,
        spec: { nodes: [{ text: "Hello" }] },
      },
    });

    const result = await client.callTool({
      name: "read_diagram",
      arguments: { path },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const summary = JSON.parse(content[0].text);
    expect(summary.nodes).toHaveLength(1);
    expect(summary.nodes[0].text).toBe("Hello");
  });

  it("should render a diagram to SVG", async () => {
    const path = join(TEST_DIR, "smoke-render.excalidraw");

    await client.callTool({
      name: "create_diagram",
      arguments: {
        path,
        spec: { nodes: [{ text: "Render me" }] },
      },
    });

    const result = await client.callTool({
      name: "render_diagram",
      arguments: { path, format: "svg" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("<svg");
    expect(content[0].text).toContain("</svg>");
  });

  it("should return error for nonexistent file", async () => {
    const result = await client.callTool({
      name: "read_diagram",
      arguments: { path: "/tmp/does-not-exist-ever.excalidraw" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("Error:");
  });

  it("should reject invalid params via Zod validation", async () => {
    const result = await client.callTool({
      name: "render_diagram",
      arguments: {
        path: join(TEST_DIR, "doesnt-matter.excalidraw"),
        scale: 999,
      },
    });

    // Zod validation error surfaced through the error handler
    expect(result.isError).toBe(true);
  });
});
