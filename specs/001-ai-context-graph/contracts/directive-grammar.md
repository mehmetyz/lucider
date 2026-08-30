# Contract: Directive Grammar

**Grammar Version**: 1.2.0

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

Grammar 1.2.0 uses two association passes.

### Declaration-leading (unchanged from 1.1.0)

- A **directive block** is the contiguous run of comment lines/blocks immediately preceding a
  declaration, with no blank non-comment code between the block and the declaration.
- All directives in that block associate with the **next declaration** that follows them.
- `ignore` in this block excludes that declaration from the graph/artifact entirely.
- A leftover directive with no enclosing declaration (for example after the last declaration
  in a file) is **orphaned**.

### Interior ignore (1.2.0)

- An `ignore` directive that did not bind as declaration-leading, and whose span lies inside a
  declaration body, associates with the **next instruction** in that body: the next complete
  statement or block that begins at or after the comment and is fully contained in the same
  (innermost enclosing) declaration.
- The published body of the enclosing declaration excludes the ignore comment and that
  instruction. The enclosing declaration **remains** a graph node.
- If there is no following instruction, the directive is **orphaned** (`orphaned_directive`,
  message names “no following instruction”). The enclosing node is still emitted; remaining
  instructions stay in the body.
- Other leftover keys (`context`, `body`, `deps`) inside a body stay orphaned, unknown, or
  malformed as in 1.1.0; they do not omit instructions.
- Nested-function comments that match declaration-leading association bind to that nested
  declaration; they are not stolen as an outer-body omit.

## Recognized keys (registry v1)

| Key | Value domain | Meaning |
|-----|--------------|---------|
| `context` | free text | Human-authored summary overriding the derived baseline. |
| `body` | `on` \| `off` | Include or exclude the symbol body from emitted context. |
| `ignore` | (none) | Declaration-leading: exclude this declaration from the graph. Interior: omit the next instruction from the published body; keep the enclosing symbol. `ai-ignore`, `ai-ignore:`, and `@ai-ignore` are all valid. |
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
| Interior `ignore` with no following instruction | `orphaned` | `orphaned_directive` |
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

```js
function test() {
  doWork()
  // ai-ignore
  console.log('noise')
  return 1
}
```

→ node `test` exists; published body contains `doWork()` and `return 1`; does not contain the
log or the ignore comment.

```js
function test() {
  doWork()
  // ai-ignore
}
```

→ node `test` exists; `orphaned_directive` (no following instruction); `doWork()` still in the body.
