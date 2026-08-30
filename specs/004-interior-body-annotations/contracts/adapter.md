# Adapter contract: statement ranges

`LanguageAdapter` (Constitution V) MUST grow a statement enumerator so the core never
slices bodies with language-specific string rules.

```ts
interface StmtNode {
  startLine: number
  endLine: number
  startIndex: number
  endIndex: number
}

interface LanguageAdapter {
  parseDeclarations(source: string): DeclNode[]
  parseComments(source: string): CommentNode[]
  parseStatements(source: string): StmtNode[]
}
```

## Semantics

- Ranges are file-absolute, exclusive `endIndex`, disjoint except containment of nested blocks’ inner statements (bind to the **earliest** statement that starts after the comment — typically the outer `if` if the comment is immediately above it).
- Comment and declaration nodes are not statements.
- Implementations that cannot list statements MUST return `[]`. Interior ignores then orphan; they MUST still be reported.

JavaScript and TypeScript adapters share the Tree-sitter `statement_block` child walk.
