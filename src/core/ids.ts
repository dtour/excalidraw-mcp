import { nanoid } from "nanoid";

/**
 * Generate an 8-character alphanumeric ID matching Excalidraw's native format.
 */
export function generateId(): string {
  return nanoid(8);
}

/**
 * Generate a random seed for Excalidraw's roughjs renderer.
 * Seeds are 32-bit positive integers.
 */
export function generateSeed(): number {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

/**
 * Generate a version nonce (random 32-bit integer).
 */
export function generateVersionNonce(): number {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}
