# Quickstart & Validation Guide (004)

Prerequisites: Node.js ≥ 18, `pnpm install`, `pnpm build`. Contracts:
[grammar-1.2.md](./contracts/grammar-1.2.md), [data-model.md](./data-model.md).

Use a throwaway file (paths below are examples).

## Scenario 1 — Hide a log, keep the function (spec US1, SC-001)

```js
function test() {
  const x = 1
  // ai-ignore
  console.log('dasfsaf')
  return x
}
```

```bash
node dist/cli/index.js /path/to/demo.js --query test --depth 0
```

**Expected**: Chunk includes `test`. Body contains `const x = 1` and `return x`. Body does
**not** contain `console.log` or `ai-ignore`. JSON `nodes` includes `test`.

## Scenario 2 — Declaration ignore unchanged (spec US2, SC-002)

```js
// ai-ignore
function secret() { return 1 }
function test() {
  // ai-ignore
  console.log('x')
  return 2
}
```

```bash
node dist/cli/index.js /path/to/demo.js --out /tmp/map.json
```

**Expected**: `secret` absent from `nodes`. `test` present. `test` body has no `console.log`.

## Scenario 3 — Trailing interior ignore orphans (spec US3, SC-003)

```js
function test() {
  return 1
  // ai-ignore
}
```

```bash
node dist/cli/index.js /path/to/demo.js --query test 2>/tmp/err.txt
```

**Expected**: `test` is a node; body still has `return 1`; stderr contains `orphaned_directive`.

## Scenario 4 — Token reduction (spec SC-004)

Use a function whose ignored span is ≥ 20% of the raw declaration text. Compare
`metrics.emittedTokens` (or emitted body length) with the same file without the ignore
mark. Published body MUST be ≥ 20% smaller on the same measure the CLI already reports.

## Scenario 5 — Unmarked file unchanged (spec FR-010)

Run the CLI on an existing fixture with no interior marks (e.g. `examples/shop` without
new ignores). Published bodies MUST match current 1.1.0 output.

## Automated tests

```bash
pnpm test
```

Must include unit coverage for interior omit, declaration-ignore regression, orphan
interior ignore, and a metrics assertion for SC-004.
