# Contract: CLI pack seeds (005)

Extends 001 CLI. Pack vs catalog:

| Operator intent | Flags | Stdout (no `--out` / `--md` / `--out-dir`) |
|-----------------|-------|--------------------------------------------|
| Catalog | none of the pack seeds | Full JSON artifact (unchanged) |
| Pack | any pack seed below | Chunk markdown |

Pack seeds (may combine with `--depth`, `--max-tokens`):

| Option | Meaning |
|--------|---------|
| `--query <term>` | Name search (existing) |
| `--node-id <id>` | Follow-up by catalog id |
| `--file <path>` | Repeatable. Symbols in that file |
| `--lines <file:start-end>` | Repeatable. Innermost symbol covering the inclusive line range |
| `--max-tokens <n>` | Pack size cap (`approxTokens`). Omitted = no extra cut |

`--query` still parses with bodies on (002). `--file` / `--lines` / `--node-id`
without `--query` also select a pack (bodies on for that run so the slice can
include implementations).

If every pack seed is set and none match: markdown no-match, exit 0, **not** the
catalog JSON.

Usage line MUST mention pack flags so catalog JSON is not described as the
default assistant payload.

`--out` with a pack seed: still writes the **full** JSON catalog of the parse
(002); `--md` / `--out-dir` `context.md` get the **pack**.
