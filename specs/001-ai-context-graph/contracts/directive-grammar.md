# Contract: Directive Grammar

**Grammar Version**: 1.1.0

Directives are instructions embedded in source comments that Lucider reads to build context.
This document is the authoritative grammar contract; changes here MUST bump `grammarVersion`
(Constitution Principle I, FR-012).

## Syntax

A directive has the form:

```
<prefix>-<key>: <value>
```

- `prefix` — default `ai`; configurable. Matches `[a-z][a-z0-9]*`.
- `key` — matches `[a-z][a-z0-9-]*`.
- separator — a colon `:` followed by optional whitespace.
- `value` — the remainder of the comment line, trimmed. May be empty (→ malformed).

Directives may appear in:

- **Line comments**: `// ai-context: sums two numbers`
- **Block comments**: `/* ai-body: off */` or multi-line blocks with one directive per line.

## Association rule

- A **directive block** is the contiguous run of comment lines/blocks immediately preceding a
  declaration, with no blank non-comment code between the block and the declaration.
- All directives in that block associate with the **next declaration** that follows them.
- A directive with no following declaration before end-of-scope/file is **orphaned**.

## Recognized keys (registry v1)

| Key | Value domain | Meaning |
|-----|--------------|---------|
| `context` | free text | Human-authored summary overriding the derived baseline. |
| `body` | `on` \| `off` | Include or exclude the symbol body from emitted context. |
| `ignore` | (none) | Exclude this declaration from the graph/artifact entirely. `ai-ignore`, `ai-ignore:`, and `@ai-ignore` are all valid. |
| `deps` | comma-separated symbol names | Explicit `depends` edges used when expanding a query chunk. |

Default when `body` is unspecified: project-configured default (`--default-body`, default `on`).

## Deprecation policy

- Deprecated keys are recognized for one documented transition window and emit a
  `deprecated_key` warning naming the replacement, then continue processing (FR-008).
- Registry entry shape: `{ key, replacedBy, deprecatedInGrammar, removedInGrammar }`.
- v1 defines no deprecated keys yet; the mechanism MUST be present and tested.

## Error handling (warnings, never silent — FR-009)

| Condition | Directive `status` | Warning `code` |
|-----------|--------------------|----------------|
| Empty value where value required | `malformed` | `malformed_directive` |
| No following declaration | `orphaned` | `orphaned_directive` |
| Conflicting directives in one block (e.g. `body: on` + `body: off`) | `conflicting` | `conflict` (last-writer-wins) |
| Key not in registry | `unknown` | `unknown_key` |
| Deprecated key | `deprecated` | `deprecated_key` |

## Examples

```js
// ai-context: Generates the sum of two numbers
// ai-body: off
function sum(a, b) { return a + b; }
```

→ one `AnnotatedNode` for `sum` with authored `context`, `bodyIncluded=false`, `body=null`.

```js
// ai-context:
function noop() {}
```

→ `malformed_directive` warning; node still created with derived context.
