# Implementation Plan: Dynamic Context Chunks, Ignore, and Declared Dependencies

**Branch**: `002-dynamic-context-chunks` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-dynamic-context-chunks/spec.md`

## Summary

Extend Lucider so consumers can request a **bounded context chunk** for a named symbol
(depth 0 = match only; depth 1 = match plus immediate related points) instead of the full
map. Authors mark secret or noisy declarations as **ignored** so they never enter the graph
or any chunk. Authors declare **related symbol names** (`ai-deps`) so depth-1 expansion is
intentional. The full-map path from feature 001 remains; chunks are the follow-up mechanism
that realizes context minimization for assistant workflows.

**Implementation status**: Core behavior already exists in `src/` (grammar 1.1.0, `queryChunk`,
`buildDependsEdges`, valueless `ignore`). This plan records the as-built design, constitution
gates, and remaining gaps (tests for SC-001, ignore-as-unresolved-dep).

## Technical Context

**Language/Version**: TypeScript on Node.js ≥ 18 (ESM), compiled with `tsc` to `dist/`

**Primary Dependencies**: Existing Lucider core (`buildArtifact`, graph, directives);
`tree-sitter` adapters unchanged; CLI via `node:util` `parseArgs`

**Storage**: Filesystem only. Chunks are derived views; they MUST NOT write source. Optional
write of chunk markdown via existing `--md` / stdout.

**Testing**: Vitest (`tests/unit/query.test.ts`, `ignore.test.ts`, `deps.test.ts`); fixture
CLI scenarios in quickstart

**Target Platform**: Cross-platform Node.js CLI + library (`queryChunk`)

**Project Type**: Same single-project library-with-CLI as feature 001

**Performance Goals**: Chunking is a filter over an already-built artifact (or a live parse);
MUST remain linear in node/edge count for depth ≤ 1

**Constraints**: Deterministic chunk ordering; ignored nodes absent from graph; unresolved
deps warn; grammar version 1.1.0; read-only source (FR-012)

**Scale/Scope**: Depth 0 and 1 only (spec assumption). MCP / live assistant sessions out of
scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Directive-Driven Context | Ignore and deps are documented, versioned grammar keys; unknown/unresolved never silent | PASS — grammar 1.1.0; `unresolved_dep`; valueless `ignore` not malformed |
| II. Deterministic Graph Output | Stable node ids; chunk node lists sorted by id | PASS — `expandFromSeeds` sorts by id; search rank is deterministic |
| III. Context Minimization | Chunks smaller than full map; bodies only on the requested slice | PASS — depth-0/1 filter; live `--query` forces bodies only for the slice |
| IV. Non-Destructive Source Handling | Query path does not write source | PASS — same CLI write helpers, artifacts only |
| V. Language-Agnostic Core | Query/ignore/deps sit on `AnnotatedNode` + edges, not JS-specific | PASS — any adapter's nodes participate |

**Result:** No violations. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-dynamic-context-chunks/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── query.md
│   └── grammar-1.1.md
└── tasks.md              # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
src/
├── cli/index.ts              # --query, --depth; live query uses bodies on
├── core/
│   ├── query.ts              # search, depth expansion, QueryChunk
│   ├── graph.ts              # contains + depends + expandFromSeeds
│   ├── nodes.ts              # skip ignore; associate directives
│   └── pipeline.ts           # buildDependsEdges into artifact
├── directives/
│   ├── grammar.ts            # valueless keys, optional @ prefix, grammar 1.1.0
│   └── registry.ts           # ignore, deps
└── output/markdown.ts        # renderChunk

tests/
├── unit/query.test.ts
├── unit/ignore.test.ts
└── unit/deps.test.ts
```

**Structure Decision**: No new top-level package. Query is a library function plus CLI flags
on the existing entrypoint so 001 and 002 share one parse.

## Complexity Tracking

> No constitution violations — no entries required.
