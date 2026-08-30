# Lucider

[![npm](https://img.shields.io/npm/v/lucider.svg)](https://www.npmjs.com/package/lucider)
[![CI](https://github.com/mehmetyz/lucider/actions/workflows/ci.yml/badge.svg)](https://github.com/mehmetyz/lucider/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-1a4a66.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-2c6b5c.svg)](package.json)

**Comment directives in, compact AI context out.** Lucider walks JavaScript and TypeScript,
reads `ai-context` / `ai-body` / `ai-ignore` / `ai-deps` comments, and builds a drift-aware
graph. You keep the catalog on disk and give Claude, Codex, or any assistant a **query pack** —
not the whole tree.

npm: [lucider](https://www.npmjs.com/package/lucider) ·
Measurements: [docs/performance.md](docs/performance.md)

## Example

Source in [`examples/shop`](examples/shop) — `dumpDebugSecrets` is ignored and never enters the graph:

```js
// ai-context: Verifies password and returns a session token
// ai-body: off
// ai-deps: hashPassword, issueToken
export function login(email, password) {
  const hash = hashPassword(password);
  return issueToken(email, hash);
}

// ai-context: One-way hash of a password string
export function hashPassword(password) {
  return `sha256:${password.length}`;
}

// ai-ignore
export function dumpDebugSecrets() {
  return process.env.SECRET_KEY;
}
```

```bash
lucider examples/shop --default-body off --out-dir .lucider
lucider examples/shop --query login --depth 1
```

### Graph

`contains` is structure (file → symbol, class → method). `depends` is a **union** of
calls and name uses found in the source plus any `ai-deps` you wrote. Unlabeled
`login()` → `hashPassword()` still gets an edge. Duplicate pairs are stored once.

```mermaid
flowchart LR
  auth.js -->|contains| login
  auth.js -->|contains| hashPassword
  auth.js -->|contains| issueToken
  login -->|depends| hashPassword
  login -->|depends| issueToken
  cart.js -->|contains| Cart
  cart.js -->|contains| findProduct
  Cart -->|contains| add
  Cart -->|contains| total
  total -->|depends| findProduct
```

`dumpDebugSecrets` is absent. Depth-1 `--query login` is the `login → hashPassword → issueToken` cut, not the Cart side.

### Catalog markdown (`--default-body off`)

What you **store** (50 tokens vs 295 raw on this fixture, ~83% reduction). Do not paste a large unlabeled index into the model.

```markdown
# Lucider Context — examples/shop

Schema 1.0.0 · Grammar 1.2.0 · 8 symbols · 11 edges · ~83.1% token reduction (50/295).

## examples/shop/auth.js

### hashPassword — function (L10)

One-way hash of a password string

### issueToken — function (L15)

Signs a short-lived session token

### login — function (L4)

Verifies password and returns a session token
```

### Query pack (`--query login --depth 1`)

What you **give the assistant**. `login` has `ai-body: off`, so only the summary is emitted; neighbours still include bodies.

````markdown
# Lucider chunk — login

3 symbol(s) · depth 1. Ask a follow-up to expand.

## examples/shop/auth.js

### hashPassword — function (L10)

One-way hash of a password string

```js
function hashPassword(password) {
  return `sha256:${password.length}`;
}
```

### issueToken — function (L15)

Signs a short-lived session token

```js
function issueToken(subject, secret) {
  return `${subject}.${secret}`;
}
```

### login — function (L4)

Verifies password and returns a session token
````

### JSON artifact

```json
{
  "schemaVersion": "1.0.0",
  "grammarVersion": "1.2.0",
  "generatedFrom": "examples/shop",
  "metrics": {
    "rawTokens": 295,
    "emittedTokens": 50,
    "reductionRatio": 0.8305
  },
  "nodes": [
    {
      "id": "examples/shop/auth.js::login#function@0",
      "kind": "function",
      "name": "login",
      "context": "Verifies password and returns a session token",
      "contextSource": "authored",
      "bodyIncluded": false,
      "staleness": "unknown"
    }
  ],
  "edges": [
    { "type": "depends", "from": "…::login#function@0", "to": "…::hashPassword#function@0" },
    { "type": "depends", "from": "…::login#function@0", "to": "…::issueToken#function@0" },
    { "type": "depends", "from": "…::total#method@0", "to": "…::findProduct#function@0" }
  ]
}
```

## Why

- **Packs, not dumps** — `--query` / `--file` / `--lines` / `--node-id` return a
  slice (optional `--max-tokens`). On isolated coding tasks, quality matched a raw
  150k-token dump at ~1–5k tokens. See [performance](docs/performance.md).
  Catalog JSON (`--out`) is for storage, not the default assistant payload.
- **Hybrid summaries** — Lucider derives a baseline from the AST; `ai-context` overrides it
  when you want a precise blurb.
- **Drift-aware** — authored comments are fingerprinted. If the code moves and the comment
  does not, the node is **stale** (`--strict` for CI).
- **Deterministic** — identical inputs → byte-identical JSON.
- **Pluggable parsers** — Tree-sitter. Ships with JS (`.js/.mjs/.cjs/.jsx`), TS
  (`.ts/.mts/.cts`), and TSX (`.tsx`).

## Install

Requires Node.js 18+. The package name on npm is [`lucider`](https://www.npmjs.com/package/lucider).

```bash
npm install -g lucider
lucider src --query login --depth 1
```

Without a global install:

```bash
npx lucider src --query login --depth 1
```

As a library:

```bash
npm install lucider
```

## CLI

```bash
lucider <path> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--out-dir <dir>` | — | Write `<dir>/context.json` and `<dir>/context.md`. |
| `--out <file>` | stdout | JSON **catalog** (full index). Not the assistant payload. |
| `--md <file>` | — | Markdown digest, or the **pack** when a pack seed is set. |
| `--query <term>` | — | Pack seed: matching symbols (not the full index). |
| `--file <path>` | — | Pack seed (repeatable): symbols in that file. |
| `--lines <file:start-end>` | — | Pack seed (repeatable): innermost symbol covering the inclusive range. |
| `--diff` | off | Pack seed: `git diff HEAD` (staged + unstaged). |
| `--diff-base <ref>` | — | Also union `git diff <ref>...HEAD` (PR-shaped). Implies a pack. |
| `--node-id <id>` | — | Pack seed: follow-up by catalog node id. |
| `--depth <n>` | `0` | Graph hops for a pack (`0` = seeds only, `1` = seeds + neighbours). |
| `--max-tokens <n>` | — | Cap pack size (`approxTokens`). Omitted = no extra cut. |
| `--no-cache` | off | Skip `.lucider/parse-cache.json` (content-hash parse cache is on by default). |
| `--default-body <on\|off>` | `on` | Body inclusion when `ai-body` is omitted. Use `off` for a catalog. |
| `--strict` | off | Exit `1` if any stale or malformed directive is present. |
| `--baseline <file>` | `.lucider/baseline.json` | Sidecar for staleness. |
| `--update-baseline` | off | Accept current fingerprints. |
| `--prefix <name>` | `ai` | Directive prefix. |

Exit codes: `0` success · `1` strict violation · `2` usage error · `3` path not found.

### Typical workflow

```bash
# Catalog on disk — do not paste this into the model for a large unlabeled tree
lucider src --out-dir .lucider --default-body off

# Pack for Claude / Codex (unlabeled calls still hop via structural depends)
lucider src --query login --depth 1 --md pack.md

# Same idea from a file, a line range, or a catalog id
lucider src --file auth.js --depth 0
lucider src --lines auth.js:4-7 --depth 0
lucider src --diff --depth 1 --max-tokens 2000
lucider src --diff-base origin/main --depth 1 --max-tokens 2000
lucider src --node-id 'src/auth.js::login#function@0' --depth 0

# Keep a slice under a token budget (seed summary/body first)
lucider src --query login --depth 1 --max-tokens 400

# Staleness baseline (commit .lucider/baseline.json)
lucider src --update-baseline

# CI
lucider src --strict
```

`--default-body on` exists so a **live query** still includes bodies on the hit slice. It is
the wrong default for “dump every symbol into chat.”

## Directives (v1.2.0)

Form: `<prefix>-<key>: <value>` in `//` or `/* */` comments. Place them immediately above a
declaration, or put `ai-ignore` inside a body to hide the **next instruction** only.

| Key | Value | Meaning |
|-----|-------|---------|
| `ai-context` | free text | Authored summary; overrides the derived baseline. |
| `ai-body` | `on` / `off` | Include or exclude the symbol body. |
| `ai-ignore` | *(none)* | Above a declaration: drop that symbol from the graph. Inside a body: omit the next statement from the published body; the enclosing function stays. |
| `ai-deps` | comma-separated names | Explicit edges for depth-1 expansion. |

```js
function test() {
  doWork()
  // ai-ignore
  console.log('noise')
  return 1
}
```

Published body keeps `doWork()` and `return 1`. An ignore with no following instruction stays
orphaned (`orphaned_directive`) and does not drop the function.

Malformed, orphaned, conflicting, unknown, and deprecated directives produce located warnings.

Grammar: [specs/001-ai-context-graph/contracts/directive-grammar.md](specs/001-ai-context-graph/contracts/directive-grammar.md) ·
JSON schema: [specs/001-ai-context-graph/contracts/artifact.schema.json](specs/001-ai-context-graph/contracts/artifact.schema.json)

## Library

```ts
import { buildArtifact, JavaScriptAdapter, serializeArtifact } from "lucider";

const artifact = buildArtifact({
  generatedFrom: "src",
  entries: [
    {
      file: "math.js",
      source: "// ai-context: adds two numbers\nfunction add(a, b) { return a + b; }",
    },
  ],
  adapter: new JavaScriptAdapter(),
  prefix: "ai",
  defaultBody: "on",
});

console.log(serializeArtifact(artifact));
```

`queryChunk(artifact, { search: "login", depth: 1, maxTokens: 400 })` returns the same
cut the CLI prints, plus `packTokens`. File/line/`nodeId` seeds work the same way.
Exact symbol names win over longer names that only contain the substring (`safeParse`
does not also seed `$SafeParse`).

## MCP

Agents should call Lucider twice when needed: a small `lucider_query`, then
`lucider_expand` with a node id. Default `maxTokens` is 2000.

```json
{
  "mcpServers": {
    "lucider": {
      "command": "lucider-mcp"
    }
  }
}
```

`lucider_query({ path, search, files, lineRanges, depth, maxTokens })` ·
`lucider_expand({ path, nodeId, depth, maxTokens })`.

Parse cache lives at `<path>/.lucider/parse-cache.json` and invalidates per file
content hash. `--no-cache` disables it on the CLI.

## Development

```bash
git clone https://github.com/mehmetyz/lucider.git
cd lucider
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Feature specs live under `specs/`.


## License

[MIT](LICENSE) © Mehmet Yıldız
