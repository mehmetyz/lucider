# Phase 0 Research: Budgeted Structural Packs

## R1 — How are structural dependencies discovered?

- **Decision**: Language adapters expose `parseReferences(source)`: identifier-like
  name uses with file-absolute indexes (not property names on `obj.foo`). Core maps
  each ref to the **innermost** enclosing declaration (same rule as interior ignore)
  as `from`, then resolves `name` with the existing `ai-deps` resolver (same file,
  else unique project-wide name). Hits become `depends` edges. Unknown names invent
  no node. Self-edges are dropped.
- **Rationale**: Constitution V forbids JS regex in core. Reusing resolve keeps
  unlabeled hops aligned with authored `ai-deps` (FR-001, FR-002).
- **Alternatives considered**: Import-graph only (misses same-file `login` →
  `hashPassword`). Type-checker (non-portable, slow). New edge type `calls` (schema
  already has it, but BFS would need to follow it; union on `depends` is simpler).

## R2 — Which const bindings become symbols?

- **Decision**: Only **exported** lexical bindings (`export const` / `let` / `var`,
  including `export const parse = () => …`). Kind is `const`. Inner, non-exported
  `const` stays out of the graph. Function/class/method/interface/type/enum kinds
  unchanged.
- **Rationale**: US2 / measured Zod `safeParse` hole is public `export const` APIs.
  Indexing every inner const would bloat unlabeled catalogs (III).
- **Alternatives considered**: All `const` at module scope (still includes unpublished
  helpers). `export { x }` re-exports (deferred; needs extra resolve). `module.exports`
  (CJS-only; later).

## R3 — Structural vs `ai-deps` edges

- **Decision**: One `depends` pair `{from, to}` in the catalog. Union: structural plus
  resolved `ai-deps`. Unresolved `ai-deps` still `unresolved_dep`. Omitting a name from
  `ai-deps` does **not** delete a structural edge. `ai-deps` that repeat a structural
  target do not duplicate the pair.
- **Rationale**: Spec edge case and constitution VII overlay. Pack hops already BFS
  `depends`.
- **Alternatives considered**: Edge `source: structural | authored` field (schema bump,
  unused by query). Author-subtract of structural edges (out of spec).

## R4 — Token budget and layering

- **Decision**: Optional `maxTokens` on `queryChunk`, counted with existing
  `approxTokens` on the same strings metrics use (`context` then `context + body`).
  Fill order: all seed identity+summary (never drop a matched seed); seed bodies that
  still fit; neighbor summaries; neighbor bodies. If a seed body does not fit, keep
  summary and note truncation in the pack (and a `budget_truncated` warning). No
  `maxTokens` ⇒ today’s body attachment (`includeSeedBodies` / depth). Pack size is
  `packTokens` on the query result, not catalog `metrics.emittedTokens` (those still
  describe the full build).
- **Rationale**: Constitution III seed-before-neighbor. Catalog metrics would mix
  unused symbols. SC-003/SC-004 compare pack tokens to full-index emission.
- **Alternatives considered**: Truncate inside a body string (partial functions; worse
  for assistants). Hard-cut neighbors first without summaries (seed-complete but
  hops become useless). cl100k in the CLI (extra dep; spec says existing units).

## R5 — Seeds: file, lines, id, empty match

- **Decision**: Library `queryChunk` grows `files?: string[]`, `lineRanges?: { file,
  startLine, endLine }[]` (inclusive lines). File seed = symbols whose location file
  matches (path suffix or exact, deterministic). Line-range seed = innermost symbol
  whose `[startLine, endLine]` covers the range (class vs method: smallest span).
  `nodeId` already exists; CLI exposes `--node-id`. Empty seeds → existing empty
  chunk (`_No matching symbols._`), never stdout catalog JSON.
- **Rationale**: Spec FR-007–FR-009. Callers pass ranges (assumption: no `git` in
  this feature).
- **Alternatives considered**: Lucider runs `git diff` (extra process, non-portable
  cwd). Multiple overlapping symbols as all seeds (explodes; spec says innermost).

## R6 — Incremental cache (P3)

- **Decision**: Not required for MVP. If shipped: sidecar map of `file → contentHash
  → serialized file nodes+refs`; invalidation is hash mismatch; warm rebuild MUST
  equal cold `serializeArtifact` (FR-012). No cache in the default path until tests
  exist.
- **Rationale**: Constitution VIII SHOULD incremental, MUST invalidation-correct.
  Shipping cache without tests would fail the gate.
- **Alternatives considered**: Always full parse (MVP). Process-global memo without
  hash (stale risk).

## R7 — Versions and CLI surface

- **Decision**: **Grammar 1.2.0** unchanged (no new keys). **Schema 1.0.0** unchanged
  (`depends` already allowed). CLI: `--max-tokens`, `--file` (repeatable), `--lines
  file:start-end`, `--node-id`. Help distinguishes **catalog** (no pack seed) vs
  **pack** (`--query` / `--file` / `--lines` / `--node-id`). `--query` still forces
  bodies-on for the parse (002). `--max-tokens` only affects the pack copy.
- **Rationale**: Comment contract did not change. CLI discoverability is FR-010.
- **Alternatives considered**: Grammar 1.3.0 for “structure-first” (nothing to parse
  in comments). Schema field `pack` inside the catalog JSON (blurs catalog vs pack).
