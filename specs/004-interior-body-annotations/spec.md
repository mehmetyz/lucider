# Feature Specification: Interior Body Annotations

**Feature Branch**: `004-interior-body-annotations`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "Add inline annotations inside bodies (constitution VI). Example: `// ai-ignore` above a `console.log` inside a function must omit that statement from published context without dropping the function from the graph."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hide noisy lines inside a useful function (Priority: P1)

An author has a function they want assistants to see, but the body contains debug logs,
dumps, or other noise. They place an ignore comment immediately above that noisy
instruction. When Lucider publishes context for the function, the function is still
listed and its remaining body is still there; only the ignored instruction is gone.

**Why this priority**: This is the gap constitution principle VI exists to close.
Declaration-level ignore is too coarse: authors currently must hide the whole symbol
or ship the noise. This story alone is a viable MVP.

**Independent Test**: One function with a useful instruction and a debug log marked
ignored. Generate context for that function. Confirm the function is present, the
useful instruction is present, and the debug log is absent.

**Acceptance Scenarios**:

1. **Given** a visible function whose body has a useful instruction and a following
   ignore mark plus a debug log, **When** context is generated for that function,
   **Then** the published body includes the useful instruction and does not include
   the debug log.
2. **Given** the same sources, **When** the project map is generated, **Then** the
   function still appears as a symbol (it is not treated as a fully ignored
   declaration).
3. **Given** a query/chunk request for that function, **When** the chunk includes a
   body, **Then** the chunk body matches the published body (ignored instruction
   still absent).

---

### User Story 2 - Whole-symbol ignore still means “this function does not exist” (Priority: P1)

An author who marks ignore on the function itself (the existing placement, immediately
above the declaration) still wants the entire symbol omitted from the map and from
chunks. Interior ignore must not change that contract.

**Why this priority**: Interior marks must not weaken the existing ignore guarantee
(secrets and dump helpers stay off the graph). Shipping interior ignore without this
would be a regression.

**Independent Test**: One function ignored at declaration level, another with only an
interior ignore. Map contains only the second. Chunks never name the first.

**Acceptance Scenarios**:

1. **Given** a function with ignore immediately above its declaration, **When** the
   map is generated, **Then** that function is absent.
2. **Given** a neighboring function that only uses interior ignore, **When** the map
   is generated, **Then** the neighboring function is present.
3. **Given** a chunk request for the declaration-ignored function, **When** the tool
   responds, **Then** that function is not in the chunk.

---

### User Story 3 - Unbound interior ignore is visible, not silent (Priority: P2)

An author puts an ignore comment inside a function where there is no following
instruction to attach to (end of body, or only blank lines after it). The function
stays on the map. The tool reports that the mark did not attach. Nothing is silently
dropped from the rest of the body.

**Why this priority**: Constitution I and VI forbid silent discard. Authors need a
signal when a mark did nothing, without losing the enclosing function.

**Independent Test**: Function whose last line is an ignore comment. Map still lists
the function. A warning (or equivalent author-visible report) states the mark is
unbound. Published body still contains the real instructions.

**Acceptance Scenarios**:

1. **Given** an ignore comment inside a body with no following instruction, **When**
   the tool runs, **Then** it reports an unbound/orphaned mark and does not omit
   the enclosing function from the map.
2. **Given** the same function, **When** context is published, **Then** instructions
   that were not marked remain in the body.

---

### Edge Cases

- What happens when ignore sits above a whole block (for example an `if` / loop)?
  The entire following instruction — including that block — is omitted as one span.
- What happens with two ignore marks in a row, each above its own instruction?
  Each mark omits only its own following instruction.
- What happens if `ai-body: off` is set on the function and an interior ignore also
  exists? No body is published (declaration-level body exclusion wins); the function
  remains on the map unless declaration-level ignore is also set.
- What happens if the ignored instruction is the only instruction in the body?
  The function remains on the map; published body has no remaining instructions
  (empty or structurally empty body is allowed).
- How does the system handle an ignore comment that is not a directive (ordinary
  comment)? Ordinary comments are not ignore marks; they do not omit the following
  instruction.
- What happens on languages not yet supported for interior binding? Behavior MUST
  stay deterministic: either interior marks bind using the same documented rule, or
  they are reported unbound. They MUST NOT be silently discarded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Authors MUST be able to place the existing valueless ignore directive
  inside a declaration body, immediately above an instruction, using the same
  comment forms already accepted above declarations.
- **FR-002**: An interior ignore MUST bind to exactly one following instruction
  (the next complete instruction or block). That bound span MUST be omitted from
  the published body of the enclosing symbol.
- **FR-003**: An interior ignore MUST NOT remove the enclosing symbol from the
  project map or from chunks.
- **FR-004**: An ignore directive immediately above a declaration MUST continue to
  omit the entire symbol from the map and from chunks (existing behavior).
- **FR-005**: The omit span MUST include the ignore comment itself so the mark
  does not appear in published context.
- **FR-006**: A query or follow-up chunk that includes a body MUST use the same
  published body as the map (interior omissions applied).
- **FR-007**: An interior ignore that cannot bind to a following instruction MUST
  be reported as unbound/orphaned and MUST NOT silently remove other instructions
  or the enclosing symbol.
- **FR-008**: Unrecognized or malformed directives inside a body MUST be reported
  and MUST NOT be silently discarded.
- **FR-009**: Published size/token reporting MUST reflect interior omissions
  (published body smaller than the unannotated body when at least one interior
  span was omitted).
- **FR-010**: Sources without interior marks MUST produce the same published
  bodies as before this feature (no surprise omissions).
- **FR-011**: The documented comment contract MUST describe interior placement
  and the “next instruction” binding rule in the same change that enables the
  behavior.

### Key Entities

- **Enclosing symbol**: A mapped declaration (function, method, or other existing
  symbol kinds) whose body may contain interior marks.
- **Interior ignore mark**: A valueless ignore directive placed inside a body
  rather than immediately above the declaration.
- **Bound span**: The following instruction (or block) plus the ignore comment
  that marked it; omitted from published context.
- **Published body**: The body text (or equivalent) shown in maps and chunks
  after interior omissions and declaration-level body exclusion are applied.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a fixture function that contains one ignored debug instruction
  and one kept instruction, 100% of generated maps and chunks list the function,
  include the kept instruction, and exclude the debug instruction.
- **SC-002**: 100% of declaration-level ignored symbols remain absent from maps
  and chunks (no regression vs current ignore behavior).
- **SC-003**: 100% of interior ignore marks that have no following instruction
  produce an author-visible unbound warning and leave the enclosing symbol on
  the map.
- **SC-004**: For a representative function whose ignored span is at least 20%
  of the raw body, published body size is at least 20% smaller than the
  unannotated body (token or character measure, same method the product already
  reports).
- **SC-005**: Authors can complete the primary task (hide one interior
  instruction, keep the function) with a single ignore comment and no other
  annotations; a reviewer can confirm the outcome from published context alone
  without reading tool internals.

## Assumptions

- Feature description comes from constitution v1.1.0 principle VI and the author’s
  example of ignore above a debug log inside a function; `/speckit-specify` was
  invoked without a new paragraph.
- Binding rule for this feature is **next instruction only**. Explicit range
  delimiters (start/end pairs, line ranges) are out of scope.
- Interior **ignore** is in scope. Interior `ai-context` / `ai-deps` / `ai-body`
  on a single instruction are out of scope; if those keys appear inside a body
  they follow existing malformed/unknown/orphan reporting unless they sit in the
  declaration’s leading comment block.
- “Instruction” means the next complete statement or block the author would
  point at (a call, an assignment, a whole `if`/`for` block), not a fragment
  of an expression.
- First supported language remains the project’s current language; additional
  languages must not silently eat interior marks (see edge cases).
- Lucider remains read-only toward source files (constitution IV).
- Existing valueless ignore forms (`ai-ignore`, `ai-ignore:`, `@ai-ignore`,
  `@ai ignore`) apply unchanged to interior placement.
