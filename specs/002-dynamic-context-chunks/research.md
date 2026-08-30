# Phase 0 Research: Dynamic Context Chunks

No Technical Context items required `NEEDS CLARIFICATION`. Decisions below match the spec
assumptions and the as-built code.

## R1. Chunk vs full map

- **Decision**: Keep full-map generation (feature 001). Add a derived **chunk** view selected
  by name or node id and expansion depth (0 or 1).
- **Rationale**: Eval showed index-alone is incomplete and full dump is expensive. Chunks
  are the follow-up path (spec US1, Constitution III).
- **Alternatives considered**: Replace the full map with chunks only (loses project-wide
  orientation); embed an MCP server in this spec (explicitly out of scope).

## R2. How related points are discovered

- **Decision**: Depth-1 walks **all existing edges** one hop: `contains` (structural) and
  `depends` (from `ai-deps`). File-path containment endpoints that are not symbol nodes are
  skipped so the whole file is not injected (spec edge case).
- **Rationale**: Explicit deps are reliable; containment gives class↔method without guessing
  call graphs. Auto call-graph is deferred.
- **Alternatives considered**: Infer calls from the parse tree (noisy in JS/TS); expand only
  `depends` (misses enclosing type).

## R3. Name resolution for `ai-deps`

- **Decision**: Same-file match first (first match if several); else unique project-wide
  name; otherwise `unresolved_dep` warning, no edge (spec assumption).
- **Rationale**: Avoids silently linking the wrong `save` in another package.
- **Alternatives considered**: Always first global match (unsafe); require file-qualified
  names (harder to author).

## R4. Ignore grammar

- **Decision**: `ignore` is a **valueless** key: `ai-ignore`, `ai-ignore:`, `@ai-ignore`,
  `@ai ignore`. Empty value is **not** malformed. Association = next declaration. Node is
  omitted from the graph entirely, so chunks cannot leak it.
- **Rationale**: Spec US2; authors expect a flag, not a dummy value. Constitution I: do not
  treat a valid ignore as malformed.
- **Alternatives considered**: Require `ai-ignore: true` (friction); file-level ignore
  comments (different association rule — later).

## R5. Bodies on live query

- **Decision**: When the consumer requests a chunk via CLI `--query`, parse with bodies
  **on** for that run so the slice can include implementation text even if the usual map
  uses `--default-body off` (FR-005). Library `queryChunk` uses whatever bodies the
  supplied artifact already stored; `includeSeedBodies` only controls rendering.
- **Rationale**: Index stays small; the follow-up question fetches the exact point.
- **Alternatives considered**: Always store bodies in the JSON map (defeats minimization);
  require a second flag to fetch bodies (extra step).

## R6. Ambiguous search

- **Decision**: Rank by exact name, then substring name, id, then context text; take at most
  **three** seeds. Never dump the project on no match (empty chunk message).
- **Rationale**: Spec edge case “small number of top matches.”
- **Alternatives considered**: Return all substring hits (can explode); require unique names.

## R7. Remaining gaps vs spec (for tasks)

- **G1**: Dedicated test that an `ai-deps` name pointing at an **ignored** symbol warns and
  does not appear in a depth-1 chunk (SC-006 / edge case).
- **G2**: Measurable SC-001 test (8+ symbols, depth-0 chunk ≥ 70% smaller than full map).
- **G3**: Grammar/CLI contract docs in this feature folder (001 contracts are the baseline).
