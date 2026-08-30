<!--
Sync Impact Report
Version change: 1.0.0 → 1.1.0
Modified principles:
  - I. Directive-Driven Context (clarified: association is not limited to
    the comment block immediately above a declaration)
  - Development Workflow review gate: Principles I–V → I–VI
Added sections:
  - Core Principles / VI. Interior Body Annotations (NON-NEGOTIABLE)
Removed sections: none
Follow-up TODOs: none in this file. Feature grammar, parser association,
  and tests are deferred to specify/plan/implement (not ratified here).
-->

# Lucider Constitution

## Core Principles

### I. Directive-Driven Context
Lucider MUST derive AI context exclusively from explicit, machine-readable comment
directives (e.g. `// ai-context:`, `// ai-body: off`, `// ai-ignore`) and the code
structure those directives annotate. Directives MAY appear immediately above a
declaration or inside a declaration body; both placements MUST use the same versioned
grammar. The directive grammar MUST be documented and versioned. Unrecognized or
malformed directives MUST be surfaced as warnings and MUST NOT be silently discarded,
including when they appear inside a body. Rationale: predictable, auditable context
generation requires a stable, explicit contract between the author and the tool rather
than heuristic guessing.

### II. Deterministic Graph Output
For a given input tree and directive set, Lucider MUST produce a deterministic, reproducible
graph and context artifact. Node identity, ordering, and serialization MUST be stable across
runs on identical inputs. Interior span binding (which statement or range a body-level
directive attaches to) MUST be a documented, deterministic rule of the grammar and parser.
Rationale: downstream AI systems and diffs depend on reproducibility to cache, compare, and
trust generated context.

### III. Context Minimization (NON-NEGOTIABLE)
Every generated artifact MUST minimize emitted tokens while preserving semantic completeness.
Directives such as `ai-body: off` MUST measurably reduce emitted context. Interior exclusions
MUST measurably reduce the enclosing node's emitted body relative to the unannotated body.
The tool MUST report the size/token impact so optimization is verifiable rather than assumed.
Rationale: the core value proposition is cheaper, faster, and more precise AI context.

### IV. Non-Destructive Source Handling
Lucider MUST treat source files as read-only inputs and MUST NOT modify, reformat, or reorder
original code. All results MUST be written to separate output artifacts. Rationale: a context
tool must be safe to run against any repository at any time without side effects.

### V. Language-Agnostic Core with Pluggable Parsers
The graph and context engine MUST remain independent of any single language. Language support
MUST be added through pluggable parsers (Tree-sitter grammars) behind a stable internal
interface. Interior span binding MUST be expressed through that parser interface, not as
JavaScript-only string slicing in the core. Rationale: comment-directive context is valuable
across ecosystems, so the core MUST NOT hard-code assumptions about one language.

### VI. Interior Body Annotations (NON-NEGOTIABLE)
Lucider MUST honor comment directives placed inside a declaration body, not only in the
leading comments of a symbol. An interior directive MUST bind to a documented syntactic
span (the following statement, expression, or an explicit range defined by the grammar).
A declaration-level `ai-ignore` MUST continue to omit the whole symbol from the graph.
An interior exclusion (`ai-ignore` or the grammar's interior-exclusion form) MUST omit
only that bound span from the enclosing node's emitted body and MUST NOT drop the enclosing
declaration from the graph. A directive inside a body that cannot bind to a span MUST be
reported as `orphaned` (same class of warning as an unbound declaration-level directive).
Rationale: noisy or secret lines (debug logs, dumps) live inside otherwise useful functions;
authors MUST be able to keep the symbol and cut only the interior noise.

## Technical Constraints

- Parsing MUST use Tree-sitter grammars; JavaScript is the first supported language via
  `tree-sitter-javascript`.
- Output artifacts MUST be serializable to JSON and MUST include an explicit schema version
  field.
- The directive grammar and the output schema MUST be documented in the repository.
- Interior span rules MUST be part of the versioned grammar contract, not undocumented
  parser folklore.
- Context generation SHOULD scale approximately linearly with source size; any performance
  regression MUST be justified in the change that introduces it.

## Development Workflow

- Any change to the directive grammar or output schema MUST bump the relevant schema version
  and update its documentation in the same change.
- New language parsers MUST ship with fixture-based tests covering directive extraction and
  graph construction, including at least one interior-body directive fixture when the grammar
  defines interior spans.
- Token/size-impact reporting MUST be validated by tests over representative inputs, including
  a case where an interior exclusion reduces emitted body tokens.
- Code review MUST verify compliance with Principles I–VI before merge; unavoidable deviations
  MUST be justified in the pull request description.

## Governance

This constitution supersedes other development practices for Lucider. Amendments require a
documented rationale, a version bump per the policy below, and updates to any affected
templates or documentation within the same change. All pull requests and reviews MUST verify
compliance, and any complexity or deviation MUST be explicitly justified.

Versioning policy (semantic):
- MAJOR: backward-incompatible principle removal or redefinition.
- MINOR: a new principle/section is added or guidance is materially expanded.
- PATCH: clarifications, wording, and non-semantic refinements.

**Version**: 1.1.0 | **Ratified**: 2026-08-30 | **Last Amended**: 2026-08-30
