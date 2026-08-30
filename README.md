# Lucider

Lucider reads lightweight **comment directives** from your source code and produces a
compact, drift-aware **AI context graph**. Instead of feeding an AI assistant whole files,
you feed it exact points — authored summaries plus only the code that matters — which cuts
tokens and improves focus.

```js
// ai-context: Generates the sum of two numbers
// ai-body: off
function sum(a, b) {
  return a + b;
}
```

From the above, Lucider emits a node whose context is the authored summary and whose body is
excluded (`body: null`), shrinking what the AI has to read.

## Why

- **Optimized context** — emit summaries and selected bodies, not entire files.
- **Hybrid** — Lucider auto-derives a baseline summary from the code; your `ai-context`
  directive overrides it when you want something more precise.
- **Drift-aware** — authored context is fingerprinted. If the code changes but the comment
  doesn't, Lucider flags it as **stale** so out-of-date context never silently misleads the AI.
- **Deterministic** — identical inputs produce byte-identical output (good for diffs and CI).
- **Language-agnostic core** — parsing is pluggable via Tree-sitter. Ships with
  **JavaScript** (`.js/.mjs/.cjs/.jsx`), **TypeScript** (`.ts/.mts/.cts`), and **TSX** (`.tsx`).

## Install & build

```bash
pnpm install
pnpm build
```

## CLI usage

```bash
lucider <path> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--out-dir <dir>` | — | Write both `<dir>/context.json` and `<dir>/context.md`. |
| `--out <file>` | stdout | Write the JSON artifact to a file. |
| `--md <file>` | — | Write the Markdown context digest to a file. |
| `--strict` | off | Exit non-zero if any stale or malformed directive is present (CI gating). |
| `--baseline <file>` | `.lucider/baseline.json` | Sidecar used for staleness comparison. |
| `--update-baseline` | off | Accept current fingerprints for authored nodes and write the baseline. |
| `--default-body <on\|off>` | `on` | Body inclusion when `ai-body` is unspecified. |
| `--prefix <name>` | `ai` | Directive prefix to recognize. |

If no output flag is given, the JSON artifact is printed to stdout.

Exit codes: `0` success · `1` strict violation (stale/malformed) · `2` usage error · `3` path
not found.

### Typical workflow

```bash
# Generate JSON + Markdown context into .lucider/
lucider src --out-dir .lucider

# Establish a staleness baseline (commit .lucider/baseline.json)
lucider src --update-baseline

# In CI, fail the build if context drifted or directives are malformed
lucider src --strict
```

## Use with Claude / Codex / other assistants

The **Markdown digest** (`context.md`) is the easiest thing to feed an assistant: it groups
each symbol by file with its summary, marks stale entries, and includes only the code bodies
you chose to keep.

```bash
# Compact overview: signatures + summaries only (great as a whole-repo primer)
lucider src --md .lucider/context.md --default-body off

# Richer slice: include bodies where you opted in with `ai-body: on`
lucider src --out-dir .lucider
```

Then either attach/paste `.lucider/context.md`, or reference it from an `AGENTS.md` /
project instructions file so the assistant loads exact points instead of whole files. The
JSON artifact (`context.json`) is better when a tool needs to query nodes and edges
programmatically (e.g. pull a node plus its neighbours).

## Directive grammar (v1.0.0)

Form: `<prefix>-<key>: <value>` inside line (`//`) or block (`/* */`) comments. A directive
block is the run of comment lines immediately preceding a declaration and applies to the next
declaration.

| Key | Value | Meaning |
|-----|-------|---------|
| `ai-context` | free text | Authored summary; overrides the derived baseline. |
| `ai-body` | `on` / `off` | Include or exclude the symbol body from output. |
| `ai-ignore` | — | Exclude the declaration from the graph entirely. |

Malformed, orphaned, conflicting, unknown, and deprecated directives all produce located
warnings — nothing is silently dropped.

See [`specs/001-ai-context-graph/contracts/directive-grammar.md`](specs/001-ai-context-graph/contracts/directive-grammar.md)
for the full grammar and [`contracts/artifact.schema.json`](specs/001-ai-context-graph/contracts/artifact.schema.json)
for the output schema.

## Library API

```ts
import { buildArtifact, JavaScriptAdapter, serializeArtifact } from "lucider";

const artifact = buildArtifact({
  generatedFrom: "src",
  entries: [{ file: "math.js", source: "// ai-context: adds\nfunction add(a,b){return a+b;}" }],
  adapter: new JavaScriptAdapter(),
  prefix: "ai",
  defaultBody: "on",
});

console.log(serializeArtifact(artifact));
```

## Development

```bash
pnpm test        # run the test suite (vitest)
pnpm typecheck   # type-check without emitting
pnpm build       # compile to dist/
```

## License

MIT
