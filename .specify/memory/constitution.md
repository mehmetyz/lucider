<!--
Sync Impact Report
Version change: (unratified template) → 1.0.0
Modified principles: none (initial ratification)
Added sections:
  - Core Principles (I. Directive-Driven Context, II. Deterministic Graph Output,
    III. Context Minimization, IV. Non-Destructive Source Handling,
    V. Language-Agnostic Core with Pluggable Parsers)
  - Technical Constraints
  - Development Workflow
  - Governance
Removed sections: none
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no constitution-specific placeholders to update
  - .specify/templates/spec-template.md ✅ no constitution-specific placeholders to update
  - .specify/templates/tasks-template.md ✅ no constitution-specific placeholders to update
Follow-up TODOs: none
-->

# Lucider Constitution

## Core Principles

### I. Directive-Driven Context
Lucider MUST derive AI context exclusively from explicit, machine-readable comment
directives (e.g. `// ai-context:`, `// ai-body: off`) and the code structure those
directives annotate. The directive grammar MUST be documented and versioned. Unrecognized
or malformed directives MUST be surfaced as warnings and MUST NOT be silently discarded.
Rationale: predictable, auditable context generation requires a stable, explicit contract
between the author and the tool rather than heuristic guessing.

### II. Deterministic Graph Output
For a given input tree and directive set, Lucider MUST produce a deterministic, reproducible
graph and context artifact. Node identity, ordering, and serialization MUST be stable across
runs on identical inputs. Rationale: downstream AI systems and diffs depend on reproducibility
to cache, compare, and trust generated context.

### III. Context Minimization (NON-NEGOTIABLE)
Every generated artifact MUST minimize emitted tokens while preserving semantic completeness.
Directives such as `ai-body: off` MUST measurably reduce emitted context, and the tool MUST
report the size/token impact so optimization is verifiable rather than assumed. Rationale:
the core value proposition is cheaper, faster, and more precise AI context.

### IV. Non-Destructive Source Handling
Lucider MUST treat source files as read-only inputs and MUST NOT modify, reformat, or reorder
original code. All results MUST be written to separate output artifacts. Rationale: a context
tool must be safe to run against any repository at any time without side effects.

### V. Language-Agnostic Core with Pluggable Parsers
The graph and context engine MUST remain independent of any single language. Language support
MUST be added through pluggable parsers (Tree-sitter grammars) behind a stable internal
interface. Rationale: comment-directive context is valuable across ecosystems, so the core
MUST NOT hard-code assumptions about one language.

## Technical Constraints

- Parsing MUST use Tree-sitter grammars; JavaScript is the first supported language via
  `tree-sitter-javascript`.
- Output artifacts MUST be serializable to JSON and MUST include an explicit schema version
  field.
- The directive grammar and the output schema MUST be documented in the repository.
- Context generation SHOULD scale approximately linearly with source size; any performance
  regression MUST be justified in the change that introduces it.

## Development Workflow

- Any change to the directive grammar or output schema MUST bump the relevant schema version
  and update its documentation in the same change.
- New language parsers MUST ship with fixture-based tests covering directive extraction and
  graph construction.
- Token/size-impact reporting MUST be validated by tests over representative inputs.
- Code review MUST verify compliance with Principles I–V before merge; unavoidable deviations
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

**Version**: 1.0.0 | **Ratified**: 2026-08-30 | **Last Amended**: 2026-08-30
