export interface DeclNode {
  kind: string;
  name: string;
  startLine: number;
  endLine: number;
  startIndex: number;
  endIndex: number;
  text: string;
}

export interface CommentNode {
  text: string;
  startLine: number;
  endLine: number;
  startIndex: number;
  endIndex: number;
}

/** File-absolute statement range (exclusive `endIndex`). Not a comment or declaration. */
export interface StmtNode {
  startLine: number;
  endLine: number;
  startIndex: number;
  endIndex: number;
}

/**
 * A language plugin. The core engine depends only on this interface so that new
 * languages can be added without touching the language-agnostic core
 * (Constitution Principle V).
 */
export interface LanguageAdapter {
  name: string;
  extensions: string[];
  parseDeclarations(source: string): DeclNode[];
  parseComments(source: string): CommentNode[];
  /** Implementations that cannot list statements MUST return `[]`. */
  parseStatements(source: string): StmtNode[];
}
