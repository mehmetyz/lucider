import type { CommentNode, DeclNode, LanguageAdapter, StmtNode } from "../parsers/adapter.js";
import type { Directive, Location } from "../types.js";
import type { Registry } from "../directives/registry.js";
import { extractDirectives } from "../directives/grammar.js";
import { WarningCollector } from "./warnings.js";
import { makeNodeId } from "./ids.js";

export interface OmitRange {
  startIndex: number;
  endIndex: number;
}

export interface RawNode {
  id: string;
  kind: string;
  name: string;
  location: Location;
  /** File-absolute start of `text` (declaration span). */
  startIndex: number;
  endIndex: number;
  text: string;
  directives: Directive[];
  /** File-absolute spans to splice out of the published body. */
  omitRanges: OmitRange[];
}

export interface BuildNodesArgs {
  file: string;
  source: string;
  adapter: LanguageAdapter;
  prefix: string;
  registry: Registry;
  warnings: WarningCollector;
}

export function buildNodes(args: BuildNodesArgs): RawNode[] {
  const { file, source, adapter, prefix, registry, warnings } = args;

  const decls = adapter
    .parseDeclarations(source)
    .sort((a, b) => a.startIndex - b.startIndex);
  const comments = adapter.parseComments(source);
  const statements = adapter.parseStatements(source);

  const commentLines = new Set<number>();
  for (const c of comments) {
    for (let l = c.startLine; l <= c.endLine; l++) commentLines.add(l);
  }

  const directivesByLine = new Map<number, Directive[]>();
  const commentByDirective = new Map<Directive, CommentNode>();
  const allDirectives: Directive[] = [];
  for (const c of comments) {
    for (const d of extractDirectives(c, prefix)) {
      d.location.file = file;
      allDirectives.push(d);
      commentByDirective.set(d, c);
      const bucket = directivesByLine.get(d.location.startLine) ?? [];
      bucket.push(d);
      directivesByLine.set(d.location.startLine, bucket);
    }
  }

  const sourceLines = source.split("\n");
  const isBlank = (line: number): boolean =>
    (sourceLines[line - 1] ?? "").trim().length === 0;

  const associated = new Set<Directive>();
  const nodes: RawNode[] = [];
  const occurrence = new Map<string, number>();

  for (const decl of decls) {
    const collected: Directive[] = [];
    for (let line = decl.startLine - 1; line >= 1; line--) {
      if (isBlank(line)) continue;
      if (!commentLines.has(line)) break;
      const onLine = directivesByLine.get(line);
      if (onLine) collected.push(...onLine);
    }
    collected.reverse(); // restore top-to-bottom order
    for (const d of collected) associated.add(d);

    resolveStatuses(collected, registry, warnings);
    detectConflicts(collected, file, decl.startLine, warnings);

    // Declaration-leading ignore still drops the whole symbol (US2).
    if (collected.some((d) => d.key === "ignore")) continue;

    const occKey = `${decl.name}#${decl.kind}`;
    const index = occurrence.get(occKey) ?? 0;
    occurrence.set(occKey, index + 1);

    nodes.push({
      id: makeNodeId(file, decl.name, decl.kind, index),
      kind: decl.kind,
      name: decl.name,
      location: { file, startLine: decl.startLine, endLine: decl.endLine },
      startIndex: decl.startIndex,
      endIndex: decl.endIndex,
      text: decl.text,
      directives: collected,
      omitRanges: [],
    });
  }

  const nodeByStart = new Map(nodes.map((n) => [n.startIndex, n]));

  for (const d of allDirectives) {
    if (associated.has(d)) continue;

    const comment = commentByDirective.get(d);
    if (d.key === "ignore" && comment) {
      const enclosing = innermostEnclosingDecl(decls, comment);
      if (enclosing) {
        const node = nodeByStart.get(enclosing.startIndex);
        const stmt = nextContainedStatement(statements, comment, enclosing);
        if (node && stmt) {
          associated.add(d);
          resolveStatuses([d], registry, warnings);
          node.directives.push(d);
          node.omitRanges.push({
            startIndex: comment.startIndex,
            endIndex: stmt.endIndex,
          });
          continue;
        }
        d.status = "orphaned";
        warnings.add(
          "orphaned_directive",
          `Directive ${d.prefix}-${d.key} has no following instruction`,
          d.location,
        );
        continue;
      }
    }

    d.status = "orphaned";
    warnings.add(
      "orphaned_directive",
      `Directive ${d.prefix}-${d.key} has no following declaration`,
      d.location,
    );
  }

  return nodes;
}

function innermostEnclosingDecl(
  decls: DeclNode[],
  comment: CommentNode,
): DeclNode | undefined {
  const inside = decls.filter(
    (d) => d.startIndex < comment.startIndex && comment.endIndex <= d.endIndex,
  );
  if (inside.length === 0) return undefined;
  return inside.reduce((a, b) =>
    a.endIndex - a.startIndex <= b.endIndex - b.startIndex ? a : b,
  );
}

function nextContainedStatement(
  statements: StmtNode[],
  comment: CommentNode,
  enclosing: DeclNode,
): StmtNode | undefined {
  let best: StmtNode | undefined;
  for (const stmt of statements) {
    if (stmt.startIndex < comment.endIndex) continue;
    if (stmt.startIndex < enclosing.startIndex) continue;
    if (stmt.endIndex > enclosing.endIndex) continue;
    if (!best || stmt.startIndex < best.startIndex) best = stmt;
  }
  return best;
}

function resolveStatuses(
  directives: Directive[],
  registry: Registry,
  warnings: WarningCollector,
): void {
  for (const d of directives) {
    if (d.status === "malformed") {
      warnings.add(
        "malformed_directive",
        `Directive ${d.prefix}-${d.key} has an empty value`,
        d.location,
      );
      continue;
    }
    const deprecation = registry.deprecationOf(d.key);
    if (deprecation) {
      d.status = "deprecated";
      warnings.add(
        "deprecated_key",
        `Directive key '${d.key}' is deprecated; use '${deprecation.replacedBy}'`,
        d.location,
      );
      continue;
    }
    if (!registry.isKnown(d.key)) {
      d.status = "unknown";
      warnings.add(
        "unknown_key",
        `Unrecognized directive key '${d.key}'`,
        d.location,
      );
    }
  }
}

function detectConflicts(
  directives: Directive[],
  file: string,
  declLine: number,
  warnings: WarningCollector,
): void {
  const byKey = new Map<string, Directive[]>();
  for (const d of directives) {
    if (d.status === "malformed" || d.status === "unknown") continue;
    const list = byKey.get(d.key) ?? [];
    list.push(d);
    byKey.set(d.key, list);
  }
  for (const [key, list] of byKey) {
    const values = new Set(list.map((d) => d.value));
    if (list.length > 1 && values.size > 1) {
      warnings.add(
        "conflict",
        `Conflicting '${key}' directives; last one wins`,
        { file, startLine: declLine, endLine: declLine },
      );
    }
  }
}
