# Contract: Performance report

**Canonical file:** `docs/performance.md`  
**HTML surface:** `docs/performance.html` (same facts, not a second source of truth)

## Required sections

1. **Summary** — quality tied across arms; Lucider query pack wins token ratio; do not paste the full Lucider index.
2. **Method** — tokenizer, isolation (one context file per agent), corpora SHAs, Aider as repo-map baseline only.
3. **Coding tasks** — three tables with tokens and rubric totals:
   - Zod `parseWithDefault` (13/13, tokens 145 633 / 4 399 / 1 406)
   - Zod `listConstraints` / `hasAbortingCheck` (16/16, tokens 145 941 / 13 183 / 4 520)
   - Hono `flattenMatchResult` / `onionTrace` / `planFetch` (16/16, tokens 153 215 / 7 124 / 2 156)
4. **Overview vs pack** — full Lucider index on Zod (~37k body-off, ~139k body-on) vs Aider map (~2.1k). Product rule: catalog on disk, model gets `--query` chunks.
5. **Limitations** — `export const` not in the current AST node set; query `includes` ranking noise; annotations required for best packs.

## Language and tone

- English only.
- Precise, reproducible, no marketing superlatives that contradict the tied quality scores.
- Aider is a baseline, not a competitor product narrative.

## Non-goals

- Agent transcripts, temporary `/tmp` paths, or Turkish scratch notes.
- Re-running the eval as part of CI.
