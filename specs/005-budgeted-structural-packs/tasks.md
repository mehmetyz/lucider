---
description: "Task list for Budgeted Structural Packs"
---

# Tasks: Budgeted Structural Packs

**Input**: Design documents from `/specs/005-budgeted-structural-packs/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — spec Independent Tests (US1–US6), SC-001–SC-007, constitution
unlabeled-graph and budgeted-query gates. TDD: story tests MUST fail before implementation.

**Organization**: By user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallel (different files, no incomplete deps)
- **[Story]**: US1–US6 on story-phase tasks only

## Path Conventions

Single project: `src/` and `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Point existing query contract at the 005 delta; confirm design docs

- [X] T001 Confirm feature docs exist under `specs/005-budgeted-structural-packs/` (`plan.md`, `research.md`, `data-model.md`, `contracts/adapter.md`, `contracts/query.md`, `contracts/cli.md`, `quickstart.md`)
- [X] T002 [P] Add a 005 delta link from `specs/002-dynamic-context-chunks/contracts/query.md` to `specs/005-budgeted-structural-packs/contracts/query.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Adapter surface so the core can take references without JS regex

**⚠️ CRITICAL**: No user story work until this phase is complete

- [X] T003 Add `RefNode` and `parseReferences(source)` to `LanguageAdapter` in `src/parsers/adapter.ts`
- [X] T004 Stub `parseReferences` returning `[]` in `src/parsers/tree-sitter-adapter.ts` so existing adapters compile
- [X] T005 [P] Export `RefNode` from `src/index.ts`

**Checkpoint**: Interface includes references; JS/TS adapters still parse; no behavior change yet

---

## Phase 3: User Story 1 - Unlabeled code still yields a navigable slice (Priority: P1) 🎯 MVP

**Goal**: Catalog records `depends` from calls/name uses without `ai-deps`; one-hop pack for the caller includes the callee.

**Independent Test**: Unlabeled `login` calls `hashPassword`. Depth-1 pack names both. Catalog has a `depends` edge.

### Tests for User Story 1

- [X] T006 [P] [US1] Failing unit tests (unlabeled call → `depends`, depth-1 pack includes callee, `ai-deps` unions without duplicate pairs) in `tests/unit/structural-deps.test.ts`

### Implementation for User Story 1

- [X] T007 [US1] Implement identifier `parseReferences` (no property names, no declaration names) in `src/parsers/tree-sitter-adapter.ts`
- [X] T008 [US1] Resolve refs to innermost enclosing `RawNode` and emit union `depends` (dedupe, no self, no phantom nodes) in `src/core/graph.ts`
- [X] T009 [US1] Call `parseReferences` and pass refs into depends assembly in `src/core/pipeline.ts`

**Checkpoint**: MVP — unlabeled depth-1 pack works without comments

---

## Phase 4: User Story 2 - Exported const APIs are first-class symbols (Priority: P1)

**Goal**: `export const parse = …` is a catalog symbol (`kind: "const"`) and can be packed by name.

**Independent Test**: File with only exported const `parse`. Catalog lists it. `--query parse` includes it. Distinct from a `function parse` in another file.

### Tests for User Story 2

- [X] T010 [P] [US2] Failing unit tests (exported const node, pack by name, distinct ids vs function of same name) in `tests/unit/exported-const.test.ts`

### Implementation for User Story 2

- [X] T011 [US2] Emit exported `const`/`let`/`var` bindings as `kind: "const"` from `parseDeclarations` in `src/parsers/tree-sitter-adapter.ts` (after T007; same file)

**Checkpoint**: Public `export const` APIs are queryable without annotating a neighbor

---

## Phase 5: User Story 3 - A size budget keeps the slice complete at the seed (Priority: P1)

**Goal**: Optional `maxTokens` fills seed summary/body before neighbor bodies; pack size ≤ budget; no budget ⇒ today’s slice.

**Independent Test**: Tight budget, large neighbor. `packTokens` ≤ limit. Seed body kept if bodies on. Pack ≥50% smaller than full-index emission.

### Tests for User Story 3

- [X] T012 [P] [US3] Failing unit tests (budget cap, seed body before neighbor bodies, no `maxTokens` unchanged, SC-004 vs full index) in `tests/unit/query-budget.test.ts`

### Implementation for User Story 3

- [X] T013 [US3] Add `maxTokens` layered fill, `packTokens`, and `budget_truncated` when a seed body does not fit in `src/core/query.ts`
- [X] T014 [US3] Add `budget_truncated` to warning codes in `src/types.ts` (only if warnings are emitted on the artifact; otherwise pack markdown note only — match [data-model.md](./data-model.md))
- [X] T015 [US3] Add `--max-tokens` and usage text that catalog JSON is not the default assistant payload in `src/cli/index.ts`

**Checkpoint**: Budgeted unlabeled depth-1 stays small without dropping the seed

---

## Phase 6: User Story 4 - Start from a file or a change list (Priority: P2)

**Goal**: Pack seeds from file path and inclusive line ranges; empty match is not the catalog.

**Independent Test**: Two files. `--file auth.js --depth 0` seeds only auth symbols. Line range inside `login` seeds `login`. No overlap → `_No matching symbols._`

### Tests for User Story 4

- [X] T016 [P] [US4] Failing unit tests (file seed isolation, innermost line-range seed, empty match) in `tests/unit/query-seeds.test.ts`

### Implementation for User Story 4

- [X] T017 [US4] Implement `files` and `lineRanges` seed selection (innermost span) in `src/core/query.ts` (after T013)
- [X] T018 [US4] Add repeatable `--file` and `--lines file:start-end` in `src/cli/index.ts` (after T015)

**Checkpoint**: Authors can pack without knowing the symbol name

---

## Phase 7: User Story 5 - Fetch more of one symbol by id (Priority: P2)

**Goal**: CLI `--node-id` returns that symbol’s pack; unknown id does not dump the catalog.

**Independent Test**: Known id → that node. Unknown id → no-match markdown.

### Tests for User Story 5

- [X] T019 [US5] Failing tests for `nodeId` unknown-id empty pack (not full catalog) in `tests/unit/query-seeds.test.ts` (after T016; same file)

### Implementation for User Story 5

- [X] T020 [US5] Wire `--node-id` as a pack seed (bodies-on parse, markdown not catalog JSON) in `src/cli/index.ts` (after T018; library `nodeId` already exists)

**Checkpoint**: Follow-up fetch works without reprinting the first pack

---

## Phase 8: User Story 6 - Unchanged sources do not change packs (Priority: P3)

**Goal**: Two catalog builds on identical inputs are byte-identical. Do **not** ship a parse cache in this increment unless hash-invalidation tests exist (plan R6).

**Independent Test**: `serializeArtifact` twice on `examples/shop` (or unlabeled fixture) is identical.

### Tests for User Story 6

- [X] T021 [P] [US6] Assert byte-identical catalogs on identical inputs (SC-006) in `tests/integration/determinism.test.ts`

### Implementation for User Story 6

- [X] T022 [US6] Skip parse cache in `src/core/pipeline.ts` this increment; if a cache is added later it MUST live under `.lucider/` with content-hash invalidation and tests in `tests/unit/parse-cache.test.ts`

**Checkpoint**: Determinism holds; cache remains out of scope unless T022’s later path is taken

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Docs, adapter smoke, quickstart

- [X] T023 [P] Document unlabeled `depends`, `--max-tokens`, file/line/`--node-id` seeds, and catalog vs pack in `README.md`
- [X] T024 [P] Smoke `parseReferences` / exported const in `tests/unit/javascript-adapter.test.ts`
- [X] T025 Run scenarios in `specs/005-budgeted-structural-packs/quickstart.md` against `dist/cli/index.js`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Immediate
- **Foundational (Phase 2)**: After Setup — blocks all stories
- **US1 (Phase 3)**: After Foundational — MVP
- **US2 (Phase 4)**: After Foundational; after US1 on `src/parsers/tree-sitter-adapter.ts`
- **US3 (Phase 5)**: After Foundational; can follow US1 so depth-1 has edges to budget
- **US4 (Phase 6)**: After US3 on `src/core/query.ts` and `src/cli/index.ts`
- **US5 (Phase 7)**: After US4 on `src/cli/index.ts`; tests share `tests/unit/query-seeds.test.ts` with US4
- **US6 (Phase 8)**: After Foundational; independent of pack CLI
- **Polish**: After desired stories (quickstart needs US1–US5)

### User Story Dependencies

- **US1 (P1)**: Foundational (`parseReferences` stub → real walk + graph union)
- **US2 (P1)**: Same adapter file as US1 — sequential
- **US3 (P1)**: Best after US1 so budgeted depth-1 has structural neighbors
- **US4 (P2)**: Query seed API after budget layering
- **US5 (P2)**: CLI pack-seed plumbing after US3/US4
- **US6 (P3)**: Determinism only; no cache

### Parallel Opportunities

- T002 vs T001
- T005 vs T003/T004
- T006 (tests) before T007–T009
- T010 vs T006 (different test files) after Foundational
- T012 vs T010 after Foundational
- T016 vs T012 (different test files) after US3 query types exist
- T023 and T024 in polish
- Do **not** parallel T007 and T011 (`tree-sitter-adapter.ts`)
- Do **not** parallel T013 and T017 (`query.ts`)
- Do **not** parallel T015, T018, T020 (`cli/index.ts`)

---

## Parallel Example: After Foundational

```bash
# Different files:
Task: "Failing US1 tests in tests/unit/structural-deps.test.ts"
Task: "Failing US2 tests in tests/unit/exported-const.test.ts"
```

Then sequential: `tree-sitter-adapter.ts` (T007 → T011), `graph.ts` + `pipeline.ts`, then `query.ts` (T013 → T017).

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1–2
2. Phase 3 (refs + structural `depends` + tests)
3. Stop: `lucider file.js --query login --depth 1` includes the callee with no `ai-deps`

### Incremental Delivery

1. US1 unlabeled depends
2. US2 exported const
3. US3 `--max-tokens`
4. US4 `--file` / `--lines`
5. US5 `--node-id`
6. US6 determinism (no cache)
7. Polish (README, adapter smoke, quickstart)

---

## Notes

- [P] = different files, no incomplete deps
- Coordinate `src/parsers/tree-sitter-adapter.ts` (T004 → T007 → T011)
- Coordinate `src/core/query.ts` (T013 → T017)
- Coordinate `src/cli/index.ts` (T015 → T018 → T020)
- Grammar stays 1.2.0; schema stays 1.0.0
- Heuristic ignore and parse cache are out of this increment
