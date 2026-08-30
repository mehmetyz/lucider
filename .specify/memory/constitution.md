<!--
Sync Impact Report
Version change: 1.1.0 → 2.0.0
Modified principles:
  - I. Directive-Driven Context → I. Structure First, Directives Override
    (redefinition: the graph MUST be usable unlabeled; directives overlay
    emission and membership; silent heuristic omit is forbidden)
  - II. Deterministic Graph Output (expanded: default ranking and budget
    cuts MUST be reproducible; no embedding/model-dependent default order)
  - III. Context Minimization → III. Minimum Context, Full Slice Quality
    (NON-NEGOTIABLE expanded: catalog vs pack, token budget, layered
    emission; unlabeled full-index dump is a failure mode)
  - Development Workflow review gate: Principles I–VI → I–VIII
Added sections:
  - Core Principles / VII. Structural Completeness (NON-NEGOTIABLE)
  - Core Principles / VIII. Budgeted Query and Expandable Packs
Removed sections: none
Follow-up TODOs: none in this file. Adapter reference edges, token-budget
  query, diff/file seeds, extra declaration kinds, and incremental cache
  are deferred to specify/plan/implement.
-->

# Lucider Constitution

## Core Principles

### I. Structure First, Directives Override
Lucider MUST build the context graph from parsed code structure (declarations,
containment, and references) even when no comment directives are present.
Comment directives MUST overlay that graph: authored summary, body inclusion,
declaration or interior ignore, and explicit dependency names. Directives MAY
appear immediately above a declaration or inside a declaration body; both
placements MUST use the same versioned grammar. Lucider MUST NOT invent
`ignore`, authored `context` text, or omitted spans from heuristics (for
example dropping `console.log` without a directive). Unrecognized or malformed
directives MUST be surfaced as warnings and MUST NOT be silently discarded,
including when they appear inside a body. Lucider MUST NOT write directives
into user source as part of its required workflow. Rationale: a usable unlabeled
pack is the adoption path; comments remain the auditable override, not a tax
the author must pay before the tool works.

### II. Deterministic Graph Output
For a given input tree and directive set, Lucider MUST produce a deterministic,
reproducible graph and context artifact. Node identity, ordering, serialization,
default query ranking, and token-budget cuts MUST be stable across runs on
identical inputs. Interior span binding (which statement or range a body-level
directive attaches to) MUST be a documented, deterministic rule of the grammar
and parser. Default ranking and budget decisions MUST NOT depend on embedding
calls, sampled model output, or other non-reproducible scoring. Rationale:
downstream AI systems and diffs depend on reproducibility to cache, compare,
and trust generated context.

### III. Minimum Context, Full Slice Quality (NON-NEGOTIABLE)
The objective is the smallest emitted pack that preserves task-complete
semantics for the requested slice. Quality of that slice MUST NOT be traded
for an arbitrary token cut: seed signatures and seed bodies stay before
neighbor bodies. Lucider MUST distinguish an on-disk catalog (the full graph)
from a query pack (what an assistant is given). The full unlabeled index MUST
NOT be the default model payload; emitting it as if it were a pack is a
product failure mode. Emission MUST honor an explicit token budget when one
is supplied, using layered inclusion (signature, then summary, then body) so
neighbors lose bodies before seeds do. Directives such as `ai-body: off` and
interior exclusions MUST measurably reduce emitted context. The tool MUST
report size/token impact so optimization is verifiable rather than assumed.
Rationale: measured coding tasks tied on quality across dump, repo-map, and
query pack; the remaining lever is tokens at matched quality, not a smarter
model.

### IV. Non-Destructive Source Handling
Lucider MUST treat source files as read-only inputs and MUST NOT modify,
reformat, or reorder original code. All results MUST be written to separate
output artifacts. Rationale: a context tool must be safe to run against any
repository at any time without side effects.

### V. Language-Agnostic Core with Pluggable Parsers
The graph and context engine MUST remain independent of any single language.
Language support MUST be added through pluggable parsers (Tree-sitter grammars)
behind a stable internal interface. Interior span binding and structural
reference extraction MUST be expressed through that parser interface, not as
JavaScript-only string slicing in the core. Rationale: comment-directive
context and unlabeled navigation are valuable across ecosystems, so the core
MUST NOT hard-code assumptions about one language.

### VI. Interior Body Annotations (NON-NEGOTIABLE)
Lucider MUST honor comment directives placed inside a declaration body, not
only in the leading comments of a symbol. An interior directive MUST bind to
a documented syntactic span (the following statement, expression, or an
explicit range defined by the grammar). A declaration-level `ai-ignore` MUST
continue to omit the whole symbol from the graph. An interior exclusion
(`ai-ignore` or the grammar's interior-exclusion form) MUST omit only that
bound span from the enclosing node's emitted body and MUST NOT drop the
enclosing declaration from the graph. A directive inside a body that cannot
bind to a span MUST be reported as `orphaned` (same class of warning as an
unbound declaration-level directive). Rationale: noisy or secret lines (debug
logs, dumps) live inside otherwise useful functions; authors MUST be able to
keep the symbol and cut only the interior noise.

### VII. Structural Completeness (NON-NEGOTIABLE)
Adapters MUST expose the declaration kinds and reference edges needed to
navigate a module's public surface without `ai-deps`. Default `depends` edges
MUST come from parsed references; `ai-deps` MUST overlay those edges and MUST
warn on unresolved names and on conflicts with structural edges. Bindings the
grammar can name (including exported const/function-valued APIs, not only
`function`/`class`/`method`) MUST be graph nodes. Rationale: unlabeled
depth-1 otherwise either explodes (whole class body) or misses the API
(`export const`); structural edges are how packs stay small without a comment
tax.

### VIII. Budgeted Query and Expandable Packs
Query MUST accept seeds beyond symbol-name substring: at least file paths and
changed-line ranges (for example a diff). Expansion MUST be deterministic
given the graph, seeds, depth, and budget. Follow-up expansion by node id
MUST be supported so a caller can fetch more context without enlarging the
first pack. Graph rebuild SHOULD be incremental when sources are unchanged; a
full rebuild MUST remain deterministic and byte-identical to an incremental
result on the same inputs. Rationale: callers know files and diffs more often
than symbol names; a second hop preserves slice quality cheaper than a fat
first pack.

## Technical Constraints

- Parsing MUST use Tree-sitter grammars; JavaScript is the first supported
  language via `tree-sitter-javascript`.
- Output artifacts MUST be serializable to JSON and MUST include an explicit
  schema version field.
- The directive grammar and the output schema MUST be documented in the
  repository.
- Interior span rules and structural-reference contracts MUST be part of the
  versioned grammar/adapter documentation, not undocumented parser folklore.
- Context generation SHOULD scale approximately linearly with source size; any
  performance regression MUST be justified in the change that introduces it.
- Incremental caches MUST be invalidation-correct: a stale cache MUST NOT
  change emitted packs relative to a cold rebuild of the same tree.

## Development Workflow

- Any change to the directive grammar or output schema MUST bump the relevant
  schema version and update its documentation in the same change.
- New language parsers MUST ship with fixture-based tests covering directive
  extraction, graph construction, structural references, and at least one
  interior-body directive fixture when the grammar defines interior spans.
- Token/size-impact reporting MUST be validated by tests over representative
  inputs, including a case where an interior exclusion reduces emitted body
  tokens and a case where a budgeted unlabeled query is smaller than emitting
  the full index.
- Unlabeled fixtures (no directives) MUST still produce a navigable graph with
  structural `depends` edges and named exported bindings.
- Code review MUST verify compliance with Principles I–VIII before merge;
  unavoidable deviations MUST be justified in the pull request description.

## Governance

This constitution supersedes other development practices for Lucider.
Amendments require a documented rationale, a version bump per the policy
below, and updates to any affected templates or documentation within the same
change. All pull requests and reviews MUST verify compliance, and any
complexity or deviation MUST be explicitly justified.

Versioning policy (semantic):
- MAJOR: backward-incompatible principle removal or redefinition.
- MINOR: a new principle/section is added or guidance is materially expanded.
- PATCH: clarifications, wording, and non-semantic refinements.

**Version**: 2.0.0 | **Ratified**: 2026-08-30 | **Last Amended**: 2026-08-30
