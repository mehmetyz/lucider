import type { AnnotatedNode, ContextArtifact } from "../types.js";

const STALE_MARK: Record<string, string> = {
  stale: " ⚠️ STALE",
  unknown: "",
  fresh: "",
};

function fenceLang(file: string): string {
  if (file.endsWith(".ts") || file.endsWith(".mts") || file.endsWith(".cts")) return "ts";
  if (file.endsWith(".tsx")) return "tsx";
  return "js";
}

function renderNode(node: AnnotatedNode): string {
  const lines: string[] = [];
  const stale = STALE_MARK[node.staleness] ?? "";
  lines.push(`### ${node.name} — ${node.kind} (L${node.location.startLine})${stale}`);
  lines.push("");
  lines.push(node.context);
  if (node.contextSource === "authored") lines.push("");
  if (node.bodyIncluded && node.body !== null) {
    lines.push("");
    lines.push("```" + fenceLang(node.location.file));
    lines.push(node.body);
    lines.push("```");
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Render an AI-consumable Markdown context digest, grouped by file. This is the
 * form most useful to paste into or attach for assistants like Claude/Codex.
 */
export function renderMarkdown(artifact: ContextArtifact): string {
  const pct = (artifact.metrics.reductionRatio * 100).toFixed(1);
  const out: string[] = [];

  out.push(`# Lucider Context — ${artifact.generatedFrom}`);
  out.push("");
  out.push(
    `Schema ${artifact.schemaVersion} · Grammar ${artifact.grammarVersion} · ` +
      `${artifact.nodes.length} symbols · ${artifact.edges.length} edges · ` +
      `~${pct}% token reduction (${artifact.metrics.emittedTokens}/${artifact.metrics.rawTokens}).`,
  );
  out.push("");

  const byFile = new Map<string, AnnotatedNode[]>();
  for (const node of artifact.nodes) {
    const list = byFile.get(node.location.file) ?? [];
    list.push(node);
    byFile.set(node.location.file, list);
  }

  for (const file of [...byFile.keys()].sort()) {
    out.push(`## ${file}`);
    out.push("");
    for (const node of byFile.get(file)!) out.push(renderNode(node));
  }

  const staleNodes = artifact.nodes.filter((n) => n.staleness === "stale");
  if (staleNodes.length > 0) {
    out.push("## ⚠️ Stale context");
    out.push("");
    for (const n of staleNodes) out.push(`- \`${n.id}\` — code changed since the summary was written`);
    out.push("");
  }

  if (artifact.warnings.length > 0) {
    out.push("## Warnings");
    out.push("");
    for (const w of artifact.warnings) {
      const loc = w.location ? `${w.location.file}:${w.location.startLine}` : "";
      out.push(`- **${w.code}** ${loc} — ${w.message}`);
    }
    out.push("");
  }

  return out.join("\n");
}

/**
 * Compact follow-up chunk for dynamic context: only the selected symbols.
 */
export function renderChunk(
  generatedFrom: string,
  query: string,
  nodes: AnnotatedNode[],
  depth: number,
): string {
  const out: string[] = [];
  out.push(`# Lucider chunk — ${query || generatedFrom}`);
  out.push("");
  out.push(`${nodes.length} symbol(s) · depth ${depth}. Ask a follow-up to expand.`);
  out.push("");
  const byFile = new Map<string, AnnotatedNode[]>();
  for (const node of nodes) {
    const list = byFile.get(node.location.file) ?? [];
    list.push(node);
    byFile.set(node.location.file, list);
  }
  for (const file of [...byFile.keys()].sort()) {
    out.push(`## ${file}`);
    out.push("");
    for (const node of byFile.get(file)!) out.push(renderNode(node));
  }
  if (nodes.length === 0) {
    out.push("_No matching symbols._");
    out.push("");
  }
  return out.join("\n");
}
