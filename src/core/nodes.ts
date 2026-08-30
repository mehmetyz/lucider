import type { LanguageAdapter } from "../parsers/adapter.js";
import type { Directive, Location } from "../types.js";
import type { Registry } from "../directives/registry.js";
import { extractDirectives } from "../directives/grammar.js";
import { WarningCollector } from "./warnings.js";
import { makeNodeId } from "./ids.js";

export interface RawNode {
  id: string;
  kind: string;
  name: string;
  location: Location;
  text: string;
  directives: Directive[];
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

  const commentLines = new Set<number>();
  for (const c of comments) {
    for (let l = c.startLine; l <= c.endLine; l++) commentLines.add(l);
  }

  const directivesByLine = new Map<number, Directive[]>();
  const allDirectives: Directive[] = [];
  for (const c of comments) {
    for (const d of extractDirectives(c, prefix)) {
      d.location.file = file;
      allDirectives.push(d);
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

    if (collected.some((d) => d.key === "ignore")) continue;

    const occKey = `${decl.name}#${decl.kind}`;
    const index = occurrence.get(occKey) ?? 0;
    occurrence.set(occKey, index + 1);

    nodes.push({
      id: makeNodeId(file, decl.name, decl.kind, index),
      kind: decl.kind,
      name: decl.name,
      location: { file, startLine: decl.startLine, endLine: decl.endLine },
      text: decl.text,
      directives: collected,
    });
  }

  for (const d of allDirectives) {
    if (!associated.has(d)) {
      d.status = "orphaned";
      warnings.add(
        "orphaned_directive",
        `Directive ${d.prefix}-${d.key} has no following declaration`,
        d.location,
      );
    }
  }

  return nodes;
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
