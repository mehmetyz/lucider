# Contract: Query pack (005 delta)

Extends [../../002-dynamic-context-chunks/contracts/query.md](../../002-dynamic-context-chunks/contracts/query.md).
Artifact schema remains 1.0.0. Grammar remains 1.2.0.

## Library

```
queryChunk(artifact, {
  search?, nodeId?, files?, lineRanges?,
  depth?, includeSeedBodies?, maxTokens?
}) → { nodes, markdown, packTokens }
```

Seed selection (first defined wins):

1. `nodeId` — 0 or 1 node
2. `lineRanges` — `{ file, startLine, endLine }[]` inclusive; innermost covering symbol per range
3. `files` — all nodes whose `location.file` equals or ends with the given path
4. `search` — unchanged rank; exact name still preferred over longer substring

Then `expandFromSeeds` on `contains` + `depends` (structural ∪ `ai-deps`).

`maxTokens` omitted: body rules unchanged from 002 (`includeSeedBodies`, depth ≥ 1).

`maxTokens` set: copy nodes and apply layered fill ([data-model.md](../data-model.md)).
`packTokens` = `approxTokens` of the emitted pack strings (same function as catalog
metrics). `markdown` is `renderChunk` of the **layered** nodes.

Empty seeds: `nodes = []`, `packTokens = 0`, markdown includes `_No matching symbols._`
(never the full catalog).

## Determinism

Same artifact + args → same node ids, same `packTokens`, same markdown.
