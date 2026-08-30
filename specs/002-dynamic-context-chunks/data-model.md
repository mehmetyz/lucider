# Phase 1 Data Model: Dynamic Context Chunks

Extends the feature 001 model. New and changed entities only.

## ContextChunk (not persisted as its own schema)

A derived view over a `ContextArtifact`.

| Field | Type | Notes |
|-------|------|-------|
| `nodes` | AnnotatedNode[] | Sorted by `id`. Depth 0 = seeds; depth 1 = seeds + 1-hop neighbours that exist as nodes. |
| `markdown` | string | Human-readable chunk (`renderChunk`). |
| `query` | string | Search term or node id used. |
| `depth` | number | `0` or `1` for this release. |

**Rules**:
- Seeds from `nodeId` (exact) or ranked `search` (max 3).
- Expansion uses `expandFromSeeds`; endpoints not in `nodes` (e.g. raw file paths) are dropped.
- Ignored declarations never appear because they were never nodes.

## Declared relative (`depends` edge)

| Field | Type | Notes |
|-------|------|-------|
| `type` | `"depends"` | Distinct from `contains`. |
| `from` | string | Node id of the declaring symbol. |
| `to` | string | Resolved target node id. |

**Resolution**: same file by `name`, else unique global `name`. Failure → warning
`unresolved_dep`, no edge.

**Ignore interaction**: If the target was ignored, it is not in `nodes` → unresolved
(warning), not a leak (SC-006).

## Ignored declaration

Not an entity in the artifact. A directive `key: ignore` on the next declaration causes
`buildNodes` to skip node creation. Orphaned ignore → same orphan warning as other keys.

## Directive keys (grammar 1.1.0)

| Key | Value | Status if empty |
|-----|-------|-----------------|
| `ignore` | none | `ok` (valueless) |
| `deps` | comma-separated names | `malformed` if empty (names required) |
| `context` / `body` | as in 001 | unchanged |

Optional `@` before prefix; `prefix` + space + key is normalized to `prefix-key`.

## Warning codes (additive)

| Code | When |
|------|------|
| `unresolved_dep` | A deps name did not resolve to a graph node. |

## QueryArgs (library)

| Field | Type | Notes |
|-------|------|-------|
| `search` | string? | Name/id/context ranking. |
| `nodeId` | string? | Exact id wins over search. |
| `depth` | number | Default 0. |
| `includeSeedBodies` | boolean? | If true and artifact has `body` text, render bodies for seeds (and at depth ≥ 1, expanded nodes with bodies). |
