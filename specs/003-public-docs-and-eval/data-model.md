# Data Model: Public Docs, Eval Cleanup, and GitHub Pages

This feature does not add runtime entities to Lucider. It documents **published records**.

## PerformanceReport

Canonical write-up of measured context packing.

| Field | Type | Rules |
|-------|------|--------|
| title | string | English, public |
| date | date | 2026-08-30 (frozen run) |
| tokenizer | string | `cl100k_base` (gpt-tokenizer) |
| product_positioning | string | CLI packs for Claude/Codex-style assistants |
| baseline_tool | string | Aider 0.86.2 `--show-repo-map` as comparison only |
| corpora | Corpus[] | Zod v4/core, Hono `src/` production TS, plus method notes |
| tasks | CodingTask[] | Three isolated-agent tasks |
| findings | string[] | Quality tied; Lucider pack smallest; never dump full index |

### Corpus

| Field | Type | Rules |
|-------|------|--------|
| name | string | e.g. colinhacks/zod `@93f3ab3` v4/core |
| files | number | Production sources only (tests excluded as in the run) |
| raw_tokens | int | Concatenated source, cl100k_base |

### CodingTask

| Field | Type | Rules |
|-------|------|--------|
| id | string | `parseWithDefault` \| `listConstraints` \| `hono-pipeline` |
| rubric_max | int | 13 or 16 |
| arms | ArmResult[] | raw, aider, lucider — each with tokens and score |
| quality | enum | All three arms scored full marks in the frozen run |

### ArmResult

| Field | Type | Rules |
|-------|------|--------|
| arm | enum | `raw` \| `aider` \| `lucider` |
| tokens | int | Tokens actually given to the agent |
| score | int | Rubric total; MUST equal rubric_max for this freeze |
| notes | string | Optional (e.g. Lucider did not see `export const` bodies) |

## SitePage

| Field | Type | Rules |
|-------|------|--------|
| path | path | Under `docs/`, relative links only |
| kind | enum | `landing` \| `performance` |
| stylesheet | path | `styles.css` |

## Validation

- Token integers MUST come from the frozen eval tables, not estimates.
- `evals/` MUST NOT still contain the four scratch files after publish.
- Site pages MUST NOT depend on a JS bundle or Jekyll collection.
