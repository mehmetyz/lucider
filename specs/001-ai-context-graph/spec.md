# Feature Specification: AI Context Graph from Comment Directives

**Feature Branch**: `001-ai-context-graph`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "create a project that reads the comment lines and produces a graph and context for AI. By this solution we can optimize context and performance by generating exact points. e.g. `// ai-context: This method generates sum of two numbers` / `// ai-body: off` above `function sum`. Please be aware of deprecated/stale issues and find a good solution."

## Clarifications

### Session 2026-08-30

- Q: Should `ai-context` summaries be human-authored, auto-derived, or a hybrid? → A: Hybrid — the tool auto-derives a baseline (signatures, structure) that `ai-context` directives override/enrich, and authored overrides are fingerprinted for staleness detection.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate an optimized context map from directives (Priority: P1)

A developer annotates functions, classes, and modules with lightweight comment directives
(such as `ai-context:` for a human-authored summary and `ai-body: off` to exclude the
implementation body). They run the tool over their source tree and receive a compact,
structured context artifact that an AI assistant can load instead of the full source. The
artifact contains only the "exact points" — summaries and selected code — rather than every
line, dramatically reducing the tokens an AI must ingest.

**Why this priority**: This is the core value proposition. Without the ability to turn
directives into a compact context artifact, nothing else matters. It is the smallest slice
that delivers standalone value: a developer can annotate one file and immediately get a
smaller, focused context payload.

**Independent Test**: Annotate a single source file with `ai-context` and `ai-body: off`
directives, run the tool, and confirm the output artifact contains the authored summaries,
omits the excluded bodies, and is measurably smaller than the raw source.

**Acceptance Scenarios**:

1. **Given** a function preceded by `// ai-context: ...` and `// ai-body: off`, **When** the
   tool processes the file, **Then** the output node includes the context summary and marks
   the body as excluded (body text not emitted).
2. **Given** a function preceded by `// ai-context: ...` with no `ai-body` directive,
   **When** the tool processes the file, **Then** the output node includes the summary and
   the body per the configured default.
3. **Given** a source tree with a mix of annotated and unannotated symbols, **When** the tool
   runs, **Then** the output reports the total token/size reduction versus raw source.

---

### User Story 2 - Build a navigable relationship graph (Priority: P2)

A developer wants the AI (or themselves) to understand how annotated points relate — which
module contains which function, and simple references between them — so context can be pulled
by "exact point" and its immediate neighbours instead of whole files.

**Why this priority**: Individual context snippets are useful, but the graph is what lets a
consumer request *just* the relevant node plus its neighbours, further optimizing context.
It builds on P1 but is independently demonstrable.

**Independent Test**: Run the tool over a multi-file project and confirm the output graph
contains nodes for annotated symbols with containment edges (file → symbol) and that a node
can be retrieved together with its directly connected neighbours.

**Acceptance Scenarios**:

1. **Given** a project with functions declared across several files, **When** the tool runs,
   **Then** each annotated symbol appears as a graph node with a stable identifier and a
   containment edge to its file/module.
2. **Given** the generated graph, **When** a consumer selects a node, **Then** the tool can
   return that node plus its immediate neighbours as a bounded context slice.

---

### User Story 3 - Detect stale / deprecated context (Priority: P2)

A developer changed a function's code but forgot to update its `ai-context` summary. The tool
detects that the annotated code has changed since the directive was written and flags the
directive as **stale**, so out-of-date context never silently misleads the AI.

**Why this priority**: This directly answers the "be aware of deprecated/stale issues"
concern. Human-authored comments drift from code over time; without staleness detection the
whole approach degrades into misinformation. It is independently testable and is the trust
mechanism that makes the tool safe to rely on.

**Independent Test**: Annotate a function, generate the artifact, modify the function body,
regenerate, and confirm the tool flags the directive as stale (and can optionally fail the
run in strict mode).

**Acceptance Scenarios**:

1. **Given** a previously generated artifact recording the state of an annotated symbol,
   **When** the underlying code changes but the directive text does not, **Then** the tool
   marks that node as `stale` in the output and in a human-readable warning.
2. **Given** a directive key that has been deprecated in favour of a newer key, **When** the
   tool encounters the old key, **Then** it emits a deprecation warning naming the
   replacement and still processes the directive for one documented transition period.
3. **Given** strict mode is enabled, **When** any stale directive is detected, **Then** the
   run exits with a non-zero status so CI can block merges.

---

### Edge Cases

- What happens when an `ai-context` directive is attached to nothing (no following symbol)?
  → The tool emits a warning identifying the orphaned directive and its location; it is not
  included as a node.
- How does the system handle conflicting directives on the same symbol (e.g. `ai-body: off`
  and `ai-body: on`)? → Last-writer-wins within a block, with a warning about the conflict.
- What happens when a directive value is empty (`// ai-context:`)? → Treated as malformed;
  a warning is emitted and the directive is ignored for context but the symbol may still be
  a node.
- How does the system handle files it cannot parse? → The file is skipped with a warning; the
  rest of the run continues and the artifact records which files were skipped.
- What happens when the same symbol name exists in multiple scopes/files? → Node identifiers
  incorporate location/scope so identity remains unambiguous.
- How are directives written in block comments vs. line comments treated? → Both supported;
  the association rule (directive applies to the next declaration) is consistent across styles.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read source files and extract comment directives of the form
  `<prefix>-<key>: <value>` (e.g. `ai-context:`, `ai-body: off`) from both line and block
  comments.
- **FR-002**: System MUST associate each directive with the code declaration it annotates
  (the next declaration following the directive block) using a documented, consistent rule.
- **FR-003**: System MUST support a directive to supply a human-authored summary
  (`ai-context`) and a directive to include/exclude a symbol's body from output
  (`ai-body: on|off`), with a configurable default when unspecified.
- **FR-004**: System MUST produce a structured, serializable context artifact containing, per
  annotated point: identifier, location, summary, body-inclusion decision, and staleness
  status.
- **FR-005**: System MUST produce a relationship graph of nodes and edges, minimally including
  containment edges (module/file → symbol), with stable node identifiers.
- **FR-006**: System MUST report the size/token reduction achieved versus the raw source so
  the optimization benefit is measurable.
- **FR-007**: System MUST detect and flag stale directives by comparing a recorded fingerprint
  of the annotated code against its current state, without modifying source files.
- **FR-008**: System MUST support deprecation of directive keys: recognize deprecated keys,
  emit a warning naming the replacement, and continue processing them for a documented
  transition window.
- **FR-009**: System MUST emit clear, located warnings for malformed, orphaned, conflicting,
  and unrecognized directives, and MUST NOT silently discard them.
- **FR-010**: System MUST provide a strict mode that returns a non-zero exit status when stale
  or malformed directives are present, suitable for CI gating.
- **FR-011**: System MUST treat all source files as read-only and write results only to
  separate output artifacts.
- **FR-012**: System MUST version the directive grammar and the output artifact schema, and
  include the schema version in every artifact.
- **FR-013**: System MUST allow running over a single file, a directory, or an entire project
  and produce a consolidated artifact.
- **FR-014**: System MUST be able to return a bounded context slice for a selected node (the
  node plus its immediate neighbours).

### Key Entities *(include if feature involves data)*

- **Directive**: A parsed instruction from a comment — key, value, source location, and the
  raw text it came from.
- **Annotated Node**: A code point (function, class, module, etc.) with its identifier,
  location, associated summary, body-inclusion decision, code fingerprint, and staleness
  status.
- **Edge**: A typed relationship between nodes (e.g. containment, reference) with source and
  target node identifiers.
- **Context Artifact**: The serializable output containing schema version, nodes, edges,
  warnings, and size/optimization metrics.
- **Fingerprint**: A recorded signature of an annotated symbol's code used to detect drift
  between the directive and the code it describes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a fully annotated file where all bodies are excluded, the generated context
  artifact is at least 60% smaller (by token count) than the raw source.
- **SC-002**: 100% of stale directives (code changed after the directive was written) are
  flagged when the tool is re-run after a code change.
- **SC-003**: A developer can annotate a symbol and obtain a valid context artifact for it in
  under 1 minute of first use, without reading external documentation beyond a short
  directive reference.
- **SC-004**: The tool processes a 10,000-line project and produces its artifact in a time
  that scales approximately linearly with source size (no worse than proportional growth
  versus a 1,000-line baseline).
- **SC-005**: 0 directives are silently ignored — every malformed, orphaned, or unrecognized
  directive produces a corresponding located warning.
- **SC-006**: Running in strict mode in CI blocks a merge whenever a stale or malformed
  directive is present (non-zero exit on 100% of such cases).

## Assumptions

- The first supported language is JavaScript; the design keeps language support pluggable so
  other languages can be added later (aligns with the project constitution).
- Consumers of the artifact (AI assistants or tooling) can read a JSON-serializable format;
  a machine-readable JSON artifact is the primary output, with a human-readable summary as a
  secondary view.
- Staleness detection compares against state recorded in a previously generated artifact (or
  an embedded fingerprint), so a prior run or committed artifact is available for comparison.
- The tool is intended to run locally and in CI (developer workstations and pipelines); no
  network service or hosted backend is assumed for v1.
- "Graph" for v1 focuses on containment relationships as the reliable baseline; richer
  reference/call edges are desirable but may be phased in as parser capabilities allow.
- Directive prefix defaults to `ai-` but is treated as configurable to avoid collisions.
