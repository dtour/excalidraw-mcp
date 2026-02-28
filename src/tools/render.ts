import { readFile } from "node:fs/promises";
import { parseFile } from "../core/parser.js";
import type { ExcalidrawElement } from "../types/index.js";

export interface RenderDiagramInput {
  path: string;
  format?: "svg" | "png";
  scale?: number;
}

export interface RenderDiagramResult {
  /** SVG string or base64-encoded PNG */
  data: string;
  mimeType: string;
  /** If true, the data is base64-encoded */
  isBase64: boolean;
}

/**
 * Render an Excalidraw diagram to SVG.
 *
 * SVG rendering is built-in (no native dependencies).
 * PNG rendering requires @resvg/resvg-js (optional native dependency).
 */
export async function renderDiagram(input: RenderDiagramInput): Promise<RenderDiagramResult> {
  const content = await readFile(input.path, "utf-8");
  const parsed = parseFile(input.path, content);
  const elements = parsed.document.elements.filter((e) => !e.isDeleted);
  const scale = input.scale ?? 1;
  const format = input.format ?? "svg";

  const svg = renderToSvg(elements, scale);

  if (format === "png") {
    try {
      const png = await svgToPng(svg, scale);
      return {
        data: png.toString("base64"),
        mimeType: "image/png",
        isBase64: true,
      };
    } catch {
      // Fall back to SVG if resvg-js is not available
      return {
        data: svg,
        mimeType: "image/svg+xml",
        isBase64: false,
      };
    }
  }

  return {
    data: svg,
    mimeType: "image/svg+xml",
    isBase64: false,
  };
}

/**
 * Built-in SVG renderer – produces a lightweight SVG representation
 * of the diagram. This is a simplified renderer that handles common
 * element types without any native dependencies.
 *
 * For higher-fidelity rendering, excalidraw-to-svg can be integrated later.
 */
function renderToSvg(elements: ExcalidrawElement[], scale: number): string {
  if (elements.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>';
  }

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }

  const padding = 40;
  const width = (maxX - minX + padding * 2) * scale;
  const height = (maxY - minY + padding * 2) * scale;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  const svgElements: string[] = [];

  for (const el of elements) {
    const x = el.x + offsetX;
    const y = el.y + offsetY;
    const stroke = escapeAttr(el.strokeColor);
    const fill = el.backgroundColor === "transparent" ? "none" : escapeAttr(el.backgroundColor);
    const sw = el.strokeWidth;
    const opacity = el.opacity / 100;

    switch (el.type) {
      case "rectangle":
        svgElements.push(
          `<rect x="${x}" y="${y}" width="${el.width}" height="${el.height}" ` +
          `stroke="${stroke}" fill="${fill}" stroke-width="${sw}" opacity="${opacity}" rx="8"/>`,
        );
        break;

      case "ellipse":
        svgElements.push(
          `<ellipse cx="${x + el.width / 2}" cy="${y + el.height / 2}" ` +
          `rx="${el.width / 2}" ry="${el.height / 2}" ` +
          `stroke="${stroke}" fill="${fill}" stroke-width="${sw}" opacity="${opacity}"/>`,
        );
        break;

      case "diamond": {
        const cx = x + el.width / 2;
        const cy = y + el.height / 2;
        const hw = el.width / 2;
        const hh = el.height / 2;
        svgElements.push(
          `<polygon points="${cx},${y} ${x + el.width},${cy} ${cx},${y + el.height} ${x},${cy}" ` +
          `stroke="${stroke}" fill="${fill}" stroke-width="${sw}" opacity="${opacity}"/>`,
        );
        break;
      }

      case "arrow":
      case "line":
        if (el.points && el.points.length >= 2) {
          const points = el.points
            .map(([px, py]) => `${x + px},${y + py}`)
            .join(" ");
          svgElements.push(
            `<polyline points="${points}" stroke="${stroke}" fill="none" ` +
            `stroke-width="${sw}" opacity="${opacity}" marker-end="${el.type === "arrow" && el.endArrowhead ? 'url(#arrowhead)' : ''}"/>`,
          );
        }
        break;

      case "text":
        if (el.text) {
          const fontSize = el.fontSize ?? 20;
          const lines = el.text.split("\n");
          const textEls = lines.map((line, i) => {
            const ly = y + fontSize + i * (fontSize * 1.2);
            return `<text x="${x}" y="${ly}" font-size="${fontSize}" fill="${stroke}" opacity="${opacity}" font-family="sans-serif">${escapeXml(line)}</text>`;
          });
          svgElements.push(textEls.join("\n"));
        }
        break;
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="0 0 ${Math.ceil(width / scale)} ${Math.ceil(height / scale)}">`,
    `<defs>`,
    `  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">`,
    `    <polygon points="0 0, 10 3.5, 0 7" fill="#1e1e1e"/>`,
    `  </marker>`,
    `</defs>`,
    ...svgElements,
    `</svg>`,
  ].join("\n");
}

/**
 * Convert SVG to PNG using @resvg/resvg-js (optional native dependency).
 */
async function svgToPng(svg: string, scale: number): Promise<Buffer> {
  // Dynamic import – fails gracefully if not installed
  const { Resvg } = await import("@resvg/resvg-js");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: scale },
  });
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}

// === XML Helpers ===

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
