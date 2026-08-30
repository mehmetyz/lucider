import type { AnnotatedNode, ContextArtifact } from "../types.js";
import { expandFromSeeds } from "./graph.js";
import { approxTokens } from "./metrics.js";
import { renderChunk } from "../output/markdown.js";

export interface QueryLineRange {
  file: string;
  startLine: number;
  endLine: number;
}

export interface QueryArgs {
  search?: string;
  nodeId?: string;
  files?: string[];
  lineRanges?: QueryLineRange[];
  depth?: number;
  /** Include implementation bodies for nodes in the chunk. */
  includeSeedBodies?: boolean;
  /** Pack size cap (`approxTokens`). Omitted = no extra cut. */
  maxTokens?: number;
}

export interface QueryChunk {
  nodes: AnnotatedNode[];
  markdown: string;
  packTokens: number;
  truncated: boolean;
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
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.n.name.length - b.n.name.length ||
        (a.n.id < b.n.id ? -1 : 1),
    );
  return scored.map((x) => x.n);
}

function fileMatches(locationFile: string, needle: string): boolean {
  const loc = locationFile.replaceAll("\\", "/");
  const n = needle.replaceAll("\\", "/");
  if (loc === n) return true;
  if (loc.endsWith("/" + n)) return true;
  if (!n.includes("/") && loc.split("/").pop() === n) return true;
  return false;
}

function spanLines(node: AnnotatedNode): number {
  return node.location.endLine - node.location.startLine;
}

function coveringNode(
  nodes: AnnotatedNode[],
  range: QueryLineRange,
): AnnotatedNode | undefined {
  const hits = nodes.filter(
    (n) =>
      fileMatches(n.location.file, range.file) &&
      n.location.startLine <= range.startLine &&
      n.location.endLine >= range.endLine,
  );
  if (hits.length === 0) return undefined;
  return hits.reduce((a, b) => (spanLines(a) <= spanLines(b) ? a : b));
}

function selectSeeds(artifact: ContextArtifact, args: QueryArgs): AnnotatedNode[] {
  if (args.nodeId) {
    const hit = artifact.nodes.find((n) => n.id === args.nodeId);
    return hit ? [hit] : [];
  }
  if (args.lineRanges && args.lineRanges.length > 0) {
    const seeds: AnnotatedNode[] = [];
    const seen = new Set<string>();
    for (const range of args.lineRanges) {
      const hit = coveringNode(artifact.nodes, range);
      if (hit && !seen.has(hit.id)) {
        seen.add(hit.id);
        seeds.push(hit);
      }
    }
    return seeds;
  }
  if (args.files && args.files.length > 0) {
    return artifact.nodes.filter((n) => args.files!.some((f) => fileMatches(n.location.file, f)));
  }
  if (args.search && args.search.trim()) {
    const q = args.search.trim();
    let ranked = rankMatches(artifact.nodes, q);
    if (ranked.some((n) => n.name.toLowerCase() === q.toLowerCase())) {
      ranked = ranked.filter((n) => n.name.toLowerCase() === q.toLowerCase());
    }
    return ranked.slice(0, 3);
  }
  return [];
}

function queryLabel(args: QueryArgs): string {
  if (args.nodeId) return args.nodeId;
  if (args.lineRanges && args.lineRanges.length > 0) {
    return args.lineRanges.map((r) => `${r.file}:${r.startLine}-${r.endLine}`).join(",");
  }
  if (args.files && args.files.length > 0) return args.files.join(",");
  return args.search ?? "";
}

function emissionTokens(node: AnnotatedNode): number {
  const chunk =
    node.bodyIncluded && node.body !== null ? `${node.context}\n${node.body}` : node.context;
  return approxTokens(chunk);
}

function packTokensOf(nodes: AnnotatedNode[]): number {
  let total = 0;
  for (const n of nodes) total += emissionTokens(n);
  return total;
}

function attachBodies(
  expanded: AnnotatedNode[],
  seedIds: Set<string>,
  depth: number,
  includeSeedBodies: boolean | undefined,
): AnnotatedNode[] {
  return expanded.map((n) => {
    if (!includeSeedBodies) return { ...n, bodyIncluded: false, body: n.body };
    const isSeed = seedIds.has(n.id);
    if (isSeed || depth >= 1) {
      return { ...n, bodyIncluded: n.body !== null, body: n.body };
    }
    return { ...n, bodyIncluded: false };
  });
}

function applyBudget(
  expanded: AnnotatedNode[],
  seedIds: Set<string>,
  depth: number,
  includeSeedBodies: boolean | undefined,
  maxTokens: number,
): { nodes: AnnotatedNode[]; truncated: boolean } {
  const seedList = expanded.filter((n) => seedIds.has(n.id));
  const neighborList = expanded.filter((n) => !seedIds.has(n.id));
  const included: AnnotatedNode[] = [];
  let used = 0;
  let truncated = false;

  for (const n of seedList) {
    included.push({ ...n, bodyIncluded: false, body: n.body });
    used += approxTokens(n.context);
  }

  for (const n of seedList) {
    if (!includeSeedBodies || n.body === null) continue;
    const extra = approxTokens(`${n.context}\n${n.body}`) - approxTokens(n.context);
    const slot = included.find((x) => x.id === n.id)!;
    if (used + extra <= maxTokens) {
      slot.bodyIncluded = true;
      used += extra;
    } else {
      truncated = true;
    }
  }

  for (const n of neighborList) {
    const cost = approxTokens(n.context);
    if (used + cost > maxTokens) continue;
    included.push({ ...n, bodyIncluded: false, body: n.body });
    used += cost;
  }

  if (includeSeedBodies && depth >= 1) {
    for (const n of neighborList) {
      if (n.body === null) continue;
      const slot = included.find((x) => x.id === n.id);
      if (!slot) continue;
      const extra = approxTokens(`${n.context}\n${n.body}`) - approxTokens(n.context);
      if (used + extra <= maxTokens) {
        slot.bodyIncluded = true;
        used += extra;
      }
    }
  }

  included.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { nodes: included, truncated };
}

/**
 * Dynamic context: start from a search / node id / file / line range, then
 * expand `depth` hops along the graph (containment + depends). Optional
 * `maxTokens` fills seed summary/body before neighbor layers.
 */
export function queryChunk(artifact: ContextArtifact, args: QueryArgs): QueryChunk {
  const depth = args.depth ?? 0;
  const seeds = selectSeeds(artifact, args);

  if (seeds.length === 0) {
    const markdown = renderChunk(
      artifact.generatedFrom,
      queryLabel(args),
      [],
      depth,
    );
    return { nodes: [], markdown, packTokens: 0, truncated: false };
  }

  const expanded = expandFromSeeds(
    artifact.nodes,
    artifact.edges,
    seeds.map((s) => s.id),
    depth,
  );

  const seedIds = new Set(seeds.map((s) => s.id));
  let nodes: AnnotatedNode[];
  let truncated = false;

  if (args.maxTokens !== undefined) {
    const layered = applyBudget(expanded, seedIds, depth, args.includeSeedBodies, args.maxTokens);
    nodes = layered.nodes;
    truncated = layered.truncated;
  } else {
    nodes = attachBodies(expanded, seedIds, depth, args.includeSeedBodies);
  }

  let markdown = renderChunk(artifact.generatedFrom, queryLabel(args), nodes, depth);
  if (truncated) {
    markdown += "_budget_truncated: seed body omitted to stay within the token budget._\n";
  }

  return {
    nodes,
    markdown,
    packTokens: packTokensOf(nodes),
    truncated,
  };
}
