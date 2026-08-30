# Phase 0 Research: Interior Body Annotations

## R1 — When is a comment “interior” vs declaration-leading?

- **Decision**: Run existing declaration association first (contiguous comments immediately above a declaration). Any remaining directive whose source span lies strictly inside some declaration’s `[startIndex, endIndex]` is interior to the **innermost** enclosing declaration. Only interior `ignore` attempts statement binding; other leftover keys stay `orphaned` (spec assumption).
- **Rationale**: Comments above a nested function are already declaration-level ignore for that nested symbol (FR-004). Treating them as outer-body cuts would double-bind and change existing ignore. Constitution VI requires interior marks; it does not redefine leading association.
- **Alternatives considered**: Bind every in-body comment to a statement first (would steal nested-function ignore). Line-number-only “inside `{`…`}`” without innermost-enclosing (ambiguous with nested functions).

## R2 — What is the “next instruction”?

- **Decision**: Language adapters expose statement-like source ranges (`parseStatements`). Core binds an interior ignore to the earliest statement whose `startIndex >= comment.endIndex` and whose range is contained in the enclosing declaration. That statement plus the ignore comment is the omit span (FR-002, FR-005). If no such statement exists before the declaration ends, the ignore is `orphaned` (FR-007).
- **Rationale**: Spec forbids expression fragments and range delimiters. Tree-sitter `statement_block` children are the portable “complete instruction or block” (call, `if`, `for`, lexical declaration). Core uses indexes only (Principle V) — no JavaScript regex slicing of bodies.
- **Alternatives considered**: Next non-comment line (breaks multi-line calls). Explicit `ai-ignore-start` / `end` (out of spec). Prettier-based statement split (extra dependency, not Tree-sitter).

## R3 — Grammar and schema versions

- **Decision**: Bump **grammar** to **1.2.0** (placement + next-instruction rule; keys unchanged). Keep **artifact schema 1.0.0** — published `body` remains `string | null`; omitted text is simply absent from that string. Reuse warning code `orphaned_directive`.
- **Rationale**: Constitution I/workflow require a grammar bump when the comment contract changes. Schema fields do not change. Silent reuse of 1.1.0 would hide the new association rule from consumers.
- **Alternatives considered**: Schema field `omittedSpans` (useful later, not required by spec). New warning code `unbound_interior` (split without product need; same author-visible class as orphan).

## R4 — Where published body is sliced

- **Decision**: `RawNode` carries omit ranges. `applyContext` splices `node.text` when `bodyIncluded` is true. `ai-body: off` still emits `body: null` and does not need slicing. Query/chunks already render `AnnotatedNode.body`, so FR-006 holds with no query-layer change. Metrics already hash emitted body strings (SC-004).
- **Rationale**: Single slice point keeps map and `--query` identical. Slicing after graph build avoids changing node ids.
- **Alternatives considered**: Slice only in markdown output (JSON would still leak logs). Drop statements in the parser (would change `DeclNode.text` and fingerprints unexpectedly).

## R5 — TypeScript / TSX

- **Decision**: Same `parseStatements` walk on `tree-sitter-typescript` / TSX as JavaScript (`statement_block` children). Interfaces/types/enums typically have no statement block of executable instructions; interior ignore there orphans if nothing binds.
- **Rationale**: One adapter method on `TreeSitterAdapter`; JS and TS share it. Languages that do not implement statements yet MUST still surface leftover interior directives as orphaned (spec edge case), never drop them.
- **Alternatives considered**: JS-only interior (fails Principle V and TS users).

## R6 — Performance

- **Decision**: One extra Tree-sitter walk collecting statement ranges is O(nodes), same order as existing declaration/comment walks. Splice is O(body size) per omitted span. No new index of the whole project.
- **Rationale**: Constitution linear-scale constraint. 692-file TypeBox parse was ~0.8s; an extra walk is negligible vs agent time.
- **Alternatives considered**: Per-query re-parse (wasteful; body already on the node).
