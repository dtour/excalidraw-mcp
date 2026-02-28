import type { ExcalidrawElement, BoundElement, Binding } from "../types/index.js";

export interface BindingViolation {
  elementId: string;
  message: string;
}

/**
 * Validate binding consistency across all elements.
 *
 * Checks:
 * 1. Arrow startBinding/endBinding reference existing elements
 * 2. Referenced elements have the arrow in their boundElements
 * 3. Text containerId references exist and the container has the text in boundElements
 * 4. boundElements entries reference existing elements
 */
export function validateBindings(elements: ExcalidrawElement[]): BindingViolation[] {
  const violations: BindingViolation[] = [];
  const elementMap = new Map(elements.filter((e) => !e.isDeleted).map((e) => [e.id, e]));

  for (const el of elements) {
    if (el.isDeleted) continue;

    // Check arrow bindings
    if (el.type === "arrow") {
      if (el.startBinding) {
        const target = elementMap.get(el.startBinding.elementId);
        if (!target) {
          violations.push({
            elementId: el.id,
            message: `Arrow startBinding references non-existent element "${el.startBinding.elementId}"`,
          });
        } else if (!target.boundElements?.some((b) => b.id === el.id)) {
          violations.push({
            elementId: el.id,
            message: `Arrow startBinding target "${el.startBinding.elementId}" does not list this arrow in boundElements`,
          });
        }
      }

      if (el.endBinding) {
        const target = elementMap.get(el.endBinding.elementId);
        if (!target) {
          violations.push({
            elementId: el.id,
            message: `Arrow endBinding references non-existent element "${el.endBinding.elementId}"`,
          });
        } else if (!target.boundElements?.some((b) => b.id === el.id)) {
          violations.push({
            elementId: el.id,
            message: `Arrow endBinding target "${el.endBinding.elementId}" does not list this arrow in boundElements`,
          });
        }
      }
    }

    // Check text container binding
    if (el.type === "text" && el.containerId) {
      const container = elementMap.get(el.containerId);
      if (!container) {
        violations.push({
          elementId: el.id,
          message: `Text containerId references non-existent element "${el.containerId}"`,
        });
      } else if (!container.boundElements?.some((b) => b.id === el.id && b.type === "text")) {
        violations.push({
          elementId: el.id,
          message: `Text container "${el.containerId}" does not list this text in boundElements`,
        });
      }
    }

    // Check boundElements entries
    if (el.boundElements) {
      for (const bound of el.boundElements) {
        if (!elementMap.has(bound.id)) {
          violations.push({
            elementId: el.id,
            message: `boundElements references non-existent element "${bound.id}"`,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Repair binding inconsistencies by removing orphaned references.
 * Returns the repaired element array (does not mutate the input).
 */
export function repairBindings(elements: ExcalidrawElement[]): ExcalidrawElement[] {
  const elementMap = new Map(elements.filter((e) => !e.isDeleted).map((e) => [e.id, e]));

  return elements.map((el) => {
    if (el.isDeleted) return el;

    const patched = { ...el };

    // Clean up arrow bindings pointing to non-existent elements
    if (el.type === "arrow") {
      if (el.startBinding && !elementMap.has(el.startBinding.elementId)) {
        patched.startBinding = null;
      }
      if (el.endBinding && !elementMap.has(el.endBinding.elementId)) {
        patched.endBinding = null;
      }
    }

    // Clean up text container references
    if (el.type === "text" && el.containerId && !elementMap.has(el.containerId)) {
      patched.containerId = null;
    }

    // Clean up boundElements pointing to non-existent elements
    if (el.boundElements) {
      const cleaned = el.boundElements.filter((b) => elementMap.has(b.id));
      patched.boundElements = cleaned.length > 0 ? cleaned : null;
    }

    return patched;
  });
}

/**
 * Wire up bidirectional bindings for an arrow connecting two shapes.
 *
 * Sets:
 * - arrow.startBinding -> fromId
 * - arrow.endBinding -> toId
 * - fromElement.boundElements += { id: arrow.id, type: "arrow" }
 * - toElement.boundElements += { id: arrow.id, type: "arrow" }
 */
export function setupArrowBindings(
  arrowId: string,
  fromId: string,
  toId: string,
  elements: ExcalidrawElement[],
): ExcalidrawElement[] {
  return elements.map((el) => {
    if (el.id === arrowId) {
      return {
        ...el,
        startBinding: createBinding(fromId),
        endBinding: createBinding(toId),
      };
    }

    if (el.id === fromId || el.id === toId) {
      const existing = el.boundElements ?? [];
      if (!existing.some((b) => b.id === arrowId)) {
        return {
          ...el,
          boundElements: [...existing, { id: arrowId, type: "arrow" as const }],
        };
      }
    }

    return el;
  });
}

/**
 * Wire up text-container binding.
 */
export function setupTextBinding(
  textId: string,
  containerId: string,
  elements: ExcalidrawElement[],
): ExcalidrawElement[] {
  return elements.map((el) => {
    if (el.id === textId) {
      return { ...el, containerId };
    }

    if (el.id === containerId) {
      const existing = el.boundElements ?? [];
      if (!existing.some((b) => b.id === textId)) {
        return {
          ...el,
          boundElements: [...existing, { id: textId, type: "text" as const }],
        };
      }
    }

    return el;
  });
}

/**
 * Remove an element and clean up all references to it.
 *
 * - Removes the element from the array
 * - Clears arrow startBinding/endBinding referencing this element
 * - Removes boundElements entries referencing this element
 * - Clears text containerId referencing this element
 * - Also removes bound text elements when removing a container
 */
export function removeElementClean(
  id: string,
  elements: ExcalidrawElement[],
): ExcalidrawElement[] {
  const target = elements.find((e) => e.id === id);
  if (!target) return elements;

  // Collect IDs to remove: the target + any text bound to it
  const idsToRemove = new Set([id]);
  if (target.boundElements) {
    for (const bound of target.boundElements) {
      if (bound.type === "text") {
        idsToRemove.add(bound.id);
      }
    }
  }

  return elements
    .filter((el) => !idsToRemove.has(el.id))
    .map((el) => {
      const patched = { ...el };

      // Clean up arrow bindings
      if (el.type === "arrow") {
        if (el.startBinding && idsToRemove.has(el.startBinding.elementId)) {
          patched.startBinding = null;
        }
        if (el.endBinding && idsToRemove.has(el.endBinding.elementId)) {
          patched.endBinding = null;
        }
      }

      // Clean up text container
      if (el.type === "text" && el.containerId && idsToRemove.has(el.containerId)) {
        patched.containerId = null;
      }

      // Clean up boundElements
      if (el.boundElements) {
        const cleaned = el.boundElements.filter((b) => !idsToRemove.has(b.id));
        patched.boundElements = cleaned.length > 0 ? cleaned : null;
      }

      return patched;
    });
}

/**
 * Remove arrow and clean up its bindings on both endpoints.
 */
export function removeArrowClean(
  arrowId: string,
  elements: ExcalidrawElement[],
): ExcalidrawElement[] {
  const arrow = elements.find((e) => e.id === arrowId);
  if (!arrow) return elements;

  // Also remove any text bound to the arrow (arrow labels)
  const idsToRemove = new Set([arrowId]);
  if (arrow.boundElements) {
    for (const bound of arrow.boundElements) {
      if (bound.type === "text") {
        idsToRemove.add(bound.id);
      }
    }
  }

  return elements
    .filter((el) => !idsToRemove.has(el.id))
    .map((el) => {
      if (el.boundElements) {
        const cleaned = el.boundElements.filter((b) => !idsToRemove.has(b.id));
        return {
          ...el,
          boundElements: cleaned.length > 0 ? cleaned : null,
        };
      }
      return el;
    });
}

// === Helpers ===

function createBinding(elementId: string): Binding {
  return {
    elementId,
    focus: 0,
    gap: 1,
    fixedPoint: null,
  };
}
