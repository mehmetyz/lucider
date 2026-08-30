import Parser from "tree-sitter";
import type { CommentNode, DeclNode, LanguageAdapter, StmtNode } from "./adapter.js";

type TSNode = Parser.SyntaxNode;

export interface TreeSitterAdapterConfig {
  name: string;
  extensions: string[];
  language: unknown;
  declKinds: Record<string, string>;
}

/**
 * Reusable Tree-sitter-backed adapter. Concrete language adapters supply a
 * grammar and a map of Tree-sitter node types to Lucider symbol kinds, keeping
 * the core language-agnostic (Constitution Principle V).
 */
export class TreeSitterAdapter implements LanguageAdapter {
  readonly name: string;
  readonly extensions: string[];
  private readonly parser: Parser;
  private readonly declKinds: Record<string, string>;

  constructor(config: TreeSitterAdapterConfig) {
    this.name = config.name;
    this.extensions = config.extensions;
    this.declKinds = config.declKinds;
    this.parser = new Parser();
    this.parser.setLanguage(config.language as never);
  }

  private root(source: string): TSNode {
    return this.parser.parse(source).rootNode;
  }

  parseDeclarations(source: string): DeclNode[] {
    const decls: DeclNode[] = [];
    const visit = (node: TSNode): void => {
      const kind = this.declKinds[node.type];
      if (kind) {
        const nameNode = node.childForFieldName("name");
        decls.push({
          kind,
          name: nameNode?.text ?? "<anonymous>",
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startIndex: node.startIndex,
          endIndex: node.endIndex,
          text: node.text,
        });
      }
      for (const child of node.namedChildren) visit(child);
    };
    visit(this.root(source));
    return decls;
  }

  parseComments(source: string): CommentNode[] {
    const comments: CommentNode[] = [];
    const visit = (node: TSNode): void => {
      if (node.type === "comment") {
        comments.push({
          text: node.text,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startIndex: node.startIndex,
          endIndex: node.endIndex,
        });
      }
      for (const child of node.namedChildren) visit(child);
    };
    visit(this.root(source));
    return comments;
  }

  parseStatements(source: string): StmtNode[] {
    const stmts: StmtNode[] = [];
    const visit = (node: TSNode): void => {
      if (node.type === "statement_block") {
        for (const child of node.namedChildren) {
          if (child.type === "comment") continue;
          stmts.push({
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
            startIndex: child.startIndex,
            endIndex: child.endIndex,
          });
        }
      }
      for (const child of node.namedChildren) visit(child);
    };
    visit(this.root(source));
    return stmts;
  }
}
