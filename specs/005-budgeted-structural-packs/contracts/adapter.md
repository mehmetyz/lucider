# Adapter contract: references and exported bindings

`LanguageAdapter` (Constitution V) MUST enumerate name uses so the core never
scans source with language-specific regex.

```ts
interface RefNode {
  name: string
  startLine: number
  endLine: number
  startIndex: number
  endIndex: number
}

interface LanguageAdapter {
  parseDeclarations(source: string): DeclNode[]
  parseComments(source: string): CommentNode[]
  parseStatements(source: string): StmtNode[]
  parseReferences(source: string): RefNode[]
}
```

## Declarations (additive)

`parseDeclarations` MUST include exported lexical bindings (`export const` /
`let` / `var`) as `kind: "const"`, `name` from the binding identifier, spans
covering that declaration.

Adapters that cannot list them omit them; those languages then fail unlabeled
const-API packs until implemented.

## References

- Ranges are file-absolute, exclusive `endIndex`.
- Emit identifier uses that can name a symbol (call callee, bare identifier).
- Do **not** emit object-property names, declaration names (the binding itself),
  or comments.
- Implementations that cannot list references MUST return `[]`. Unlabeled
  `depends` then stay empty except `ai-deps`; that MUST NOT be silent in docs
  (language gap), but MUST NOT crash.

JavaScript and TypeScript share the Tree-sitter walk on the existing adapter
base class.
