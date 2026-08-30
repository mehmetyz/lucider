import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import type { BodyDefault } from "./context.js";
import { buildArtifact, type SourceEntry } from "./pipeline.js";
import { queryChunk, type QueryArgs, type QueryChunk } from "./query.js";
import type { ParseCache } from "./parse-cache.js";
import { allAdapters, supportedExtensions } from "../parsers/registry.js";
import type { ContextArtifact } from "../types.js";

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", ".lucider"]);

export function discover(path: string, extensions: string[]): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  const out: string[] = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      out.push(...discover(join(path, entry.name), extensions));
    } else if (extensions.includes(extname(entry.name))) {
      out.push(join(path, entry.name));
    }
  }
  return out.sort();
}

export interface PackFromDiskArgs {
  target: string;
  query?: QueryArgs;
  prefix?: string;
  defaultBody?: BodyDefault;
  parseCache?: ParseCache;
  /** When true, parse with bodies on (live pack). */
  packBodies?: boolean;
}

export interface PackFromDiskResult {
  artifact: ContextArtifact;
  chunk: QueryChunk | undefined;
}

export function packFromDisk(args: PackFromDiskArgs): PackFromDiskResult {
  const prefix = args.prefix ?? "ai";
  const adapters = allAdapters();
  const files = discover(args.target, supportedExtensions(adapters));
  const entries: SourceEntry[] = [];
  for (const file of files) {
    try {
      entries.push({ file, source: readFileSync(file, "utf8") });
    } catch {
      /* skipped; CLI adds parse_skipped — MCP omits unreadable files */
    }
  }
  const isPack = Boolean(args.query);
  const defaultBody: BodyDefault = isPack || args.packBodies ? "on" : (args.defaultBody ?? "on");
  const artifact = buildArtifact({
    generatedFrom: args.target,
    entries,
    adapters,
    prefix,
    defaultBody,
    parseCache: args.parseCache,
  });
  args.parseCache?.flush();
  const chunk = args.query
    ? queryChunk(artifact, { includeSeedBodies: true, ...args.query })
    : undefined;
  return { artifact, chunk };
}
