import type { AnnotatedNode, ContextArtifact, Edge, Metrics, Warning } from "../types.js";
import { SCHEMA_VERSION } from "../types.js";
import { GRAMMAR_VERSION } from "../directives/grammar.js";

export interface AssembleArgs {
  generatedFrom: string;
  nodes: AnnotatedNode[];
  edges: Edge[];
  warnings: Warning[];
  metrics: Metrics;
}

export function assembleArtifact(args: AssembleArgs): ContextArtifact {
  const nodes = [...args.nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const edges = [...args.edges].sort(byEdge);
  return {
    schemaVersion: SCHEMA_VERSION,
    grammarVersion: GRAMMAR_VERSION,
    generatedFrom: args.generatedFrom,
    nodes,
    edges,
    warnings: args.warnings,
    metrics: args.metrics,
  };
}

function byEdge(a: Edge, b: Edge): number {
  if (a.type !== b.type) return a.type < b.type ? -1 : 1;
  if (a.from !== b.from) return a.from < b.from ? -1 : 1;
  if (a.to !== b.to) return a.to < b.to ? -1 : 1;
  return 0;
}

/**
 * Deterministic serialization: object keys are emitted in sorted order so that
 * identical inputs always yield byte-identical output (Constitution Principle II).
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function serializeArtifact(artifact: ContextArtifact): string {
  return stableStringify(artifact);
}
