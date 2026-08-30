---
description: "Task list for Dynamic Context Chunks, Ignore, and Declared Dependencies"
---

# Tasks: Dynamic Context Chunks, Ignore, and Declared Dependencies

**Input**: Design documents from `/specs/002-dynamic-context-chunks/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — spec independent tests, constitution fixture/impact tests, and research
gaps G1 (ignore+deps) and G2 (SC-001 size). TDD: tests first where new coverage is needed.

**Note**: Core query/ignore/deps code already exists under `src/`. Treat each task as
verify-or-implement: if the file already satisfies the spec, confirm tests pass and mark
done; if a gap remains (especially G1/G2), add the missing test or fix.

**Organization**: By user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallel (different files, no incomplete deps)
- **[Story]**: US1 / US2 / US3 on story-phase tasks only

## Path Conventions

Single project: `src/` and `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Feature 002 docs and grammar version alignment with 001 contracts

- [X] T001 Confirm feature docs exist under `specs/002-dynamic-context-chunks/` (`plan.md`, `research.md`, `data-model.md`, `contracts/query.md`, `quickstart.md`)
- [X] T002 Align grammar 1.1.0 (`ignore` valueless, `deps` key) in `specs/001-ai-context-graph/contracts/directive-grammar.md` and `src/directives/grammar.ts` (`GRAMMAR_VERSION`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, registry, warnings, and graph expansion used by all stories

**⚠️ CRITICAL**: Complete before story work (or verify already present)

- [X] T003 Add `depends` to `EdgeType` and `unresolved_dep` to `WarningCode` in `src/types.ts`
- [X] T004 [P] Register keys `ignore` and `deps` in `src/directives/registry.ts`
- [X] T005 [P] Add `depends` to the edge `type` enum in `specs/001-ai-context-graph/contracts/artifact.schema.json`
- [X] T006 Implement `expandFromSeeds` (depth hops, skip non-node endpoints, sort by id) in `src/core/graph.ts`

**Checkpoint**: Types + expansion primitive ready

---

## Phase 3: User Story 1 - Ask for a short chunk, then expand (Priority: P1) 🎯 MVP

**Goal**: Named-symbol chunks at depth 0 (match only) and depth 1 (match + immediate related points); empty match does not dump the project.

**Independent Test**: Query one name at depth 0 → only that symbol. Depth 1 → related points, not unrelated symbols. Unknown name → empty chunk message.

### Tests for User Story 1

- [X] T007 [P] [US1] Unit tests for depth 0 / depth 1 / no-match in `tests/unit/query.test.ts`
- [X] T008 [P] [US1] SC-001 size test: ≥8 symbols, depth-0 chunk ≥70% smaller than full map, in `tests/integration/us1-chunk-size.test.ts` (research G2)

### Implementation for User Story 1

- [X] T009 [US1] Implement ranked search (exact name, substring, id, context; max 3 seeds) and `queryChunk` in `src/core/query.ts`
- [X] T010 [US1] Implement `renderChunk` in `src/output/markdown.ts`
- [X] T011 [US1] Wire `--query` and `--depth` in `src/cli/index.ts` (live query parses with bodies on; stdout is chunk markdown) per `specs/002-dynamic-context-chunks/contracts/query.md`
- [X] T012 [US1] Export `queryChunk` from `src/index.ts`

**Checkpoint**: MVP — `lucider <path> --query <name> --depth 0|1` works

---

## Phase 4: User Story 2 - Keep ignored symbols out of context (Priority: P2)

**Goal**: Valueless ignore (including `@` forms) omits the next declaration from map, graph, and chunks with no empty-value error.

**Independent Test**: Ignore one function; it is absent from the full map and from a chunk of a sibling symbol.

### Tests for User Story 2

- [X] T013 [P] [US2] Grammar and association tests for `ai-ignore`, `ai-ignore:`, `@ai-ignore`, `@ai ignore` in `tests/unit/ignore.test.ts`

### Implementation for User Story 2

- [X] T014 [US2] Valueless-key parsing and `@` / spaced-prefix normalization in `src/directives/grammar.ts`
- [X] T015 [US2] Skip ignored declarations in `src/core/nodes.ts` (no node, no leak into chunks)

**Checkpoint**: US1 + US2 independently testable

---

## Phase 5: User Story 3 - Declare related points (Priority: P2)

**Goal**: `ai-deps` creates resolvable `depends` edges; unresolved names warn; expansion uses those edges.

**Independent Test**: A declares B and C (exist) and Z (missing). Depth-1 chunk for A includes B and C, not Z; warning names Z.

### Tests for User Story 3

- [X] T016 [P] [US3] Depends-edge and unresolved-name tests in `tests/unit/deps.test.ts`
- [X] T017 [P] [US3] Ignored target of `ai-deps` warns and does not appear in depth-1 chunk, in `tests/unit/ignore-deps.test.ts` (research G1, SC-006)

### Implementation for User Story 3

- [X] T018 [US3] Implement `buildDependsEdges` (same-file then unique global; `unresolved_dep`) in `src/core/graph.ts`
- [X] T019 [US3] Merge containment + depends edges in `src/core/pipeline.ts`

**Checkpoint**: All three stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Docs, schema contract test, quickstart

- [X] T020 [P] Document `--query` / `--depth`, `ai-ignore`, and `ai-deps` in `README.md`
- [X] T021 [P] Ensure artifact schema contract test still passes in `tests/contract/artifact-schema.test.ts`
- [X] T022 Run scenarios in `specs/002-dynamic-context-chunks/quickstart.md` against `dist/cli/index.js`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Immediate
- **Foundational (Phase 2)**: After Setup — blocks stories
- **US1 (Phase 3)**: After Foundational — MVP
- **US2 / US3 (Phases 4–5)**: After Foundational; US3 depth-1 is most useful with US1; ignore must hold for US3 G1
- **Polish**: After desired stories

### User Story Dependencies

- **US1 (P1)**: Foundational only (`expandFromSeeds` + `queryChunk`)
- **US2 (P2)**: Foundational (`grammar` + `nodes`); chunks inherit omission automatically
- **US3 (P2)**: Foundational (`buildDependsEdges`); US1 for depth-1 demonstration

### Parallel Opportunities

- T004 and T005 after T003
- T007 and T008 together
- T013 alone vs US1 files
- T016 and T017 together
- T020 and T021 together

---

## Parallel Example: User Story 1 Tests

```bash
Task: "Unit tests depth 0/1/no-match in tests/unit/query.test.ts"
Task: "SC-001 size test in tests/integration/us1-chunk-size.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1–2
2. Phase 3 (query + CLI)
3. Stop: `lucider src --query <name> --depth 0`

### Incremental Delivery

1. US1 chunks
2. US2 ignore
3. US3 deps + G1 test
4. Polish / G2 size test if not done in US1

---

## Notes

- [P] = different files, no incomplete deps
- Coordinate `src/core/graph.ts` (T006 and T018) and `src/cli/index.ts` sequentially
- Do not duplicate 001 full-map work; this feature is a view + two directives
