# Implementation Plan: Interior Body Annotations

**Branch**: `004-interior-body-annotations` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-interior-body-annotations/spec.md`

## Summary

Honor `ai-ignore` **inside** a declaration body: bind it to the next instruction, omit that
span (comment + statement) from the published body, and **keep** the enclosing symbol on
the graph. Declaration-leading ignore is unchanged. Grammar **1.2.0**. Statement ranges
come from the language adapter; the core splices by index only.

## Technical Context

**Language/Version**: TypeScript on Node.js ≥ 18 (ESM), compiled with `tsc` to `dist/`

**Primary Dependencies**: Existing Lucider core (`buildNodes`, `applyContext`, `queryChunk`);
Tree-sitter JS/TS adapters; Vitest

**Storage**: Filesystem artifacts only. Source remains read-only.

**Testing**: Vitest — new `tests/unit/interior-ignore.test.ts` plus regression on
`tests/unit/ignore.test.ts`; metrics case for SC-004; quickstart CLI scenarios

**Target Platform**: Cross-platform Node.js CLI + library

**Project Type**: Single-project library-with-CLI (same as 001–003)

**Performance Goals**: Extra statement walk linear in Tree-sitter nodes; no second full
project index. Must not regress CLI parse of ~700 files beyond noise (constitution
linear-scale).

**Constraints**: Grammar 1.2.0 documented in the same change; schema 1.0.0 unchanged;
orphaned interior ignore never silent; no JS-specific body regex in `src/core`

**Scale/Scope**: Next-instruction ignore only. No range delimiters. Interior `context` /
`deps` / `body` not bound to statements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Directive-Driven Context | Same keys; grammar versioned; interior unknown/malformed/orphan not silent | PASS — 1.2.0 contract; reuse warning codes |
| II. Deterministic Graph Output | Innermost enclosing decl + earliest following statement; stable splice order | PASS — research R1–R2 |
| III. Context Minimization | Sliced body in metrics; SC-004 test | PASS — `applyContext` + existing `computeMetrics` |
| IV. Non-Destructive Source Handling | Omit only in artifacts | PASS — no source writes |
| V. Language-Agnostic Core | `parseStatements` on adapter; core uses indexes | PASS — [contracts/adapter.md](./contracts/adapter.md) |
| VI. Interior Body Annotations | Interior ignore omits span, keeps node; unbound → orphan | PASS — this feature |

**Post-design re-check:** Still PASS. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/004-interior-body-annotations/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── grammar-1.2.md
│   └── adapter.md
└── tasks.md              # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
src/
├── parsers/
│   ├── adapter.ts              # parseStatements
│   └── tree-sitter-adapter.ts  # statement_block walk
├── core/
│   ├── nodes.ts                # leftover ignore → omit spans; else orphan
│   └── context.ts              # splice body
├── directives/grammar.ts       # GRAMMAR_VERSION 1.2.0
└── types.ts                    # unchanged schema; RawNode omit ranges internal

tests/
└── unit/interior-ignore.test.ts

specs/001-ai-context-graph/contracts/directive-grammar.md  # association 1.2.0
README.md                                                 # interior ignore example
```

**Structure Decision**: No new package. Extend the existing adapter interface and node
pipeline so query/markdown need no special case.

## Complexity Tracking

> No constitution violations — no entries required.
