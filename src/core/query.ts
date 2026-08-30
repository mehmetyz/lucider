import type { AnnotatedNode, ContextArtifact } from "../types.js";
import { expandFromSeeds } from "./graph.js";
import { renderChunk } from "../output/markdown.js";

export interface QueryArgs {
  search?: string;
  nodeId?: string;
  depth?: number;
  /** Include implementation bodies for nodes in the chunk. */
  includeSeedBodies?: boolean;
}

export interface QueryChunk {
  nodes: AnnotatedNode[];
  markdown: string;
}

function rankMatches(nodes: AnnotatedNode[], q: string): AnnotatedNode[] {
  const needle = q.toLowerCase();
  const scored = nodes
    .map((n) => {
      const name = n.name.toLowerCase();
      const idTail = n.id.includes("::")
        ? n.id.slice(n.id.indexOf("::") + 2).toLowerCase()
        : n.id.toLowerCase();
      const ctx = n.context.toLowerCase();
      let score = 0;
      if (name === needle) score = 100;
      else if (name.includes(needle)) score = 80;
      else if (idTail.includes(needle)) score = 60;
      else if (ctx.includes(needle)) score = 40;
      return { n, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.n.id < b.n.id ? -1 : 1));
  return scored.map((x) => x.n);
}

/**
 * Dynamic context: start from a search / node id, then expand `depth` hops
 * along the graph (containment + ai-deps). Bodies are attached only when
 * requested — index stays small, follow-up queries fetch exact points.
 */
export function queryChunk(artifact: ContextArtifact, args: QueryArgs): QueryChunk {
  const depth = args.depth ?? 0;
  let seeds: AnnotatedNode[] = [];
  if (args.nodeId) {
    const hit = artifact.nodes.find((n) => n.id === args.nodeId);
    if (hit) seeds = [hit];
  } else if (args.search && args.search.trim()) {
    const q = args.search.trim();
    let ranked = rankMatches(artifact.nodes, q);
    if (ranked.some((n) => n.name.toLowerCase() === q.toLowerCase())) {
      ranked = ranked.filter((n) => {
        const name = n.name.toLowerCase();
        const needle = q.toLowerCase();
        return name === needle || name.includes(needle);
      });
    }
    seeds = ranked.slice(0, 3);
  }

  const expanded = expandFromSeeds(
    artifact.nodes,
    artifact.edges,
    seeds.map((s) => s.id),
    depth,
  );

  const seedIds = new Set(seeds.map((s) => s.id));
  const withBodies = expanded.map((n) => {
    if (!args.includeSeedBodies) return { ...n, bodyIncluded: false, body: n.body };
    const isSeed = seedIds.has(n.id);
    if (isSeed || depth >= 1) {
      return { ...n, bodyIncluded: n.body !== null, body: n.body };
    }
    return { ...n, bodyIncluded: false };
  });

  return {
    nodes: withBodies,
    markdown: renderChunk(artifact.generatedFrom, args.search ?? args.nodeId ?? "", withBodies, depth),
  };
}
