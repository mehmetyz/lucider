---
description: "Task list for Interior Body Annotations"
---

# Tasks: Interior Body Annotations

**Input**: Design documents from `/specs/004-interior-body-annotations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — spec Independent Tests (US1–US3), SC-001–SC-004, constitution
interior-fixture and token-impact gates. TDD: story tests MUST fail before implementation.

**Organization**: By user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallel (different files, no incomplete deps)
- **[Story]**: US1 / US2 / US3 on story-phase tasks only

## Path Conventions

Single project: `src/` and `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align the 1.2.0 comment contract with the 001 grammar document

- [X] T001 Confirm feature docs exist under `specs/004-interior-body-annotations/` (`plan.md`, `research.md`, `data-model.md`, `contracts/grammar-1.2.md`, `contracts/adapter.md`, `quickstart.md`)
- [X] T002 Extend the association section for grammar 1.2.0 (declaration-leading vs next-instruction ignore) in `specs/001-ai-context-graph/contracts/directive-grammar.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Statement ranges and grammar version used by every story

**⚠️ CRITICAL**: No user story work until this phase is complete

- [X] T003 Add `StmtNode` and `parseStatements(source)` to `LanguageAdapter` in `src/parsers/adapter.ts`
- [X] T004 Implement `parseStatements` (`statement_block` children, file-absolute indexes) in `src/parsers/tree-sitter-adapter.ts`
- [X] T005 Set `GRAMMAR_VERSION` to `1.2.0` in `src/directives/grammar.ts`
- [X] T006 Add `omitRanges` (file-absolute `{ startIndex, endIndex }[]`) on `RawNode` in `src/core/nodes.ts`

**Checkpoint**: Adapters list statements; grammar reports 1.2.0; nodes can carry omit spans

---

## Phase 3: User Story 1 - Hide noisy lines inside a useful function (Priority: P1) 🎯 MVP

**Goal**: Interior `ai-ignore` omits the next instruction (and the mark) from the published body; the function stays on the map and in query chunks.

**Independent Test**: Function with a kept instruction and an ignored `console.log`. Map and `--query` include the function, include the kept instruction, exclude the log and the ignore comment.

### Tests for User Story 1

- [X] T007 [P] [US1] Failing unit tests (node present, log omitted, query body matches map) in `tests/unit/interior-ignore.test.ts`

### Implementation for User Story 1

- [X] T008 [US1] After declaration association, bind leftover interior `ignore` to the next contained statement and record omit spans in `src/core/nodes.ts`
- [X] T009 [US1] Splice `omitRanges` out of `body` when `bodyIncluded` in `applyContext` in `src/core/context.ts`

**Checkpoint**: MVP — interior ignore hides one statement without dropping the symbol

---

## Phase 4: User Story 2 - Whole-symbol ignore still means the function does not exist (Priority: P1)

**Goal**: Ignore immediately above a declaration still omits that symbol from the graph; a sibling with only interior ignore remains.

**Independent Test**: `secret` declaration-ignored (absent). `test` with interior ignore (present, log gone). Chunk for `secret` does not include it.

### Tests for User Story 2

- [X] T010 [P] [US2] Regression tests: declaration-level ignore drops the symbol; sibling with interior ignore stays, in `tests/unit/ignore.test.ts`

### Implementation for User Story 2

- [X] T011 [US2] Keep the declaration-leading `ignore` skip-node path (do not treat those marks as interior omits) in `src/core/nodes.ts`

**Checkpoint**: US1 + US2 independently testable; existing ignore contract intact

---

## Phase 5: User Story 3 - Unbound interior ignore is visible, not silent (Priority: P2)

**Goal**: Interior ignore with no following instruction is `orphaned_directive`; the enclosing function stays; other instructions remain.

**Independent Test**: Function ending with `// ai-ignore`. Node exists, body still has prior instructions, stderr/warnings list `orphaned_directive`.

### Tests for User Story 3

- [X] T012 [P] [US3] Failing tests for trailing interior ignore (orphan warning, node kept, body not emptied) in `tests/unit/interior-ignore.test.ts`

### Implementation for User Story 3

- [X] T013 [US3] Mark unbound interior `ignore` as `orphaned` and emit `orphaned_directive` (message: no following instruction) in `src/core/nodes.ts`

**Checkpoint**: All three stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Docs, metrics, unmarked-file regression, quickstart

- [X] T014 [P] Document interior `ai-ignore` (next instruction, function kept) in `README.md`
- [X] T015 [P] Assert `grammarVersion` is `1.2.0` in `tests/contract/artifact-schema.test.ts` (or equivalent contract test)
- [X] T016 SC-004: ignored span ≥20% of raw declaration → published body ≥20% smaller, in `tests/unit/interior-ignore.test.ts`
- [X] T017 FR-010: unmarked `examples/shop` (or existing fixture) published bodies unchanged vs current baseline, in `tests/unit/nodes.test.ts`
- [X] T018 Run scenarios in `specs/004-interior-body-annotations/quickstart.md` against `dist/cli/index.js`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Immediate
- **Foundational (Phase 2)**: After Setup — blocks all stories
- **US1 (Phase 3)**: After Foundational — MVP
- **US2 (Phase 4)**: After Foundational; safest after US1 so interior and declaration paths coexist in `src/core/nodes.ts`
- **US3 (Phase 5)**: After Foundational; shares `src/core/nodes.ts` with US1 (sequential on that file)
- **Polish**: After desired stories (T016 extends `tests/unit/interior-ignore.test.ts` — after US1 tests)

### User Story Dependencies

- **US1 (P1)**: Foundational (`parseStatements`, `omitRanges`, `applyContext` splice)
- **US2 (P1)**: Foundational + do not regress skip-node; independently testable via `tests/unit/ignore.test.ts`
- **US3 (P2)**: Same bind loop as US1; independently testable via orphan cases

### Parallel Opportunities

- T003 then T004 (T004 needs T003)
- T005 parallel with T003/T004
- T007 (tests) before T008/T009
- T010 vs T007: different files — parallel after Foundational
- T014 and T015 in polish
- Do **not** parallel T008, T011, T013 (all `src/core/nodes.ts`)

---

## Parallel Example: After Foundational

```bash
# Different files:
Task: "Failing US1 tests in tests/unit/interior-ignore.test.ts"
Task: "US2 regression tests in tests/unit/ignore.test.ts"
```

Then sequential: `src/core/nodes.ts` (T008 → T011 → T013) and `src/core/context.ts` (T009).

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1–2
2. Phase 3 (bind + splice + tests)
3. Stop: `lucider file.js --query test` hides the log, keeps `test`

### Incremental Delivery

1. US1 interior omit
2. US2 declaration-ignore regression
3. US3 orphan interior ignore
4. Polish (README, grammarVersion, SC-004, FR-010, quickstart)

---

## Notes

- [P] = different files, no incomplete deps
- Coordinate `src/core/nodes.ts` (T006, T008, T011, T013) sequentially
- Interior `context` / `deps` / `body` stay orphan if not declaration-leading (spec assumption)
- Range delimiters are out of scope
