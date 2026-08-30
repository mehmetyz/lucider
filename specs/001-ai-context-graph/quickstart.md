# Quickstart & Validation Guide

This guide proves the feature works end-to-end. It references the
[data model](./data-model.md) and [contracts](./contracts/) instead of duplicating them.

## Prerequisites

- Node.js ≥ 18
- Dependencies installed: `tree-sitter`, `tree-sitter-javascript` (already in `package.json`)

```bash
pnpm install
```

## Scenario 1 — Optimized context from directives (spec US1, SC-001)

1. Create a fixture `tests/fixtures/basic/math.js`:

```js
// ai-context: Generates the sum of two numbers
// ai-body: off
function sum(a, b) { return a + b; }
```

2. Run:

```bash
node src/cli/index.js tests/fixtures/basic/math.js --out /tmp/artifact.json
```

**Expected**: `/tmp/artifact.json` validates against `contracts/artifact.schema.json`; the
`sum` node has `contextSource: "authored"`, `bodyIncluded: false`, `body: null`; `metrics.
reductionRatio` ≥ 0.60 for this fully body-excluded file.

## Scenario 2 — Relationship graph (spec US2)

1. Add a second file with a class containing methods under `tests/fixtures/basic/`.
2. Run the CLI over the directory:

```bash
node src/cli/index.js tests/fixtures/basic --out /tmp/graph.json
```

**Expected**: each annotated symbol is a node with a stable `id`; `contains` edges link
file → symbol and class → method; selecting a node id yields that node plus its immediate
neighbours.

## Scenario 3 — Stale context detection (spec US3, SC-002)

1. Establish a baseline:

```bash
node src/cli/index.js tests/fixtures/basic --update-baseline
```

2. Change the body of an authored-context function (edit the code, not the comment).
3. Re-run in strict mode:

```bash
node src/cli/index.js tests/fixtures/basic --strict
```

**Expected**: the changed node reports `staleness: "stale"`, a `stale_context` warning is
emitted, and the process exits with code `1`.

## Scenario 4 — Determinism (Constitution Principle II)

```bash
node src/cli/index.js tests/fixtures/basic --out /tmp/a.json
node src/cli/index.js tests/fixtures/basic --out /tmp/b.json
diff /tmp/a.json /tmp/b.json && echo "deterministic"
```

**Expected**: no diff; prints `deterministic`.

## Scenario 5 — No silent drops (spec edge cases, SC-005)

1. Add a malformed directive (`// ai-context:` with empty value) and an orphaned directive
   (at end of file with no following declaration).
2. Run the CLI.

**Expected**: `warnings` contains `malformed_directive` and `orphaned_directive` entries with
locations; nothing is silently ignored.

## Automated tests

```bash
node --test
```

Runs unit, contract (grammar + schema), integration (fixtures), and determinism tests.
