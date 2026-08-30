# Grammar 1.2.0 — Interior placement

Authoritative comment syntax remains:

[../../001-ai-context-graph/contracts/directive-grammar.md](../../001-ai-context-graph/contracts/directive-grammar.md)

This feature **requires** grammar version **1.2.0**. Keys, valueless `ignore`, `@` forms, and `deps` are unchanged from 1.1.0. The **association rule** is extended.

## Association (1.2.0)

1. **Declaration-leading (unchanged)**: A contiguous run of comment lines immediately preceding a declaration, with only blank lines between comments and no other code, associates with that **next declaration**.
2. **Interior ignore**: An `ignore` directive that did not bind in step 1, and whose span lies inside a declaration body, associates with the **next instruction** in that body: the next complete statement or block that begins at or after the comment, fully contained in the same declaration.
3. **Omit**: The published body of the enclosing declaration excludes the ignore comment and that instruction. The enclosing declaration **remains** a graph node.
4. **Orphan**: If step 2 finds no instruction, the directive is `orphaned` (`orphaned_directive`). The enclosing node is still emitted.
5. **Other keys** inside a body that did not bind in step 1 stay orphaned/unknown/malformed per 1.1.0; they do not omit instructions.

## Declaration-level ignore (unchanged)

`ignore` bound in step 1 still drops the **entire next declaration** from the graph.

## Examples

```js
function test() {
  doWork()
  // ai-ignore
  console.log('noise')
  return 1
}
```

→ node `test` exists; published body contains `doWork()` and `return 1`; does not contain the log or the ignore comment.

```js
function test() {
  doWork()
  // ai-ignore
}
```

→ node `test` exists; `orphaned_directive` for the ignore; `doWork()` still in the body.

```js
// ai-ignore
function secret() { return 1 }
```

→ `secret` is not a node (1.1.0 behavior).
