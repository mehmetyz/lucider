# Implementation Plan: Budgeted Structural Packs

**Branch**: `005-budgeted-structural-packs` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-budgeted-structural-packs/spec.md`

## Summary

Unlabeled catalogs get **structural `depends`** from parsed name uses and **exported
const** symbols. Query packs accept a **token budget** (seed before neighbor bodies),
seeds from **file / line range / node id**, and never substitute the full catalog on
a miss. Directives stay overlays. Grammar **1.2.0** and artifact schema **1.0.0**
unchanged. Incremental parse cache is P3.

## Technical Context

**Language/Version**: TypeScript on Node.js ≥ 18 (ESM), compiled with `tsc` to `dist/`

**Primary Dependencies**: Existing Lucider core (`buildNodes`, `buildDependsEdges`,
`queryChunk`, `approxTokens`); Tree-sitter JS/TS adapters; Vitest

**Storage**: Filesystem artifacts only. Source remains read-only. P3 cache, if shipped,
lives under `.lucider/` and MUST invalidate on content hash mismatch.

**Testing**: Vitest — unlabeled depends, exported const, budget layering, file/line
seeds, empty-match; SC-001–SC-007; quickstart CLI scenarios. P3 cache tests only if
cache ships.

**Target Platform**: Cross-platform Node.js CLI + library

**Project Type**: Single-project library-with-CLI (same as 001–004)

**Performance Goals**: Extra identifier walk linear in Tree-sitter nodes. Must not
regress CLI parse of ~700 files beyond noise (constitution linear-scale).

**Constraints**: No new directive keys (no grammar bump). Schema 1.0.0 — `depends`
edges already exist. Core MUST NOT regex JS identifiers; adapters emit ranges.
No heuristic ignore. No embedding rank. P3 cache optional.

**Scale/Scope**: Calls and identifier uses resolved like `ai-deps` (same-file then
unique global name). Exported `const`/`let`/`var` bindings only (not every inner
const). Budget uses existing `approxTokens`. Diff is caller-supplied file+line
ranges, not `git` invocation.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Structure First, Directives Override | Graph from structure unlabeled; `ai-deps` overlays; no heuristic omit | PASS — R1–R2, R7 |
| II. Deterministic Graph Output | Stable resolve order; budget fill order documented; no embeddings | PASS — R3–R4 |
| III. Minimum Context, Full Slice Quality | Catalog ≠ pack; budget seed-before-neighbor; miss ≠ full index | PASS — R4–R5 |
| IV. Non-Destructive Source Handling | No source writes; cache is sidecar | PASS |
| V. Language-Agnostic Core | `parseReferences` + extra decl kinds on adapter | PASS — [contracts/adapter.md](./contracts/adapter.md) |
| VI. Interior Body Annotations | Unchanged; structural edges do not drop interior omits | PASS |
| VII. Structural Completeness | Default `depends` from refs; exported const nodes | PASS — R1–R2 |
| VIII. Budgeted Query and Expandable Packs | File/line/id seeds; budget; id follow-up; cache P3 with FR-012 | PASS — R4–R6 |

**Post-design re-check:** Still PASS. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/005-budgeted-structural-packs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── adapter.md
│   ├── query.md
│   └── cli.md
└── tasks.md              # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
src/
├── parsers/
│   ├── adapter.ts                 # RefNode, parseReferences; decl kinds include const
│   └── tree-sitter-adapter.ts     # exported lexical + identifier refs
├── core/
│   ├── graph.ts                   # structural depends ∪ ai-deps, dedupe
│   ├── query.ts                   # file/line seeds, maxTokens layering, packTokens
│   ├── pipeline.ts                # wire structural edges
│   └── metrics.ts                 # reuse approxTokens for pack size
└── cli/index.ts                   # --max-tokens, --file, --lines, --node-id

tests/
├── unit/structural-deps.test.ts
├── unit/exported-const.test.ts
├── unit/query-budget.test.ts
└── unit/query-seeds.test.ts

specs/002-dynamic-context-chunks/contracts/query.md  # point at 005 delta
README.md                                            # catalog vs pack; unlabeled example
```

**Structure Decision**: No new package. Extend adapter + `depends` union + `queryChunk`.
Markdown/query rendering stays; budget only flips `body` / membership on the pack copy.

## Complexity Tracking

> No constitution violations — no entries required.
