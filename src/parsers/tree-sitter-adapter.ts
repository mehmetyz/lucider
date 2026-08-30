import Parser from "tree-sitter";
import type { CommentNode, DeclNode, LanguageAdapter, RefNode, StmtNode } from "./adapter.js";

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
      if (node.type === "export_statement") {
        pushExportedLexicals(node, decls);
      }
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

  parseReferences(source: string): RefNode[] {
    const refs: RefNode[] = [];
    const visit = (node: TSNode): void => {
      if (isNameUse(node)) {
        refs.push({
          name: node.text,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startIndex: node.startIndex,
          endIndex: node.endIndex,
        });
      }
      for (const child of node.namedChildren) visit(child);
    };
    visit(this.root(source));
    return refs;
  }
}

function pushExportedLexicals(exportNode: TSNode, decls: DeclNode[]): void {
  for (const child of exportNode.namedChildren) {
    if (child.type !== "lexical_declaration" && child.type !== "variable_declaration") {
      continue;
    }
    for (const declarator of child.namedChildren) {
      if (declarator.type !== "variable_declarator") continue;
      const nameNode = declarator.childForFieldName("name");
      decls.push({
        kind: "const",
        name: nameNode?.text ?? "<anonymous>",
        startLine: declarator.startPosition.row + 1,
        endLine: declarator.endPosition.row + 1,
        startIndex: declarator.startIndex,
        endIndex: declarator.endIndex,
        text: declarator.text,
      });
    }
  }
}

function sameNode(a: TSNode | null | undefined, b: TSNode): boolean {
  return !!a && a.startIndex === b.startIndex && a.endIndex === b.endIndex && a.type === b.type;
}

function isNameUse(node: TSNode): boolean {
  if (node.type !== "identifier") return false;
  const parent = node.parent;
  if (!parent) return false;
  if (sameNode(parent.childForFieldName("name"), node)) return false;
  if (parent.type === "member_expression" && sameNode(parent.childForFieldName("property"), node)) {
    return false;
  }
  if (parent.type === "pair" && sameNode(parent.childForFieldName("key"), node)) return false;
  if (parent.type === "formal_parameters" || parent.type === "required_parameter") return false;
  if (parent.type === "rest_pattern" || parent.type === "array_pattern" || parent.type === "object_pattern") {
    return false;
  }
  if (parent.type === "import_specifier" || parent.type === "namespace_import") return false;
  return true;
}
