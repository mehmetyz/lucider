# Quickstart & Validation Guide (005)

Prerequisites: Node.js ≥ 18, `pnpm install`, `pnpm build`. Contracts:
[adapter.md](./contracts/adapter.md), [query.md](./contracts/query.md),
[cli.md](./contracts/cli.md).

Throwaway files below; paths are examples.

## Scenario 1 — Unlabeled call (spec US1, SC-001)

```js
function hashPassword(p) { return p }
function login(user, pass) { return hashPassword(pass) }
```

```bash
node dist/cli/index.js /path/to/auth.js --query login --depth 1
```

**Expected**: Pack names `login` and `hashPassword`. No `ai-deps` in the file.
JSON catalog (`--out`) has a `depends` edge from `login` to `hashPassword`.

## Scenario 2 — Exported const (spec US2, SC-002)

```js
export const parse = (x) => x
```

```bash
node dist/cli/index.js /path/to/parse.js --query parse --depth 0
```

**Expected**: Pack includes `parse`. Catalog node `kind` is `const`.

## Scenario 3 — Budget (spec US3, SC-003, SC-004)

Use a seed whose one-hop neighborhood is large (e.g. a tiny function that calls
into a class with a large method body). Compare:

```bash
node dist/cli/index.js /path/to/demo.js --query seed --depth 1 --max-tokens 80
node dist/cli/index.js /path/to/demo.js --out /tmp/full.json
```

**Expected**: Budgeted pack reported/visible size ≤ 80 `approxTokens` units (or
the CLI-printed equivalent). Seed implementation still present if bodies are on.
Pack is ≥50% smaller than summing all catalog nodes’ emitted context+body
(`metrics` / node bodies in `/tmp/full.json`).

## Scenario 4 — File and lines (spec US4, SC-005, SC-007)

Two files, `auth.js` and `cart.js`.

```bash
node dist/cli/index.js /path/to/dir --file auth.js --depth 0
node dist/cli/index.js /path/to/dir --lines auth.js:1-20 --depth 0
```

**Expected**: Zero-hop file pack seeds are only `auth.js` symbols. Line pack
seeds the innermost symbol covering that range. Empty `--lines` / no overlap:
`_No matching symbols._`, not the full catalog JSON.

## Scenario 5 — Node id follow-up (spec US5)

From scenario 1 JSON, copy a node `id`.

```bash
node dist/cli/index.js /path/to/auth.js --node-id '<id>' --depth 0
```

**Expected**: Pack is that symbol. Unknown id → no-match markdown.

## Scenario 6 — Catalog determinism (spec US6 / SC-006)

```bash
node dist/cli/index.js examples/shop --out /tmp/a.json
node dist/cli/index.js examples/shop --out /tmp/b.json
diff /tmp/a.json /tmp/b.json
```

**Expected**: Identical files. (Cache, if present, must not change this.)

## Automated tests

```bash
pnpm test
```

Must cover unlabeled depends, exported const, budget vs full index, file seed
isolation, and empty match.
