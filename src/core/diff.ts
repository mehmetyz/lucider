import { execFileSync } from "node:child_process";
import type { QueryLineRange } from "./query.js";

/**
 * Parse a unified diff into inclusive new-file line ranges (one range per hunk
 * of added or context-shifted lines). Deletion-only hunks seed the insertion
 * point in the new file (a single line) so a removed neighbour still maps to
 * a covering symbol.
 */
export function parseUnifiedDiff(diffText: string): QueryLineRange[] {
  const ranges: QueryLineRange[] = [];
  let file: string | undefined;
  let newLine = 0;
  let hunkNewStart = 0;
  let pendingStart: number | undefined;
  let pendingEnd: number | undefined;

  const flushPending = (): void => {
    if (!file || pendingStart === undefined || pendingEnd === undefined) return;
    ranges.push({ file, startLine: pendingStart, endLine: pendingEnd });
    pendingStart = undefined;
    pendingEnd = undefined;
  };

  const touch = (line: number): void => {
    if (pendingStart === undefined) {
      pendingStart = line;
      pendingEnd = line;
      return;
    }
    if (line === pendingEnd! + 1) {
      pendingEnd = line;
      return;
    }
    flushPending();
    pendingStart = line;
    pendingEnd = line;
  };

  for (const raw of diffText.split(/\r?\n/)) {
    if (raw.startsWith("+++ ")) {
      flushPending();
      const rest = raw.slice(4).trim();
      if (rest === "/dev/null") {
        file = undefined;
        continue;
      }
      file = rest.replace(/^[ab]\//, "");
      continue;
    }
    const hunk = raw.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (hunk) {
      flushPending();
      hunkNewStart = Number.parseInt(hunk[1]!, 10);
      newLine = hunkNewStart;
      const newCount = hunk[2] === undefined ? 1 : Number.parseInt(hunk[2]!, 10);
      if (newCount === 0) touch(Math.max(1, hunkNewStart));
      continue;
    }
    if (!file) continue;
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      touch(newLine);
      newLine += 1;
      continue;
    }
    if (raw.startsWith("-") && !raw.startsWith("---")) {
      continue;
    }
    if (raw.startsWith("\\")) continue;
    if (raw.startsWith(" ") || raw === "") {
      newLine += 1;
    }
  }
  flushPending();
  return mergeRanges(ranges);
}

function mergeRanges(ranges: QueryLineRange[]): QueryLineRange[] {
  const byFile = new Map<string, QueryLineRange[]>();
  for (const r of ranges) {
    const list = byFile.get(r.file) ?? [];
    list.push(r);
    byFile.set(r.file, list);
  }
  const out: QueryLineRange[] = [];
  for (const file of [...byFile.keys()].sort()) {
    const list = (byFile.get(file) ?? []).sort((a, b) => a.startLine - b.startLine);
    let cur: QueryLineRange | undefined;
    for (const r of list) {
      if (!cur) {
        cur = { ...r };
        continue;
      }
      if (r.startLine <= cur.endLine + 1) {
        cur.endLine = Math.max(cur.endLine, r.endLine);
        continue;
      }
      out.push(cur);
      cur = { ...r };
    }
    if (cur) out.push(cur);
  }
  return out;
}

export function gitToplevel(cwd: string): string | undefined {
  try {
    return execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Working tree vs HEAD (staged + unstaged). Optional `base` adds
 * `git diff base...HEAD` (PR-shaped) and unions the ranges.
 */
export function collectDiffRanges(cwd: string, base?: string): QueryLineRange[] {
  const root = gitToplevel(cwd);
  if (!root) {
    throw new Error(`not a git repository: ${cwd}`);
  }
  const chunks: string[] = [];
  chunks.push(gitDiff(root, ["HEAD"]));
  if (base && base.trim()) {
    chunks.push(gitDiff(root, [`${base.trim()}...HEAD`]));
  }
  return parseUnifiedDiff(chunks.filter(Boolean).join("\n"));
}

function gitDiff(root: string, revArgs: string[]): string {
  try {
    return execFileSync("git", ["-C", root, "diff", "--no-color", "--no-ext-diff", ...revArgs], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr ?? "";
    throw new Error(`git diff failed: ${stderr.trim() || (err as Error).message}`);
  }
}
