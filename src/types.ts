export interface Location {
  file: string;
  startLine: number;
  endLine: number;
}

export type DirectiveStatus =
  | "ok"
  | "malformed"
  | "orphaned"
  | "conflicting"
  | "unknown"
  | "deprecated";

export interface Directive {
  key: string;
  value: string;
  prefix: string;
  raw: string;
  location: Location;
  status: DirectiveStatus;
}

export type ContextSource = "authored" | "derived";

export type Staleness = "fresh" | "stale" | "unknown";

export interface AnnotatedNode {
  id: string;
  kind: string;
  name: string;
  location: Location;
  derivedSummary: string;
  context: string;
  contextSource: ContextSource;
  bodyIncluded: boolean;
  body: string | null;
  fingerprint: string;
  staleness: Staleness;
  directives: Directive[];
}

export type EdgeType = "contains" | "references" | "calls" | "depends";

export interface Edge {
  type: EdgeType;
  from: string;
  to: string;
}

export type WarningCode =
  | "malformed_directive"
  | "orphaned_directive"
  | "conflict"
  | "unknown_key"
  | "deprecated_key"
  | "parse_skipped"
  | "stale_context"
  | "unresolved_dep"
  | "budget_truncated";

export interface Warning {
  code: WarningCode;
  message: string;
  location: Location | null;
}

export interface Metrics {
  rawTokens: number;
  emittedTokens: number;
  reductionRatio: number;
  rawBytes: number;
  emittedBytes: number;
}

export interface ContextArtifact {
  schemaVersion: string;
  grammarVersion: string;
  generatedFrom: string;
  nodes: AnnotatedNode[];
  edges: Edge[];
  warnings: Warning[];
  metrics: Metrics;
}

export interface Baseline {
  schemaVersion: string;
  fingerprints: Record<string, string>;
}

export const SCHEMA_VERSION = "1.0.0";
