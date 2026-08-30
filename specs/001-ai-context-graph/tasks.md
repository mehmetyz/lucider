---
description: "Task list for AI Context Graph from Comment Directives"
---

# Tasks: AI Context Graph from Comment Directives

**Input**: Design documents from `/specs/001-ai-context-graph/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — the project constitution mandates fixture-based parser tests and
token-impact validation, so test tasks are part of each user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in each description

## Path Conventions

Single project: `src/` and `tests/` at repository root (per plan.md structure).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create source/test directory structure (`src/cli`, `src/core`, `src/directives`, `src/parsers`, `src/output`, `tests/contract`, `tests/integration`, `tests/unit`, `tests/fixtures`) per plan.md
- [X] T002 Add `bin`, `test` (`node --test`), and `start` scripts to `package.json` and mark package `bin` → `src/cli/index.js`
- [X] T003 [P] Add `.editorconfig` and a minimal formatting config at repo root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core, language-agnostic infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Define `LanguageAdapter` interface (extensions, parse, declarations, commentNodes, nodeText, containerOf) in `src/parsers/adapter.js` per contracts/ and data-model.md
- [X] T005 Implement JavaScript Tree-sitter adapter in `src/parsers/javascript.js` using `tree-sitter` + `tree-sitter-javascript`
- [X] T006 [P] Implement `Location` helper and stable node-id scheme (`file::name#kind@index`) in `src/core/ids.js` per research.md R3
- [X] T007 [P] Implement directive tokenizer/parser (`<prefix>-<key>: <value>`, line + block comments, `grammarVersion`) in `src/directives/grammar.js` per contracts/directive-grammar.md
- [X] T008 [P] Implement directive registry (known keys `context`/`body`/`ignore`, deprecation entries + transition window) in `src/directives/registry.js`
- [X] T009 [P] Implement warning collector (codes, message, location) in `src/core/warnings.js` per data-model.md Warning
- [X] T010 Implement `AnnotatedNode` construction and directive→declaration association (next-declaration rule; orphaned/conflicting detection) in `src/core/nodes.js` (depends on T004, T006, T007, T009)
- [X] T011 Implement pipeline scaffold (discover files → parse → extract directives → associate → build nodes) in `src/core/pipeline.js` (depends on T005, T010)
- [X] T012 Implement base artifact assembly with `schemaVersion` + `grammarVersion` fields in `src/output/artifact.js` per contracts/artifact.schema.json

**Checkpoint**: Parsing + directive extraction + node model ready — user stories can begin

---

## Phase 3: User Story 1 - Generate optimized context artifact (Priority: P1) 🎯 MVP

**Goal**: Turn directives into a compact, hybrid (derived + authored) context artifact that
measurably reduces tokens, honoring `ai-body: off`.

**Independent Test**: Run the CLI over a file with `ai-context` + `ai-body: off`; the artifact
validates against the schema, the node shows authored context with `body: null`, and
`metrics.reductionRatio` ≥ 0.60 (SC-001).

### Tests for User Story 1

- [X] T013 [P] [US1] Contract test validating output against `contracts/artifact.schema.json` in `tests/contract/artifact-schema.test.js`
- [X] T014 [P] [US1] Integration test for quickstart Scenario 1 (context + body-off + reduction) in `tests/integration/us1-context.test.js`
- [X] T015 [P] [US1] Unit test for directive extraction/association + malformed/orphaned warnings in `tests/unit/directives.test.js`

### Implementation for User Story 1

- [X] T016 [US1] Implement derived baseline summary (name/kind/signature/containment) in `src/core/context.js`
- [X] T017 [US1] Apply `ai-context` override and `ai-body on|off` inclusion (with `--default-body`) producing `context`, `contextSource`, `bodyIncluded`, `body` in `src/core/context.js` (depends on T016)
- [X] T018 [P] [US1] Implement deterministic approximate token/byte metrics in `src/core/metrics.js` per research.md R6
- [X] T019 [US1] Wire context + metrics into artifact and enforce `body: null` when excluded in `src/output/artifact.js` (depends on T017, T018)
- [X] T020 [US1] Implement canonical ordering + fixed key serialization (nodes sorted by id) in `src/output/artifact.js` per Constitution Principle II
- [X] T021 [US1] Implement CLI entry with `<path>`, `--out`, `--prefix`, `--default-body` and stderr warning summary in `src/cli/index.js` per contracts/cli.md

**Checkpoint**: MVP — annotated sources produce a validated, minimized context artifact

---

## Phase 4: User Story 2 - Build a navigable relationship graph (Priority: P2)

**Goal**: Emit graph nodes with stable ids and containment edges, and return a bounded
node-plus-neighbours slice.

**Independent Test**: Run over a multi-file project; each annotated symbol is a node with a
`contains` edge to its file/enclosing symbol, and a selected node can be returned with its
immediate neighbours (quickstart Scenario 2).

### Tests for User Story 2

- [X] T022 [P] [US2] Integration test for graph nodes/edges + neighbour slice in `tests/integration/us2-graph.test.js`

### Implementation for User Story 2

- [X] T023 [US2] Implement `Edge` model and `contains` edge construction (file→symbol, symbol→nested) in `src/core/graph.js` (depends on T010)
- [X] T024 [US2] Implement node-plus-immediate-neighbours retrieval in `src/core/graph.js`
- [X] T025 [US2] Include sorted `edges` in the artifact output in `src/output/artifact.js` (depends on T023)

**Checkpoint**: US1 and US2 both function independently

---

## Phase 5: User Story 3 - Detect stale / deprecated context (Priority: P2)

**Goal**: Flag authored context whose code changed since the directive was written; support
deprecated directive keys; enable CI gating via strict mode.

**Independent Test**: Establish a baseline, change a function body, re-run in strict mode →
node is `stale`, a `stale_context` warning appears, and exit code is 1 (SC-002, SC-006).

### Tests for User Story 3

- [X] T026 [P] [US3] Integration test for staleness detection + strict exit code in `tests/integration/us3-staleness.test.js`
- [X] T027 [P] [US3] Unit test for deprecated-key handling (warning + still processed) in `tests/unit/registry.test.js`

### Implementation for User Story 3

- [X] T028 [US3] Implement normalized SHA-256 fingerprint of node text in `src/core/staleness.js` per research.md R2
- [X] T029 [US3] Implement baseline sidecar read/write (`.lucider/baseline.json`) and `fresh|stale|unknown` status for authored nodes in `src/core/staleness.js` (depends on T028)
- [X] T030 [US3] Set node `staleness` + emit `stale_context` warnings in pipeline/artifact in `src/core/pipeline.js` (depends on T029)
- [X] T031 [US3] Add `--strict`, `--baseline`, `--update-baseline` flags and exit codes (0/1/2/3) in `src/cli/index.js` per contracts/cli.md

**Checkpoint**: All user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting quality, determinism, docs, performance

- [X] T032 [P] Determinism test asserting byte-identical output across two runs in `tests/integration/determinism.test.js`
- [X] T033 [P] "No silent drops" test covering malformed/orphaned/conflicting/unknown warnings in `tests/integration/warnings.test.js`
- [X] T034 [P] Author `README.md` documenting directive grammar, CLI usage, and artifact schema references
- [X] T035 Performance check over a ~10k-line fixture verifying near-linear scaling (SC-004) in `tests/integration/performance.test.js`
- [X] T036 Run `quickstart.md` scenarios end-to-end and reconcile any gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational completion
  - US1 (P1) is the MVP; US2 and US3 build on foundational nodes and can proceed in parallel after Phase 2
- **Polish (Phase 6)**: Depends on the desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Only depends on Foundational. Delivers the MVP.
- **US2 (P2)**: Depends on Foundational (node model T010). Independent of US1's context logic; shares the artifact writer.
- **US3 (P2)**: Depends on Foundational (node model + node text). Independent of US1/US2; shares the artifact writer and CLI.

### Within Each User Story

- Tests are written first and MUST fail before implementation.
- Models/utilities before services; services before CLI wiring.
- `src/core/context.js` (T016) before override logic (T017) before artifact wiring (T019).

### Parallel Opportunities

- Setup: T003 is [P].
- Foundational: T006, T007, T008, T009 are [P] (different files); T010+ depend on them.
- US1 tests T013–T015 are [P]; T018 (metrics) is [P] with context work.
- After Phase 2, US2 and US3 can be developed in parallel by different people (distinct files:
  `src/core/graph.js` vs `src/core/staleness.js`), coordinating only on `src/output/artifact.js`
  and `src/cli/index.js`.
- Polish: T032, T033, T034 are [P].

---

## Parallel Example: Foundational Phase

```bash
# After T004/T005, these can run together (different files):
Task: "Implement node-id scheme in src/core/ids.js"
Task: "Implement directive grammar in src/directives/grammar.js"
Task: "Implement directive registry in src/directives/registry.js"
Task: "Implement warning collector in src/core/warnings.js"
```

## Parallel Example: User Story 1 Tests

```bash
Task: "Contract test artifact schema in tests/contract/artifact-schema.test.js"
Task: "Integration test context+body-off in tests/integration/us1-context.test.js"
Task: "Unit test directives in tests/unit/directives.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart Scenario 1; confirm schema validity + ≥60% reduction
5. Ship the MVP (CLI produces optimized context artifacts)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate → ship (MVP)
3. US2 (graph) → validate → ship
4. US3 (staleness + strict CI gating) → validate → ship
5. Polish (determinism, docs, performance)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- Verify each story's tests fail before implementing it.
- `src/output/artifact.js` and `src/cli/index.js` are touched by multiple stories — coordinate
  edits there rather than treating them as [P].
- Keep source read-only; only the baseline sidecar and the artifact are written.
- Commit after each task or logical group; stop at checkpoints to validate independence.
