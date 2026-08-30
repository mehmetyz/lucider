# Phase 1 Data Model: Budgeted Structural Packs

Extends 001/002/004. New and changed entities only.

## Reference (adapter, not in catalog JSON)

| Field | Type | Notes |
|-------|------|--------|
| `name` | string | Identifier as written |
| `startIndex` / `endIndex` | number | File-absolute, exclusive end |
| `startLine` / `endLine` | number | 1-based |

Not a declaration. Property names (`obj.foo` → `foo`) are not references.

## Structural dependency

Stored as catalog `Edge` `{ type: "depends", from, to }`.

**Rules**:
- `from` = innermost enclosing symbol containing the reference span.
- `to` = resolved symbol (`resolveDep`: same file, else unique name).
- No `to` → drop (no phantom node).
- `from === to` → drop.
- Union with `ai-deps`; one pair per `(from, to)`.

## Exported const symbol

`AnnotatedNode` with `kind: "const"`. `text` / body is the exported lexical
declaration (including initializer). Id uses existing `file::name#kind@index`.
A `function` and a `const` with the same `name` in different files stay distinct.

## Size budget

| Field | Type | Notes |
|-------|------|--------|
| `maxTokens` | number \| omitted | Pack-only; `approxTokens` |
| `packTokens` | number | Sum of included layers after fill |

**Fill order** (stop before exceeding `maxTokens`, except matched seeds always keep
identity + summary):

1. Seed identity + summary
2. Seed body (if `bodyIncluded` would be true)
3. Neighbor summary
4. Neighbor body

Truncation: seed without body + `budget_truncated` warning. Neighbors not yet
reached are absent from the pack (not listed as `body: null` unless they got a
summary layer).

## Query seed set

Exactly one primary mode, first match wins in library args:

1. `nodeId` — that node or empty
2. `lineRanges` — innermost covering symbols
3. `files` — all symbols in those files
4. `search` — existing name rank (exact name still preferred)

Empty set → empty pack, not the catalog.

## Pack vs catalog

| | Catalog | Pack |
|---|---------|------|
| When | No pack seed, or `--out` full JSON | `--query` / `--file` / `--lines` / `--node-id` |
| Content | All nodes + edges | Seeded BFS then budget layers |
| Metrics | `artifact.metrics` (whole build) | `packTokens` on the chunk |

## Cache (P3 only)

`file` + utf-8 content hash → reused decls/refs for that file. Changing one file
MUST reparse that file; other files MAY reuse. Full serialize MUST match cold build.
