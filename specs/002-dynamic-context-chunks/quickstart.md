# Quickstart & Validation Guide (002)

Prerequisites: Node.js ≥ 18, `pnpm install`, `pnpm build`. Contracts:
[query.md](./contracts/query.md), [data-model.md](./data-model.md).

Use a throwaway folder (example paths below).

## Scenario 1 — Depth-0 chunk (spec US1, SC-001)

Create several symbols in one file, including `login` plus unrelated helpers.

```bash
node dist/cli/index.js /path/to/demo --query login --depth 0
```

**Expected**: Markdown titled as a chunk; only `login` (or top matches for that name);
unrelated symbols absent; output much smaller than `lucider /path/to/demo --default-body off`
full map.

## Scenario 2 — Depth-1 follows declared relatives (spec US3, SC-003)

```js
// ai-context: logs a user in
// ai-deps: hashPassword, issueToken
function login() {}
function hashPassword() {}
function issueToken() {}
function formatDate() {}
```

```bash
node dist/cli/index.js /path/to/demo --query login --depth 1
```

**Expected**: Chunk includes `login`, `hashPassword`, `issueToken`; does **not** include
`formatDate`.

## Scenario 3 — Ignore never appears (spec US2, SC-002, SC-006)

```js
// ai-ignore
function dumpDebugSecrets() {}
// ai-deps: dumpDebugSecrets
function login() {}
```

```bash
node dist/cli/index.js /path/to/demo --out /tmp/map.json
node dist/cli/index.js /path/to/demo --query login --depth 1
```

**Expected**: `dumpDebugSecrets` absent from JSON `nodes` and from the chunk; stderr includes
`unresolved_dep` for the ignored name.

## Scenario 4 — Ignore authoring forms (spec US2)

Marks `// ai-ignore`, `// ai-ignore:`, `// @ai-ignore`, `// @ai ignore` each omit the next
declaration and do **not** emit `malformed_directive`.

## Scenario 5 — No match (spec US1)

```bash
node dist/cli/index.js /path/to/demo --query zzzz --depth 0
```

**Expected**: No symbol sections; message that nothing matched; not a full project dump.

## Automated tests

```bash
pnpm test
```

Includes `tests/unit/query.test.ts`, `ignore.test.ts`, `deps.test.ts`.
