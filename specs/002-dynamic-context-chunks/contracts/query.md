# Contract: Context query (chunk)

Library and CLI share the same selection rules. Full artifact schema remains
`specs/001-ai-context-graph/contracts/artifact.schema.json` (edge type `depends` added there).

## Library

```
queryChunk(artifact, { search?, nodeId?, depth?, includeSeedBodies? }) → { nodes, markdown }
```

- If `nodeId` is set, seeds = that node or empty.
- Else if `search` is non-empty, seeds = top 3 ranked matches (exact name, name substring,
  id substring, context substring). Tie-break: node `id` ascending.
- `depth` 0: seeds only. `depth` 1: BFS one hop on `contains` and `depends` edges; skip
  endpoints not present in `artifact.nodes`.
- Empty seeds → `nodes = []` and markdown states no matching symbols (never the full map).
- Node list sorted by `id` (deterministic).

## CLI

```
lucider <path> --query <term> [--depth 0|1] [existing 001 options]
```

| Option | Default | Meaning |
|--------|---------|---------|
| `--query <term>` | (off) | Emit a markdown **chunk** instead of the full JSON map on stdout. |
| `--depth <n>` | `0` | Expansion hops (`0` or `1`). |

When `--query` is set:

- Source is parsed with bodies **included** for this run so the chunk can satisfy FR-005.
- Stdout is the chunk markdown unless `--out` / `--md` / `--out-dir` write files (`--md` /
  `--out-dir`’s `context.md` receive the chunk; `--out` still writes the **full** JSON
  artifact of this parse).
- Exit codes unchanged from 001 (`contracts/cli.md`).

## Grammar delta (1.1.0)

Authoritative file: `specs/001-ai-context-graph/contracts/directive-grammar.md`.

- Valueless `ignore` (no empty-value error).
- Optional `@` prefix; `ai ignore` → `ai-ignore`.
- `deps`: comma-separated names → `depends` edges; unresolved → `unresolved_dep`.
