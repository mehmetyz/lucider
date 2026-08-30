import type { RawNode } from "./nodes.js";
import type { ContextSource } from "../types.js";

export type BodyDefault = "on" | "off";

export interface ContextResult {
  derivedSummary: string;
  context: string;
  contextSource: ContextSource;
  bodyIncluded: boolean;
  body: string | null;
}

/**
 * Auto-derive a baseline summary from the declaration text: the signature up to
 * the opening brace, with whitespace collapsed. This is the "derived" half of
 * the hybrid context strategy (clarification 2026-08-30).
 */
export function deriveSummary(node: RawNode): string {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  const head = braceIndex === -1 ? text.split("\n")[0] ?? text : text.slice(0, braceIndex);
  return head.replace(/\s+/g, " ").trim();
}

function lastDirectiveValue(node: RawNode, key: string): string | undefined {
  const matches = node.directives.filter(
    (d) => d.key === key && d.status !== "malformed" && d.status !== "unknown",
  );
  return matches.at(-1)?.value;
}

/**
 * Combine the derived baseline with authored overrides. Authored `ai-context`
 * wins over the derived summary; `ai-body` (or the configured default) decides
 * whether the implementation body is emitted.
 */
export function applyContext(node: RawNode, defaultBody: BodyDefault): ContextResult {
  const derivedSummary = deriveSummary(node);

  const authored = lastDirectiveValue(node, "context");
  const useAuthored = authored !== undefined && authored.length > 0;
  const context = useAuthored ? authored! : derivedSummary;
  const contextSource: ContextSource = useAuthored ? "authored" : "derived";

  const bodyDirective = lastDirectiveValue(node, "body");
  const bodyIncluded =
    bodyDirective === "on" ? true : bodyDirective === "off" ? false : defaultBody === "on";

  return {
    derivedSummary,
    context,
    contextSource,
    bodyIncluded,
    body: bodyIncluded ? spliceOmitRanges(node.text, node.startIndex, node.omitRanges) : null,
  };
}

function spliceOmitRanges(
  text: string,
  declStart: number,
  ranges: { startIndex: number; endIndex: number }[] | undefined,
): string {
  if (!ranges || ranges.length === 0) return text;

  const locals = ranges
    .map((r) => ({ start: r.startIndex - declStart, end: r.endIndex - declStart }))
    .filter((r) => r.start >= 0 && r.end <= text.length && r.start < r.end)
    .sort((a, b) => a.start - b.start);

  const parts: string[] = [];
  let cursor = 0;
  for (const r of locals) {
    if (r.start < cursor) continue;
    if (r.start > cursor) parts.push(text.slice(cursor, r.start));
    cursor = r.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.join("");
}
