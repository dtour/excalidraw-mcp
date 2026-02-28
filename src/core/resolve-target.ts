import type { ExcalidrawElement } from "../types/index.js";

export interface ResolvedTarget {
  element: ExcalidrawElement;
  /** Whether the match was by ID (exact) or text (fuzzy) */
  matchType: "id" | "text";
}

/**
 * Resolve a target string to an element.
 *
 * The target can be:
 * - An element ID (exact match)
 * - A text substring (matches element text or bound text)
 *
 * Errors on ambiguous text matches with guidance on how to disambiguate.
 */
export function resolveTarget(
  target: string,
  elements: ExcalidrawElement[],
): ResolvedTarget {
  const live = elements.filter((e) => !e.isDeleted);

  // Try ID match first
  const byId = live.find((e) => e.id === target);
  if (byId) {
    return { element: byId, matchType: "id" };
  }

  // Try text match – look at shapes that have bound text
  // and also standalone text elements
  const textMatches: ExcalidrawElement[] = [];

  for (const el of live) {
    // For text elements, match against their text
    if (el.type === "text" && el.text?.includes(target)) {
      // If this text is bound to a container, return the container instead
      if (el.containerId) {
        const container = live.find((c) => c.id === el.containerId);
        if (container) {
          textMatches.push(container);
          continue;
        }
      }
      textMatches.push(el);
      continue;
    }

    // For shapes, check if they have bound text matching the target
    if (el.boundElements) {
      for (const bound of el.boundElements) {
        if (bound.type === "text") {
          const textEl = live.find((t) => t.id === bound.id);
          if (textEl?.text?.includes(target)) {
            textMatches.push(el);
            break;
          }
        }
      }
    }
  }

  // Deduplicate by ID
  const unique = [...new Map(textMatches.map((e) => [e.id, e])).values()];

  if (unique.length === 0) {
    const available = listAvailableTargets(live);
    throw new Error(
      `No element found matching "${target}". ` +
      `Available elements: ${available}`,
    );
  }

  if (unique.length > 1) {
    const options = unique.map((e) => {
      const text = getElementDisplayText(e, live);
      return `"${text}" (id: ${e.id})`;
    });
    throw new Error(
      `${unique.length} elements match "${target}": ${options.join(", ")}. ` +
      `Use an element ID to disambiguate.`,
    );
  }

  return { element: unique[0], matchType: "text" };
}

/**
 * Get display text for an element (its own text or bound text).
 */
function getElementDisplayText(
  el: ExcalidrawElement,
  allElements: ExcalidrawElement[],
): string {
  if (el.type === "text" && el.text) {
    return el.text;
  }

  if (el.boundElements) {
    for (const bound of el.boundElements) {
      if (bound.type === "text") {
        const textEl = allElements.find((t) => t.id === bound.id);
        if (textEl?.text) return textEl.text;
      }
    }
  }

  return `[${el.type} ${el.id}]`;
}

/**
 * List available targets for error messages.
 */
function listAvailableTargets(elements: ExcalidrawElement[]): string {
  const targets: string[] = [];

  for (const el of elements) {
    if (el.type === "text" && el.containerId) continue; // Skip bound text
    const text = getElementDisplayText(el, elements);
    targets.push(`"${text}" (${el.id})`);
  }

  if (targets.length === 0) return "(no elements)";
  if (targets.length > 10) {
    return targets.slice(0, 10).join(", ") + `, ... (${targets.length} total)`;
  }
  return targets.join(", ");
}
