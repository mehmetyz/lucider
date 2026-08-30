import type { CommentNode } from "../parsers/adapter.js";
import type { Directive } from "../types.js";

export const GRAMMAR_VERSION = "1.0.0";

/**
 * Strip comment syntax from a single physical line so the directive matcher can
 * work on the bare text. Handles line and block comment markers plus the leading
 * asterisk used inside block comment bodies.
 */
function stripCommentSyntax(line: string): string {
  let s = line.trim();
  if (s.startsWith("/*")) s = s.slice(2);
  if (s.endsWith("*/")) s = s.slice(0, -2);
  s = s.trim();
  if (s.startsWith("//")) s = s.slice(2);
  else if (s.startsWith("*")) s = s.slice(1);
  return s.trim();
}

/**
 * Extract every directive found in a comment node. A block comment may contain
 * one directive per physical line; line numbers are computed relative to the
 * comment's starting line.
 */
export function extractDirectives(
  comment: CommentNode,
  prefix: string,
): Directive[] {
  const directives: Directive[] = [];
  const pattern = new RegExp("^" + prefix + "-([a-z][a-z0-9-]*):[ \\t]*(.*)$");
  const physicalLines = comment.text.split("\n");

  physicalLines.forEach((rawLine, offset) => {
    const cleaned = stripCommentSyntax(rawLine);
    const match = pattern.exec(cleaned);
    if (!match) return;
    const key = match[1]!;
    const value = (match[2] ?? "").trim();
    const line = comment.startLine + offset;
    directives.push({
      key,
      value,
      prefix,
      raw: rawLine.trim(),
      location: { file: "", startLine: line, endLine: line },
      status: value.length === 0 ? "malformed" : "ok",
    });
  });

  return directives;
}
