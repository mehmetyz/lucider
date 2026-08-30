import type { RefNode } from "../parsers/adapter.js";
import type { AnnotatedNode, Edge } from "../types.js";
import type { RawNode } from "./nodes.js";
import type { WarningCollector } from "./warnings.js";

function span(node: AnnotatedNode): number {
  return node.location.endLine - node.location.startLine;
}

function contains(outer: AnnotatedNode, inner: AnnotatedNode): boolean {
  if (outer.id === inner.id) return false;
  if (outer.location.file !== inner.location.file) return false;
  const enclosesLines =
    outer.location.startLine <= inner.location.startLine &&
    outer.location.endLine >= inner.location.endLine;
  return enclosesLines && span(outer) > span(inner);
}

/**
 * Build containment edges. Each node is linked from its nearest enclosing symbol
 * (e.g. class -> method); top-level symbols are linked from their file
 * (module -> symbol), satisfying FR-005.
 */
export function buildContainmentEdges(nodes: AnnotatedNode[]): Edge[] {
  const edges: Edge[] = [];
  for (const node of nodes) {
    let nearest: AnnotatedNode | undefined;
    for (const candidate of nodes) {
      if (!contains(candidate, node)) continue;
      if (!nearest || span(candidate) < span(nearest)) nearest = candidate;
    }
    const from = nearest ? nearest.id : node.location.file;
    edges.push({ type: "contains", from, to: node.id });
  }
  return edges;
}

function lastDirectiveValue(node: AnnotatedNode, key: string): string | undefined {
  const matches = node.directives.filter(
    (d) => d.key === key && d.status !== "malformed" && d.status !== "unknown",
  );
  return matches.at(-1)?.value;
}

function parseDepNames(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function resolveDep(
  name: string,
  from: AnnotatedNode,
  nodes: AnnotatedNode[],
): AnnotatedNode | undefined {
  const sameFile = nodes.filter(
    (n) => n.id !== from.id && n.location.file === from.location.file && n.name === name,
  );
  if (sameFile.length >= 1) return sameFile[0];
  const global = nodes.filter((n) => n.id !== from.id && n.name === name);
  if (global.length === 1) return global[0];
  return undefined;
}

/**
 * Build `depends` edges from `ai-deps: Foo, Bar` directives. Unresolved names
 * produce `unresolved_dep` warnings and are skipped.
 */
export function buildDependsEdges(
  nodes: AnnotatedNode[],
  warnings: WarningCollector,
): Edge[] {
  const edges: Edge[] = [];
  for (const node of nodes) {
    const raw = lastDirectiveValue(node, "deps");
    if (!raw) continue;
    for (const name of parseDepNames(raw)) {
      const target = resolveDep(name, node, nodes);
      if (!target) {
        warnings.add(
          "unresolved_dep",
          `ai-deps '${name}' on '${node.name}' could not be resolved`,
          node.location,
        );
        continue;
      }
      edges.push({ type: "depends", from: node.id, to: target.id });
    }
  }
  return edges;
}

function innermostEnclosingRaw(
  raws: RawNode[],
  file: string,
  ref: RefNode,
): RawNode | undefined {
  const inside = raws.filter(
    (n) =>
      n.location.file === file &&
      n.startIndex < ref.startIndex &&
      ref.endIndex <= n.endIndex,
  );
  if (inside.length === 0) return undefined;
  return inside.reduce((a, b) =>
    a.endIndex - a.startIndex <= b.endIndex - b.startIndex ? a : b,
  );
}

/**
 * Build `depends` edges from identifier uses. Unknown names invent no node;
 * self-edges are dropped. Does not warn (unresolved `ai-deps` still warn).
 */
export function buildStructuralDepends(
  raws: RawNode[],
  nodes: AnnotatedNode[],
  refsByFile: Map<string, RefNode[]>,
): Edge[] {
  const edges: Edge[] = [];
  for (const file of [...refsByFile.keys()].sort()) {
    const refs = [...(refsByFile.get(file) ?? [])].sort(
      (a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex,
    );
    for (const ref of refs) {
      const fromRaw = innermostEnclosingRaw(raws, file, ref);
      if (!fromRaw) continue;
      const fromNode = nodes.find((n) => n.id === fromRaw.id);
      if (!fromNode) continue;
      const target = resolveDep(ref.name, fromNode, nodes);
      if (!target || target.id === fromNode.id) continue;
      edges.push({ type: "depends", from: fromNode.id, to: target.id });
    }
  }
  return edges;
}

/** One `{ type: "depends", from, to }` pair; structural ∪ authored. */
export function unionDependsEdges(structural: Edge[], authored: Edge[]): Edge[] {
  const seen = new Set<string>();
  const out: Edge[] = [];
  for (const edge of [...structural, ...authored]) {
    if (edge.type !== "depends") continue;
    const key = `${edge.from}\0${edge.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(edge);
  }
  return out;
}

export interface NeighbourSlice {
  node: AnnotatedNode;
  neighbours: AnnotatedNode[];
}

/**
 * Return a bounded context slice: the selected node plus the nodes directly
 * connected to it by any edge (FR-014).
 */
export function neighbourSlice(
  nodes: AnnotatedNode[],
  edges: Edge[],
  nodeId: string,
): NeighbourSlice | undefined {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const node = byId.get(nodeId);
  if (!node) return undefined;

  const neighbourIds = new Set<string>();
  for (const edge of edges) {
    if (edge.from === nodeId) neighbourIds.add(edge.to);
    if (edge.to === nodeId) neighbourIds.add(edge.from);
  }

  const neighbours = [...neighbourIds]
    .map((id) => byId.get(id))
    .filter((n): n is AnnotatedNode => n !== undefined)
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  return { node, neighbours };
}

function adjacentIds(edges: Edge[], id: string): string[] {
  const out: string[] = [];
  for (const edge of edges) {
    if (edge.from === id) out.push(edge.to);
    if (edge.to === id) out.push(edge.from);
  }
  return out;
}

/**
 * Breadth-first expansion from seed node ids up to `depth` hops along all edges.
 * depth 0 = seeds only; depth 1 = seeds + immediate neighbours (contains + depends).
 */
export function expandFromSeeds(
  nodes: AnnotatedNode[],
  edges: Edge[],
  seedIds: string[],
  depth: number,
): AnnotatedNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  let frontier = seedIds.filter((id) => byId.has(id));
  for (const id of frontier) seen.add(id);

  for (let hop = 0; hop < depth; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const adj of adjacentIds(edges, id)) {
        if (seen.has(adj) || !byId.has(adj)) continue;
        seen.add(adj);
        next.push(adj);
      }
    }
    frontier = next;
  }

  return [...seen]
    .map((id) => byId.get(id)!)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}
