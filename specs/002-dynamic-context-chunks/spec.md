# Feature Specification: Dynamic Context Chunks, Ignore, and Declared Dependencies

**Feature Branch**: `002-dynamic-context-chunks`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "Bring a dynamic context structure so as the AI asks, Lucider gives short context in successive chunks. Also support ignore-style directives so secret or noisy symbols never enter the graph. Add an explicit dependency declaration (ai-deps) so a follow-up chunk can expand to related symbols the author named."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask for a short chunk, then expand (Priority: P1)

A developer (or an AI assistant acting on their behalf) does not want the whole project
context at once. They start from a compact project map, then ask for one named point
(for example a function). They receive a **short chunk**: that symbol's summary and, when
requested, its body — not the rest of the tree. If they ask a follow-up ("what does this
depend on?"), they receive a slightly larger chunk that includes the originally selected
symbol plus its immediate related points, still excluding unrelated code.

**Why this priority**: Measured comparisons showed that a full source dump is accurate but
expensive, and a summary-only index is cheap but incomplete. Successive short chunks are the
workflow that keeps accuracy while cutting tokens. Without this, Lucider remains a one-shot
dump tool.

**Independent Test**: Point the tool at a small project with several symbols. Request a chunk
for one name and confirm only that symbol appears. Request an expanded chunk for the same
name and confirm related symbols appear and unrelated ones do not.

**Acceptance Scenarios**:

1. **Given** a project with many symbols, **When** a consumer requests context for a named
   symbol at expansion depth 0, **Then** the returned chunk contains that symbol and does not
   contain unrelated symbols.
2. **Given** the same project, **When** a consumer requests an expanded chunk (depth 1) for
   that symbol, **Then** the chunk includes the symbol plus its immediate related points and
   still excludes unrelated symbols.
3. **Given** a request that matches no symbol, **When** the tool produces a chunk, **Then** the
   chunk is empty of symbols and states that nothing matched — it does not dump the project.

---

### User Story 2 - Keep ignored symbols out of context (Priority: P2)

An author marks a declaration as ignored (secret helpers, debug dumps, generated noise).
When context or a graph is produced, that declaration MUST NOT appear as a node, MUST NOT
appear in chunks, and MUST NOT be reachable as a related point. The rest of the project
continues to appear normally.

**Why this priority**: Dynamic chunks fail if ignored code can still leak into a follow-up
expansion. Exclusion is independently valuable even without chunking (smaller, safer maps).

**Independent Test**: Annotate one function as ignored and leave others visible. Generate
the full map and a chunk for a neighbouring visible symbol. Confirm the ignored function is
absent from both.

**Acceptance Scenarios**:

1. **Given** a function marked ignored and another function that is not, **When** the full
   context map is generated, **Then** only the non-ignored function appears.
2. **Given** the same sources, **When** a chunk is requested for the visible function,
   **Then** the ignored function is not in the chunk even if it sits in the same file.
3. **Given** an ignore mark written in any accepted authoring form (with or without a
   value, with or without an `@` prefix), **When** the tool runs, **Then** the declaration
   is treated as ignored and no "empty value" error is raised for that mark.

---

### User Story 3 - Declare related points so expansion is intentional (Priority: P2)

An author knows which other symbols a function really needs (helpers it calls, types it
returns). They declare those names on the function. When a consumer expands a chunk around
that function, those declared relatives are included even if the tool would not otherwise
infer the relationship. If a declared name cannot be found, the author is told — the name
is not silently dropped.

**Why this priority**: Automatic "what calls what" inference is incomplete. Explicit related
points make expansion predictable and are what make Story 1's follow-up chunk trustworthy.

**Independent Test**: On function A, declare related names B and C that exist in the project,
and a name Z that does not. Request an expanded chunk for A. Confirm B and C appear, Z does
not, and a located warning names Z.

**Acceptance Scenarios**:

1. **Given** function A declares related symbols B and C that exist, **When** an expanded
   chunk is requested for A, **Then** the chunk includes A, B, and C.
2. **Given** function A declares a related name that does not exist, **When** the map or
   chunk is generated, **Then** a located warning reports the unresolved name and the rest
   of the run continues.
3. **Given** function A declares no related symbols, **When** an expanded chunk is requested,
   **Then** expansion still includes structural neighbours (for example a method's enclosing
   type) but does not invent unrelated functions from the same file.

---

### Edge Cases

- What happens when several symbols share the requested name? → The chunk prefers the
  closest name match and may include a small number of top matches rather than the whole
  project; it still MUST NOT dump every symbol.
- How does expansion treat a file path that is not itself a symbol? → File-level
  containment MUST NOT inject the entire file's source as a symbol node.
- What happens when ignore is combined with a related-name declaration pointing at the
  ignored symbol? → The ignored symbol stays out of the graph; the declaration is treated
  as unresolved (warning), not as a leak.
- What happens when related names are listed with extra spaces or mixed order? → Names are
  interpreted as a list of identifiers; spacing MUST NOT change which symbols are linked.
- How are ignore marks without a following declaration handled? → Same as other orphaned
  directives: a located warning, no silent drop.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to request a context chunk for a named symbol (or a
  stable symbol identity) instead of receiving the full project map.
- **FR-002**: A depth-0 chunk MUST include only the matched symbol(s) and MUST exclude
  unrelated project symbols.
- **FR-003**: A depth-1 chunk MUST include the matched symbol(s) plus immediate related
  points (declared relatives and structural neighbours) and MUST still exclude unrelated
  symbols.
- **FR-004**: A chunk that matches nothing MUST be empty of symbols and MUST communicate
  that nothing matched, without emitting the full project.
- **FR-005**: Depth-0 chunks MUST be allowed to include the matched symbol's implementation
  body even when the full project map was configured to omit bodies (so follow-up questions
  can get the exact point without loading everything).
- **FR-006**: Authors MUST be able to mark a declaration as ignored using a valueless
  ignore directive, including forms with an optional `@` prefix.
- **FR-007**: Ignored declarations MUST NOT appear as nodes in the full map, MUST NOT
  appear in chunks, and MUST NOT be emitted as related points.
- **FR-008**: An ignore directive MUST NOT be reported as an empty-value error.
- **FR-009**: Authors MUST be able to declare a list of related symbol names on a
  declaration.
- **FR-010**: Declared relatives that resolve MUST appear as relationships usable for
  depth-1 expansion.
- **FR-011**: Declared relatives that do not resolve MUST produce a located warning and
  MUST NOT be silently discarded.
- **FR-012**: Chunk generation MUST NOT modify source files (read-only), consistent with
  project governance.
- **FR-013**: Repeated chunk requests on identical inputs MUST produce the same chunk
  content (stable ordering and identity).

### Key Entities

- **Context chunk**: A bounded, human-readable extract containing only the selected
  symbols (and, at depth 1, their immediate related points), not the full map.
- **Ignored declaration**: A source declaration marked so it is omitted from maps,
  graphs, and chunks.
- **Declared relative**: A named related symbol authored on a declaration, used to
  expand a chunk; may be resolved or unresolved.
- **Expansion depth**: How far a chunk may grow from the match (0 = match only,
  1 = match plus immediate related points).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a project of 8 or more symbols, a depth-0 chunk for one named symbol
  contains exactly that match set and is at least 70% smaller (by token or character
  count) than the full project map of the same sources.
- **SC-002**: 100% of declarations marked ignored are absent from both the full map and
  any chunk derived from those sources.
- **SC-003**: When a declaration lists two existing relatives, a depth-1 chunk for that
  declaration includes both relatives in 100% of cases.
- **SC-004**: 100% of unresolved related names produce a corresponding located warning.
- **SC-005**: A consumer can obtain a first useful chunk for a named symbol in under 1
  minute using only the short directive and query reference (no extra manuals).
- **SC-006**: Depth-0 and depth-1 chunks never include an ignored symbol, including when
  an ignored name is listed as a relative.

## Assumptions

- This feature extends the existing Lucider context map (feature 001); it does not replace
  the full-map generation path.
- Default expansion depths for this release are 0 (match only) and 1 (immediate related
  points). Deeper walks and live assistant-hosted query sessions are out of scope for this
  spec.
- Related names are resolved first in the same file, then uniquely in the project; ambiguous
  global matches are not auto-linked (treated as unresolved rather than guessed).
- Ignore applies to the next declaration, same association rule as other directives.
- A compact full-project map (bodies omitted) remains available as the starting context;
  chunks are the follow-up mechanism.
- Consumers may be humans or AI assistants; the chunk must be readable in either case.
