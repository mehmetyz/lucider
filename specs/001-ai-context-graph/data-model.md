# Phase 1 Data Model: AI Context Graph from Comment Directives

Entities are derived from the spec's Key Entities and the research decisions. All types are
plain JSON-serializable objects; no database is involved.

## Directive

A single parsed instruction extracted from a comment.

| Field | Type | Notes |
|-------|------|-------|
| `key` | string | Directive key without prefix, e.g. `context`, `body`. |
| `value` | string | Raw value text (may be empty → malformed). |
| `prefix` | string | Directive prefix, default `ai`. |
| `raw` | string | Original comment text the directive came from. |
| `location` | Location | Where the directive appears. |
| `status` | enum | `ok` \| `malformed` \| `orphaned` \| `conflicting` \| `unknown` \| `deprecated`. |

**Validation**: empty `value` → `malformed`; unknown `key` not in registry → `unknown`;
deprecated key → `deprecated` (still processed during transition window); directive with no
following declaration → `orphaned`.

## AnnotatedNode

A code point (function, class, method, module, etc.) that appears in the graph.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Stable composite id, e.g. `src/math.js::sum#function@0` (see research R3). |
| `kind` | string | Symbol kind: `function`, `class`, `method`, `module`, etc. |
| `name` | string | Symbol name (or synthetic for anonymous). |
| `location` | Location | Source location of the declaration. |
| `derivedSummary` | string | Auto-generated baseline (signature/structure). |
| `context` | string | Effective summary: authored `ai-context` override if present, else derived. |
| `contextSource` | enum | `authored` \| `derived`. |
| `bodyIncluded` | boolean | Result of `ai-body` directive or configured default. |
| `body` | string \| null | Emitted only when `bodyIncluded` is true. |
| `fingerprint` | string | SHA-256 of normalized node text (see research R2). |
| `staleness` | enum | `fresh` \| `stale` \| `unknown` (unknown when no baseline exists). |
| `directives` | Directive[] | Directives associated with this node. |

**Validation / rules**:
- `context` MUST be non-empty; if authored override empty, fall back to `derivedSummary`.
- `staleness = stale` only when `contextSource = authored` and stored baseline fingerprint
  differs from current `fingerprint`.
- `body` MUST be `null` when `bodyIncluded` is false (minimization, Principle III).

**State transitions (staleness)**:
- `unknown` → `fresh`: first run records baseline fingerprint for an authored node.
- `fresh` → `stale`: code text changes while authored `ai-context` does not.
- `stale` → `fresh`: author updates the directive and re-accepts the baseline.

## Edge

A typed relationship between two nodes.

| Field | Type | Notes |
|-------|------|-------|
| `type` | enum | `contains` (v1). `references`/`calls` reserved for later. |
| `from` | string | Source node id. |
| `to` | string | Target node id. |

**Rules**: v1 emits `contains` edges (module/file → symbol, symbol → nested symbol). Edges
are unique by (`type`,`from`,`to`) and sorted for determinism.

## Location

| Field | Type | Notes |
|-------|------|-------|
| `file` | string | Repo-relative path. |
| `startLine` | number | 1-based. |
| `endLine` | number | 1-based. |

## ContextArtifact

The top-level serialized output.

| Field | Type | Notes |
|-------|------|-------|
| `schemaVersion` | string | SemVer of the artifact schema. |
| `grammarVersion` | string | SemVer of the directive grammar. |
| `generatedFrom` | string | Root path processed. |
| `nodes` | AnnotatedNode[] | Sorted by `id`. |
| `edges` | Edge[] | Sorted by (`type`,`from`,`to`). |
| `warnings` | Warning[] | Located warnings; see below. |
| `metrics` | Metrics | Size/token reduction. |

## Warning

| Field | Type | Notes |
|-------|------|-------|
| `code` | string | e.g. `malformed_directive`, `orphaned_directive`, `conflict`, `unknown_key`, `deprecated_key`, `parse_skipped`, `stale_context`. |
| `message` | string | Human-readable. |
| `location` | Location \| null | Where it occurred (null for whole-file skips carry file only). |

## Metrics

| Field | Type | Notes |
|-------|------|-------|
| `rawTokens` | number | Approximate token count of raw source (documented heuristic). |
| `emittedTokens` | number | Approximate token count of emitted context. |
| `reductionRatio` | number | `1 - emittedTokens/rawTokens`, 0–1. |
| `rawBytes` | number | Byte size of raw source considered. |
| `emittedBytes` | number | Byte size of emitted artifact context. |

## Baseline (sidecar)

Stored separately (default `.lucider/baseline.json`) and used only for staleness comparison.

| Field | Type | Notes |
|-------|------|-------|
| `schemaVersion` | string | Baseline file schema version. |
| `fingerprints` | object | Map of node `id` → accepted fingerprint (authored nodes only). |

## LanguageAdapter (interface, not serialized)

Contract each language plugin implements so the core stays language-agnostic (Principle V):

- `extensions: string[]` — file extensions handled.
- `parse(source: string): Tree` — produce a parse tree.
- `declarations(tree): DeclNode[]` — enumerate declarations with kind, name, range.
- `commentNodes(tree): CommentNode[]` — enumerate comments with range/text.
- `nodeText(node): string` — source slice for a node (for fingerprint/body).
- `containerOf(decl): DeclNode | null` — enclosing declaration for containment edges.
