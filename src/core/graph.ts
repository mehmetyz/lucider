import type { AnnotatedNode, Edge } from "../types.js";

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
