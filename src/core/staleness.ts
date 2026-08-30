import { createHash } from "node:crypto";
import type { Baseline, Staleness } from "../types.js";
import { SCHEMA_VERSION } from "../types.js";

/**
 * Normalized fingerprint of a symbol's source text. Whitespace is collapsed so
 * formatting churn does not trigger false staleness, while real edits do
 * (research R2).
 */
export function computeFingerprint(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Compare a node's current fingerprint against a stored baseline. Only authored
 * context can be stale; derived context is regenerated every run.
 */
export function resolveStaleness(
  nodeId: string,
  fingerprint: string,
  contextSource: "authored" | "derived",
  baseline: Baseline | undefined,
): Staleness {
  if (contextSource !== "authored") return "fresh";
  if (!baseline) return "unknown";
  const recorded = baseline.fingerprints[nodeId];
  if (recorded === undefined) return "unknown";
  return recorded === fingerprint ? "fresh" : "stale";
}

export function emptyBaseline(): Baseline {
  return { schemaVersion: SCHEMA_VERSION, fingerprints: {} };
}
