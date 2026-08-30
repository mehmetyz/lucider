# Feature Specification: Budgeted Structural Packs

**Feature Branch**: `005-budgeted-structural-packs`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "Shape Lucider for minimum context at matched slice quality (constitution 2.0): unlabeled graphs with structural dependencies, exported const APIs as symbols, query packs with an explicit size budget and layered inclusion, seeds from files and diffs (not only names), follow-up fetch by symbol id, incremental rebuild when sources are unchanged. Directives remain overrides. No heuristic ignore, no dumping the full index as the assistant payload."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unlabeled code still yields a navigable slice (Priority: P1)

An author has a small project with **no** comment directives. Two functions: `login` calls `hashPassword`. They ask for a pack about `login` including one hop of related symbols. The pack names both symbols. They did not write `ai-deps`.

**Why this priority**: Constitution VII — without structural links, unlabeled depth-1 is either empty of neighbors or explodes (whole class). This story alone is a viable MVP: packs work before anyone annotates.

**Independent Test**: Two unlabeled functions, one calls the other. Request a one-hop pack for the caller. Both names appear. No ignore/context comments in the source.

**Acceptance Scenarios**:

1. **Given** unlabeled sources where `login` calls `hashPassword`, **When** a one-hop pack is requested for `login`, **Then** the pack includes `login` and `hashPassword`.
2. **Given** the same sources, **When** the project catalog is generated, **Then** a dependency from `login` to `hashPassword` is recorded without any `ai-deps` comment.
3. **Given** `ai-deps` on `login` naming an extra symbol that is also present, **When** the catalog is generated, **Then** that extra link is present in addition to the structural call link.

---

### User Story 2 - Exported const APIs are first-class symbols (Priority: P1)

A library exposes `export const parse = ...` (or similar named export), not a `function parse` declaration. An author queries `parse`. Today that API is missing unless they annotate a nearby function. After this feature, `parse` is a symbol they can pack.

**Why this priority**: Measured tasks missed public `export const` APIs; authors had to describe them on a neighbor. That is a quality hole unlabeled graphs cannot close with call edges alone.

**Independent Test**: File with only `export const parse = (x) => x` and a caller. Catalog lists `parse`. A pack for `parse` includes it.

**Acceptance Scenarios**:

1. **Given** an exported named binding `parse` (not a function declaration), **When** the catalog is generated, **Then** a symbol named `parse` exists.
2. **Given** that catalog, **When** a pack is requested for `parse`, **Then** the pack includes `parse` (signature or body per the usual body rules).
3. **Given** a function declaration `parse` and an exported const `parse` in different files, **When** catalogs are generated, **Then** both symbols exist and are distinguishable (they are not collapsed into one).

---

### User Story 3 - A size budget keeps the slice complete at the seed (Priority: P1)

An author requests a pack for a seed with a **maximum size**. Related symbols would make the pack huge if every neighbor included a full body. The tool still includes the seed’s identifying text and implementation (unless body is explicitly off). Neighbors may appear as names/summaries only, or drop, until the pack fits. The full project catalog is not what they hand the assistant.

**Why this priority**: Constitution III — quality of the requested slice is not traded for an arbitrary cut: seed before neighbors. Budget is how unlabeled depth-1 stays smaller than dumping the index.

**Independent Test**: Seed with a large related class. Pack with a tight size limit. Seed body present (if bodies are on for that symbol). Pack reported size ≤ the limit. Pack smaller than emitting every symbol in the project.

**Acceptance Scenarios**:

1. **Given** a seed whose one-hop neighborhood is larger than the stated limit, **When** a budgeted pack is requested, **Then** the reported pack size is at most that limit.
2. **Given** the same request, **When** the seed allows a body, **Then** the seed’s implementation is still in the pack after neighbor bodies have been reduced or omitted.
3. **Given** no size limit, **When** a one-hop pack is requested, **Then** behavior matches today’s slice (no silent extra cuts).
4. **Given** a request for “the whole project” as if it were a pack (no seed, no budget), **When** the operator uses the catalog path, **Then** that output is clearly the on-disk catalog, not the default assistant payload.

---

### User Story 4 - Start from a file or a change list, not only a name (Priority: P2)

An author does not remember the symbol name. They know `auth.js` changed, or they have a list of changed line ranges. They ask for a pack of symbols that live in that file or that overlap those lines, under a size budget.

**Why this priority**: Constitution VIII — callers know files and diffs more often than names. Needed for agent/PR loops; not required to prove unlabeled depth-1.

**Independent Test**: Two files. Request a pack seeded by file A. Only symbols whose span is in file A (plus budgeted neighbors if one hop is requested). A second request with a one-line change range in file A includes the symbol covering that line and excludes an unrelated symbol in file B.

**Acceptance Scenarios**:

1. **Given** symbols in `auth.js` and `cart.js`, **When** a pack is seeded by `auth.js` (zero extra hops), **Then** the pack contains `auth.js` symbols and does not contain `cart.js` symbols as seeds.
2. **Given** a changed-line range that sits inside `login` only, **When** a pack is seeded by that range (zero extra hops), **Then** `login` is included and a non-overlapping symbol is not a seed.
3. **Given** an empty change list, **When** a diff-seeded pack is requested, **Then** the tool reports that nothing matched and does not emit the full catalog as the pack.

---

### User Story 5 - Fetch more of one symbol without repeating the first pack (Priority: P2)

An assistant (or author) already has a short pack. They need the full body of one listed symbol. They request that symbol by its stable id. The follow-up is that symbol’s context (under the same body and budget rules), not a reprint of every previous neighbor.

**Why this priority**: Second hop preserves slice quality cheaper than a fat first pack. Independent of file/diff seeds.

**Independent Test**: First pack lists ids. Second request uses one id. Result is that node; it does not require re-sending the entire first pack.

**Acceptance Scenarios**:

1. **Given** a catalog with a known symbol id, **When** a pack is requested by that id, **Then** the pack includes that symbol and is identical for the same id, budget, and hop count on a second run.
2. **Given** an unknown id, **When** a pack is requested, **Then** the tool reports no match and does not emit the full catalog.

---

### User Story 6 - Unchanged sources do not change packs (Priority: P3)

An author rebuilds the catalog twice with the same tree. If the tool caches work, the pack and catalog still match a cold rebuild byte-for-byte. If a file changes, only then may results change.

**Why this priority**: Constitution VIII incremental rebuild is SHOULD; correctness of invalidation is MUST. Can ship after P1–P2.

**Independent Test**: Same inputs, two catalog builds (warm vs cold if caching exists). Serialized catalogs match. Edit one file; catalogs differ only in ways explained by that file.

**Acceptance Scenarios**:

1. **Given** identical sources, **When** the catalog is built twice, **Then** the serialized catalog is identical.
2. **Given** a cached prior build, **When** one source file changes, **Then** the new catalog reflects that file and does not keep the old symbols for that file.

---

### Edge Cases

- A call to an unknown name (no symbol in the tree) MUST NOT invent a node; the caller still appears.
- A structural link and an `ai-deps` link to the same target MUST NOT duplicate the relationship in a way that changes pack membership (union, one edge).
- `ai-deps` naming a missing symbol still warns (`unresolved_dep`); structural links are unaffected.
- Declaration-level `ai-ignore` still drops that symbol; no structural edge points at it as a pack member.
- Interior `ai-ignore` still omits only the bound span; it does not remove structural edges from the enclosing symbol.
- Size budget smaller than the seed signature alone: emit the seed identifier and summary first; report that the budget could not include the body; MUST NOT omit the seed entirely if it matched.
- Overlapping symbols on one line (class and method): the **innermost** (smallest span) is the seed for a line-range hit; the outer symbol may appear as a container hop if hops > 0.
- File seed with zero symbols (empty or comments-only file): report no match; do not dump the catalog.
- Query name ranking: an exact symbol name wins over a longer name that merely contains the substring (existing quality issue; this feature MUST keep exact-name preference).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The catalog MUST record dependency relationships from parsed references (calls and equivalent name uses to symbols in the tree) even when no `ai-deps` comment exists.
- **FR-002**: `ai-deps` MUST add to those relationships. Unresolved names MUST still warn. Membership of a pack hop MUST be the union of structural and explicit dependencies.
- **FR-003**: Exported named bindings the grammar can identify (including const/function-valued exports, not only function/class/method declarations) MUST appear as catalog symbols with stable ids.
- **FR-004**: Operators MUST be able to request a pack with an explicit maximum size, measured in the same token units the catalog already reports.
- **FR-005**: When a maximum size is set, the tool MUST fill the pack in this order: seed identity and summary, then seed body (if body is included for that symbol), then neighbor summaries, then neighbor bodies. It MUST stop before exceeding the maximum. Neighbors MUST lose bodies before seeds do.
- **FR-006**: When no maximum size is set, one-hop pack contents MUST not be silently smaller than today’s equivalent slice (aside from new symbols/edges this feature adds).
- **FR-007**: Operators MUST be able to seed a pack by symbol name (existing), by file path, and by changed-line ranges (file + start/end lines).
- **FR-008**: Operators MUST be able to seed a pack by a single catalog symbol id (follow-up fetch).
- **FR-009**: A pack request that matches nothing MUST report that outcome and MUST NOT substitute the full-project catalog.
- **FR-010**: The on-disk catalog and the assistant pack MUST remain distinct outputs. Generating the catalog MUST NOT be presented as the default “give this to the model” path.
- **FR-011**: Lucider MUST NOT omit instructions or symbols from heuristics (for example dropping logs without an ignore directive). Existing ignore and interior-ignore rules stay in force.
- **FR-012**: For identical sources, directive set, seeds, hop count, and budget, pack and catalog output MUST be deterministic across runs. If a cache is used, a warm rebuild MUST match a cold rebuild; a stale cache MUST NOT be served.
- **FR-013**: Pack and catalog MUST continue to report token/size metrics so a budgeted unlabeled slice can be compared to emitting the full index.

### Key Entities

- **Catalog**: Full project graph on disk (symbols, relationships, metrics). Not the default assistant payload.
- **Pack**: Bounded slice given to an assistant: seeds plus optional hops, after budget layering.
- **Symbol**: A named binding or declaration in the graph (functions, methods, classes, exported consts, and other kinds already in the catalog).
- **Structural dependency**: A uses/calls relationship inferred from source, not from `ai-deps`.
- **Seed**: The starting symbol set from a name, id, file, or line-range query.
- **Size budget**: Optional maximum pack size in catalog token units.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On an unlabeled fixture with a caller and a callee and no `ai-deps`, a one-hop pack for the caller includes both names in 100% of runs.
- **SC-002**: On a fixture whose only public API is an exported const (no function declaration of that name), a pack request for that name includes the symbol in 100% of runs.
- **SC-003**: On a fixture where the one-hop neighborhood is at least twice the chosen budget, a budgeted pack’s reported tokens are ≤ the budget, and the seed still includes its implementation when bodies are on for that seed.
- **SC-004**: The same budgeted unlabeled one-hop pack’s reported tokens are at least 50% lower than emitting the full catalog of that fixture (all symbols, bodies on).
- **SC-005**: File-seeded zero-hop packs never include a symbol from a file that was not named as a seed file.
- **SC-006**: Two catalog builds on identical inputs produce byte-identical serialized catalogs.
- **SC-007**: Authors can obtain a pack from a file path or a line range without typing the symbol name, in a single request.

## Assumptions

- Feature description is the constitution 2.0 follow-up: structure-first packs, budget, file/diff seeds, exported bindings, id follow-up, incremental rebuild correctness. One specify invocation covers that product slice.
- Token units are the catalog’s existing approximate token count (not a new definition of “tokens”).
- Changed-line ranges are supplied by the caller (for example from a diff). Lucider does not have to invoke a version-control tool itself in this feature, but it MUST accept file + line ranges as seed input.
- “One hop” means symbols directly related by dependency or containment already used in packs today, plus new structural dependencies.
- Duplicate `depends` pairs (structural + `ai-deps`) are a single relationship.
- Heuristic ignore, embedding-based ranking, writing comments into source, and a separate assistant-protocol server are **out of scope**.
- Incremental caching is optional to ship in the first increment (P3) but any cache MUST obey FR-012.
- Existing interior ignore, declaration ignore, and query-by-name behavior remain unless this spec says otherwise.
- Default hop count and default “bodies on for live query” stay as they are; this feature adds a budget and new seed kinds rather than changing those defaults.
- Conflict between `ai-deps` and structure means unresolved or contradictory author names (warn); it does not mean deleting a structural edge because the author omitted it from `ai-deps`.
