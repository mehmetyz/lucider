# Phase 0 Research: AI Context Graph from Comment Directives

All Technical Context items were resolvable from the constitution, existing dependencies, and
the clarified hybrid-context decision. No `NEEDS CLARIFICATION` markers remain. Findings below.

## R1. Context generation strategy (authored vs derived vs hybrid)

- **Decision**: Hybrid. The tool auto-derives a baseline per symbol (name, kind, signature,
  containment) directly from the Tree-sitter parse. An `ai-context:` directive, when present,
  overrides/enriches the derived summary. `ai-body: on|off` controls whether the symbol's body
  is emitted, defaulting to a configurable project setting.
- **Rationale**: Clarification session 2026-08-30 selected the hybrid option. It is useful with
  zero directives (derived baseline) and better with a few (authored overrides), maximizing
  adoption while keeping intent. Aligns with Constitution Principles I and III.
- **Alternatives considered**:
  - *Authored-only*: simplest, but useless until annotated and highest drift risk.
  - *Derived-only*: always fresh, but loses human intent and the `ai-context` value prop.

## R2. Staleness detection & fingerprint storage

- **Decision**: Compute a normalized fingerprint of each annotated symbol's source slice
  (SHA-256 over whitespace-normalized node text). Store the fingerprint that was current when
  an authored directive was accepted in a committed sidecar file (default
  `.lucider/baseline.json`). On each run, recompute and compare; mismatch on a symbol that has
  an authored `ai-context` marks that node `stale`.
- **Rationale**: A committed sidecar keeps source read-only (Principle IV) and makes staleness
  diffable in code review. SHA-256 over normalized text ignores formatting churn while catching
  real semantic edits. Satisfies FR-007 and SC-002.
- **Alternatives considered**:
  - *Embed fingerprint in the comment* (e.g. `// ai-fingerprint: ab12`): visible but pollutes
    source and risks manual tampering; rejected for v1, may be an opt-in later.
  - *Git blame / history diff*: couples the tool to git and misses uncommitted edits; rejected.
  - *Timestamp comparison*: unreliable across checkouts/CI; rejected.

## R3. Deterministic node identity & ordering

- **Decision**: Node id = stable composite of `relativeFilePath` + scope path + symbol kind +
  symbol name + occurrence index within scope (e.g. `src/math.js::sum#function@0`). Output
  nodes and edges are sorted by id before serialization; object keys emitted in a fixed order.
- **Rationale**: Guarantees identical output for identical input (Principle II), disambiguates
  same-named symbols across scopes/files (edge case in spec), and produces clean diffs.
- **Alternatives considered**:
  - *Content hash ids*: change whenever code changes, breaking cross-run node identity; rejected.
  - *Sequential integer ids*: unstable under insertion/reordering; rejected.

## R4. Directive grammar & extraction

- **Decision**: Directives use `<prefix>-<key>: <value>` inside line (`//`) or block (`/* */`)
  comments; default prefix `ai`. A directive block is the contiguous run of comment lines
  immediately preceding a declaration; it associates with the **next** declaration. Grammar is
  versioned (`grammarVersion`) and documented in `contracts/directive-grammar.md`. A registry
  tracks known keys and deprecated aliases with a transition window.
- **Rationale**: Simple, editor-agnostic, language-neutral; the "next declaration" rule is
  predictable and testable (FR-002). Versioning + registry satisfy Principle I and FR-008.
- **Alternatives considered**:
  - *JSDoc-style tags* (`@ai-context`): heavier, JS-centric, conflicts with existing JSDoc
    tooling; rejected for the language-agnostic core.
  - *Structured YAML in comments*: more expressive but verbose and error-prone to author.

## R5. Language parsing & the pluggable adapter

- **Decision**: Parse with Tree-sitter via `tree-sitter` + `tree-sitter-javascript`. Define a
  `LanguageAdapter` interface (`extensions`, `parse`, `declarations`, `commentNodes`,
  `nodeText`, `containerOf`) so the core never imports a specific grammar. JavaScript adapter
  ships first.
- **Rationale**: Tree-sitter is already a dependency, is incremental, and has grammars for many
  languages, enabling future adapters without touching the core (Principle V). Concrete syntax
  trees give reliable comment positions and declaration boundaries.
- **Alternatives considered**:
  - *Regex-only scanning*: cannot reliably associate comments with declarations or find bodies;
    rejected.
  - *Per-language native ASTs (e.g. Babel for JS)*: fast to start but not language-agnostic and
    would fragment the core; rejected.

## R6. Output serialization, metrics & CLI contract

- **Decision**: Emit a single JSON artifact with `schemaVersion`, `grammarVersion`, `nodes`,
  `edges`, `warnings`, and `metrics` (raw vs emitted token/byte counts and reduction ratio).
  Token counts use a documented approximate tokenizer (word/punctuation heuristic) to stay
  dependency-free and deterministic. CLI (`util.parseArgs`) supports a target path,
  `--strict`, `--out`, `--baseline`, and a `--default-body on|off` flag; strict mode exits
  non-zero on stale/malformed directives.
- **Rationale**: JSON + schema version satisfies the constitution and FR-004/FR-012; the
  metrics block makes minimization verifiable (Principle III, SC-001). A deterministic
  approximate tokenizer avoids pulling a model-specific tokenizer while still reporting
  meaningful reduction. Strict exit codes satisfy FR-010/SC-006.
- **Alternatives considered**:
  - *Exact model tokenizer (e.g. tiktoken)*: adds a heavy, model-specific dependency and can be
    non-deterministic across versions; rejected for v1 (approximate count is sufficient to show
    reduction).
  - *Multiple output files per node*: harder to consume atomically; rejected in favor of one
    consolidated artifact (FR-013).

## R7. Testing approach

- **Decision**: Use Node's built-in `node:test` + `node:assert`. Fixture projects under
  `tests/fixtures/` pair annotated sources with expected artifacts; contract tests validate the
  artifact against `contracts/artifact.schema.json` and grammar parsing against
  `contracts/directive-grammar.md`; integration tests run the full pipeline; determinism tests
  assert byte-identical output across repeated runs.
- **Rationale**: Zero extra dependencies, satisfies the constitution's fixture-based parser
  tests and token-impact validation requirements.
- **Alternatives considered**:
  - *Vitest/Jest*: nicer DX but adds dependencies; unnecessary for a small tool. Can revisit.
