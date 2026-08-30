# Lucider performance analysis

**Date:** 2026-08-30  
**Tokenizer:** `cl100k_base` via `gpt-tokenizer` (GPT-4o family)  
**Lucider:** this repository, `pnpm build`  
**Repo-map baseline:** Aider 0.86.2, `aider --show-repo-map --map-tokens 1024 --model gpt-4o-mini`

Lucider is a CLI that turns comment directives into a **queryable context graph**. The intended consumer is an assistant such as Claude or Codex (or any tool that will take a markdown/JSON pack). Aider is included only as a **repo-map baseline** — a well-known “what would we paste instead of the whole tree” arm — not as a product Lucider integrates with.

## Summary

On three isolated coding tasks, **correctness was tied** (every arm hit the full rubric). The difference was **how many tokens the model had to read**.

| Task | Corpus | Raw source | Aider chat+map | Lucider query pack | Quality |
|------|--------|----------:|---------------:|-------------------:|---------|
| `parseWithDefault` | Zod v4/core | 145 633 | 4 399 | **1 406** | 13 / 13 all |
| `listConstraints` / `hasAbortingCheck` | Zod v4/core | 145 941 | 13 183 | **4 520** | 16 / 16 all |
| `flattenMatchResult` / `onionTrace` / `planFetch` | Hono | 153 215 | 7 124 | **2 156** | 16 / 16 all |

Lucider packs were roughly **3× smaller than Aider’s chat+map** and **30–100× smaller than concatenating the corpus**.

The failure mode is the opposite of “not enough context”: **dumping Lucider’s full index into the model**. On unlabeled Zod v4/core, a body-off Lucider index is ~37k tokens and a body-on index is ~139k — worse than Aider’s ~2.1k repo map. The catalog belongs **on disk**; the model should receive **`--query` chunks**.

## Method

Each agent saw **only its own context file**. Same Cursor general-purpose agent, same hidden rubric, no extra repo search.

| Arm | What the model received |
|-----|-------------------------|
| **Raw** | Concatenation of production sources (`===== FILE =====` banners) |
| **Aider** | Focus file(s) in chat plus `--show-repo-map` (Aider doubles the map budget when no chat files are present) |
| **Lucider** | A **pack**: selected index slices (`--default-body off`) plus `--query` / `--depth` hits — not the whole graph |

Timing was not the primary metric; token count is the prefill proxy.

### Corpora

| Corpus | Pin | Scope | Files | Raw tokens (overview pass) |
|--------|-----|-------|------:|---------------------------:|
| [colinhacks/zod](https://github.com/colinhacks/zod) | `@93f3ab3` | `packages/zod/src/v4/core` production `.ts` | 21 | 145 259 |
| [honojs/hono](https://github.com/honojs/hono) | `@e2740d5` | `src/` production TS (no tests/jsx/adapters) | 123 | 153 215 |
| Annotated shop fixture | local | 4 files, directives on | 4 | 613 |
| Lucider `src/` | this repo | unlabeled product source | 22 | 11 151 |

Zod agent-task raw counts (145 633 / 145 941) are slightly above the overview pass because the Lucider arm’s source was **annotated** (`ai-context`, `ai-ignore`, `ai-deps`) before packing.

## Coding tasks

Solutions were **not** written into `ai-context` except where a directive had to describe an API the parser cannot see (`export const` — see [Limitations](#limitations)).

### 1. Zod — `parseWithDefault`

Add `parseWithDefault(schema, value, defaultValue)`: on validation failure return `defaultValue` and **do not throw**. Prefer the existing `safeParse` path.

Directives lived on declarations Lucider can see (`$Parse`, `$SafeParse`, `finalizeParams`, …). Codec helpers in `parse.ts` were `ai-ignore`’d (7 symbols left in that file’s index). The Lucider agent did **not** receive the full-core index (1 110 symbols).

| Arm | Tokens | vs raw | Rubric |
|-----|-------:|-------:|-------:|
| Raw | 145 633 | — | 13 / 13 |
| Aider | 4 399 | −97.0% | 13 / 13 |
| Lucider pack | **1 406** | −99.0% | 13 / 13 |

All three delegated to `safeParse`. Lucider never saw the `export const safeParse` body; the authored `$SafeParse` blurb (“does not throw; `{ success, data } | { success, error }`”) was enough.

### 2. Zod — `listConstraints` / `hasAbortingCheck`

Walk a schema graph: unique nodes, check names, `abort`, `string_format`, cycle-safe, no mutation. The algorithm was **not** spelled out in directives.

| Arm | Tokens | vs raw | Rubric |
|-----|-------:|-------:|-------:|
| Raw | 145 941 | — | 16 / 16 |
| Aider | 13 183 | −91.0% | 16 / 16 |
| Lucider pack | **4 520** | −96.9% | 16 / 16 |

All three copied `mapInner` edges from `visit.ts` and used an identity `Set` for cycles. Raw, having all of `schemas.ts`, additionally treated hybrid `$ZodCheck` schemas as self-checks (`z.email()`). That nuance was **outside the rubric**; scores stayed tied.

### 3. Hono — match flatten, onion trace, fetch plan

Three exports over Hono’s router/`compose`/`fetch` pipeline. Directives summarized `#dispatch` / `ComposeStack` / `Result`; they did not paste the solution.

| Arm | Tokens | vs raw | Rubric |
|-----|-------:|-------:|-------:|
| Raw | 153 215 | — | 16 / 16 |
| Aider | 7 124 | −95.3% | 16 / 16 |
| Lucider pack | **2 156** | −98.6% | 16 / 16 |

`export const compose` is invisible to Lucider’s current AST kinds. The pack used inner `function dispatch` / `#dispatch` bodies plus a `ComposeStack` summary. Aider ate three whole files. Querying the `Hono` class at depth 1 pulled the entire class body (~24k tokens) and was **dropped from the pack**.

## Overview vs pack (do not dump the index)

Same tokenizer, no coding agent — “what if we pasted a whole-repo overview?”

| Corpus | Raw | Aider map | Lucider index, body off | Lucider index, body on |
|--------|----:|----------:|------------------------:|-----------------------:|
| Shop (annotated) | 613 | 603 | **300** | 901 |
| Zod v4/core (unlabeled) | 145 259 | **2 138** | 37 086 | 138 762 |
| Lucider `src/` (unlabeled) | 11 151 | **2 032** | 2 147 | 11 960 |

`--default-body on` is the CLI default because a **query** still needs bodies on the hit slice. It is the wrong default for “paste the whole markdown digest into the model.”

**Product rule:** keep the graph as a catalog (`--out-dir .lucider`). Give the assistant `lucider <path> --query <symbol> --depth 0|1`.

## Limitations

- **Declaration kinds.** Parsers emit function, class, method, interface, type, and enum nodes. `export const` APIs (Zod `safeParse`, Hono `compose`) are missing from the graph unless you describe them on a nearby type/`function` or add a parser kind later.
- **Query ranking.** Substring `includes` can rank `$ZodCheckBase64Params` over `$ZodCheck`. Prefer precise names; inspect the pack before sending it.
- **Annotations.** Unlabeled libraries still parse, but packs get good when authors add `ai-context`, `ai-ignore`, and `ai-deps`. That is the point of the tool.
- **Staleness.** Authored `ai-context` is fingerprinted; `--strict` can fail CI. Stale text is still emitted today — the warning is the signal, not an automatic drop.
- **This freeze.** One agent family, three tasks, two libraries. It shows token ratio at matched quality, not a universal leaderboard.

## How to pack (not dump)

```bash
pnpm build
# catalog on disk
node dist/cli/index.js src --out-dir .lucider --default-body off
# slice for the model
node dist/cli/index.js src --query login --depth 1 --md pack.md
```

Feed `pack.md` (or stdout) to Claude, Codex, or any assistant. Do not paste `.lucider/context.md` for a whole unlabeled tree.
