# Implementation Plan: AI Context Graph from Comment Directives

**Branch**: `001-ai-context-graph` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-ai-context-graph/spec.md`

## Summary

Lucider reads comment directives (e.g. `// ai-context:`, `// ai-body: off`) from source
files, associates each directive with the code declaration it annotates, and produces two
outputs: a compact, token-optimized **context artifact** and a **relationship graph** of
annotated points. Context is generated in a **hybrid** manner — the tool auto-derives a
baseline from the parsed structure (signatures, containment), which `ai-context` directives
override or enrich; authored overrides are fingerprinted so drift between code and comment is
detected and reported as **stale**. The engine is language-agnostic with pluggable Tree-sitter
parsers, JavaScript first. Output is deterministic, JSON-serializable, schema-versioned, and
never mutates source.

## Technical Context

**Language/Version**: JavaScript on Node.js ≥ 18 (ESM; `package.json` already `"type":"module"`)

**Primary Dependencies**: `tree-sitter`, `tree-sitter-javascript` (already declared); a CLI
argument parser (Node's built-in `util.parseArgs`, no new dependency)

**Storage**: Filesystem only. Primary output is a JSON context artifact; a committed sidecar
artifact (or embedded fingerprints) holds the baseline used for staleness comparison. Source
files are read-only.

**Testing**: Node.js built-in test runner (`node:test`) with `node:assert`; fixture-based
tests under `tests/fixtures/` (no extra test dependency)

**Target Platform**: Cross-platform Node.js CLI + importable library; runs on developer
workstations and CI runners (Linux/macOS/Windows)

**Project Type**: Single project — a library core with a thin CLI wrapper

**Performance Goals**: Approximately linear scaling with source size; process a 10,000-line
project with no worse than proportional growth versus a 1,000-line baseline (SC-004)

**Constraints**: Deterministic, reproducible output (stable node ids + ordering); read-only
source handling; JSON artifact carries an explicit schema version; ≥ 60% token reduction for
fully body-excluded files (SC-001); zero silently dropped directives (SC-005)

**Scale/Scope**: Repository-scale inputs (thousands of files); v1 graph edges limited to
containment (module/file → symbol), with reference edges deferred

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0:

| Principle | Gate | Status |
|-----------|------|--------|
| I. Directive-Driven Context | Directive grammar is documented + versioned; unknown/malformed directives warn, never silently drop | PASS — grammar contract in `contracts/directive-grammar.md`; warnings required by FR-009 |
| II. Deterministic Graph Output | Stable node ids, deterministic ordering + serialization for identical inputs | PASS — id scheme + canonical ordering decided in research.md |
| III. Context Minimization (NON-NEGOTIABLE) | Artifact minimizes tokens; `ai-body: off` measurably reduces output; size/token impact reported | PASS — metrics block in artifact schema (FR-006, SC-001) |
| IV. Non-Destructive Source Handling | Source treated read-only; results only in separate artifacts | PASS — no source writes anywhere in design (FR-011) |
| V. Language-Agnostic Core, Pluggable Parsers | Core independent of language; parsers pluggable via stable interface (Tree-sitter) | PASS — `LanguageAdapter` interface in data-model + contracts |

**Additional constraints (constitution):** Tree-sitter parsing ✅ (JS first); JSON output with
schema version field ✅; grammar + schema documented in repo ✅ (contracts/); linear-ish
performance target ✅ (SC-004).

**Result:** No violations. Complexity Tracking section intentionally left empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-context-graph/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── directive-grammar.md
│   ├── artifact.schema.json
│   └── cli.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
src/
├── cli/
│   └── index.js            # CLI entry: arg parsing, exit codes (strict mode)
├── core/
│   ├── pipeline.js         # Orchestrates parse → extract → associate → build → serialize
│   ├── graph.js            # Node/edge construction, stable ids, ordering
│   ├── context.js          # Hybrid context: derived baseline + directive overrides
│   ├── staleness.js        # Fingerprinting + drift detection
│   └── metrics.js          # Token/size reduction reporting
├── directives/
│   ├── grammar.js          # Directive tokenizer/parser + grammar version
│   └── registry.js         # Known keys, deprecations, transition windows
├── parsers/
│   ├── adapter.js          # LanguageAdapter interface (contract)
│   └── javascript.js       # Tree-sitter JavaScript adapter
└── output/
    └── artifact.js         # JSON artifact assembly + schema version

tests/
├── contract/               # Grammar + artifact schema conformance
├── integration/            # End-to-end runs over fixture projects
├── unit/                   # Per-module unit tests
└── fixtures/               # Annotated sample sources + expected artifacts
```

**Structure Decision**: Single-project library-with-CLI layout. The language-agnostic engine
lives in `src/core`, `src/directives`, and `src/output`; language specifics are isolated behind
`src/parsers/adapter.js` with `src/parsers/javascript.js` as the first implementation, directly
satisfying Constitution Principle V. The `src/cli` layer is a thin wrapper so the same
capabilities are usable as a library import.

## Complexity Tracking

> No constitution violations — no entries required.
