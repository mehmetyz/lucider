import type { CommentNode } from "../parsers/adapter.js";
import type { Directive } from "../types.js";

export const GRAMMAR_VERSION = "1.1.0";

/** Keys that are valid with no value (`ai-ignore` or `ai-ignore:`). */
export const VALUELESS_KEYS = new Set(["ignore"]);

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
 * Normalize `@ai-ignore`, `@ai ignore`, and `ai ignore` into `ai-ignore` form.
 */
export function normalizeDirectiveLine(cleaned: string, prefix: string): string {
  let s = cleaned;
  if (s.startsWith("@")) s = s.slice(1).trim();
  const spaced = new RegExp("^" + prefix + "\\s+");
  if (spaced.test(s)) {
    s = prefix + "-" + s.slice(prefix.length).trim();
  }
  return s;
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
  const pattern = new RegExp("^" + prefix + "-([a-z][a-z0-9-]*)(?::[ \\t]*(.*))?$");
  const physicalLines = comment.text.split("\n");

  physicalLines.forEach((rawLine, offset) => {
    const cleaned = normalizeDirectiveLine(stripCommentSyntax(rawLine), prefix);
    const match = pattern.exec(cleaned);
    if (!match) return;
    const key = match[1]!;
    const hadColon = match[2] !== undefined;
    const value = (match[2] ?? "").trim();
    const line = comment.startLine + offset;
    const valueless = VALUELESS_KEYS.has(key);
    let status: Directive["status"] = "ok";
    if (!valueless && value.length === 0) status = "malformed";
    if (!valueless && !hadColon && value.length === 0) status = "malformed";

    directives.push({
      key,
      value,
      prefix,
      raw: rawLine.trim(),
      location: { file: "", startLine: line, endLine: line },
      status,
    });
  });

  return directives;
}
