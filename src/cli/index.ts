#!/usr/bin/env node
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import type { BodyDefault } from "../core/context.js";
import { collectDiffRanges } from "../core/diff.js";
import { FileParseCache } from "../core/parse-cache.js";
import { discover } from "../core/pack.js";
import { buildArtifact, type SourceEntry } from "../core/pipeline.js";
import { queryChunk } from "../core/query.js";
import { emptyBaseline } from "../core/staleness.js";
import { serializeArtifact } from "../output/artifact.js";
import { renderMarkdown } from "../output/markdown.js";
import { allAdapters, supportedExtensions } from "../parsers/registry.js";
import type { Baseline } from "../types.js";

function loadBaseline(path: string): Baseline | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Baseline;
  } catch {
    return undefined;
  }
}

export function runCli(argv: string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        out: { type: "string" },
        md: { type: "string" },
        "out-dir": { type: "string" },
        strict: { type: "boolean", default: false },
        baseline: { type: "string", default: ".lucider/baseline.json" },
        "update-baseline": { type: "boolean", default: false },
        "default-body": { type: "string", default: "on" },
        prefix: { type: "string", default: "ai" },
        query: { type: "string" },
        depth: { type: "string", default: "0" },
        "max-tokens": { type: "string" },
        "node-id": { type: "string" },
        file: { type: "string", multiple: true },
        lines: { type: "string", multiple: true },
        diff: { type: "boolean", default: false },
        "diff-base": { type: "string" },
        "no-cache": { type: "boolean", default: false },
      },
    });
  } catch (err) {
    process.stderr.write(`Usage error: ${(err as Error).message}\n`);
    return 2;
  }

  const target = parsed.positionals[0];
  if (!target) {
    process.stderr.write(
      "Usage: lucider <path> [--query term] [--file path] [--lines file:start-end] [--diff] [--diff-base ref] [--node-id id] [--depth N] [--max-tokens N] [--out-dir .lucider] [--out catalog.json] [--md pack.md] [--strict] [--prefix ai] [--default-body on|off] [--no-cache]\n" +
        "Catalog JSON (no pack seed) is for storage, not the default assistant payload. Use --query / --file / --lines / --diff / --node-id for a pack.\n",
    );
    return 2;
  }

  const fileSeeds = asList(parsed.values.file);
  const lineRaw = asList(parsed.values.lines);
  const lineRanges: { file: string; startLine: number; endLine: number }[] = [];
  for (const spec of lineRaw) {
    const parsedLines = parseLineSpec(spec);
    if (!parsedLines) {
      process.stderr.write(`Usage error: invalid --lines '${spec}' (expected file:start-end)\n`);
      return 2;
    }
    lineRanges.push(parsedLines);
  }

  const wantDiff = Boolean(parsed.values.diff) || Boolean(parsed.values["diff-base"]);

  const defaultBody = parsed.values["default-body"] === "off" ? "off" : "on";
  const query = parsed.values.query as string | undefined;
  const nodeId = parsed.values["node-id"] as string | undefined;
  const depth = Number.parseInt(String(parsed.values.depth ?? "0"), 10) || 0;
  const maxTokensRaw = parsed.values["max-tokens"] as string | undefined;
  let maxTokens: number | undefined;
  if (maxTokensRaw !== undefined) {
    maxTokens = Number.parseInt(maxTokensRaw, 10);
    if (!Number.isFinite(maxTokens) || maxTokens < 0) {
      process.stderr.write(`Usage error: --max-tokens must be a non-negative integer\n`);
      return 2;
    }
  }
  const isPack = Boolean(query || nodeId || fileSeeds.length || lineRanges.length || wantDiff);
  // Pack seeds parse with bodies on so the slice can include implementations.
  const effectiveBody = isPack ? "on" : defaultBody;
  const prefix = parsed.values.prefix as string;
  const adapters = allAdapters();

  let files: string[];
  try {
    files = discover(target, supportedExtensions(adapters));
  } catch {
    process.stderr.write(`Error: path not found: ${target}\n`);
    return 3;
  }

  if (wantDiff) {
    try {
      const gitCwd = statSync(target).isFile() ? dirname(target) : target;
      const fromGit = collectDiffRanges(gitCwd, parsed.values["diff-base"] as string | undefined);
      lineRanges.push(...fromGit);
    } catch (err) {
      process.stderr.write(`Usage error: ${(err as Error).message}\n`);
      return 2;
    }
  }

  const entries: SourceEntry[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    try {
      entries.push({ file, source: readFileSync(file, "utf8") });
    } catch {
      skipped.push(file);
    }
  }

  const baselinePath = parsed.values.baseline as string;
  const baseline = loadBaseline(baselinePath);

  let parseCache: FileParseCache | undefined;
  if (!parsed.values["no-cache"]) {
    const cacheRoot = statSync(target).isFile() ? dirname(target) : target;
    parseCache = new FileParseCache(join(cacheRoot, ".lucider", "parse-cache.json"));
  }

  const artifact = buildArtifact({
    generatedFrom: target,
    entries,
    adapters,
    prefix,
    defaultBody: effectiveBody as BodyDefault,
    baseline,
    parseCache,
  });
  parseCache?.flush();

  for (const file of skipped) {
    artifact.warnings.push({
      code: "parse_skipped",
      message: `Could not read file; skipped`,
      location: { file, startLine: 1, endLine: 1 },
    });
  }

  if (parsed.values["update-baseline"]) {
    const next = emptyBaseline();
    for (const node of artifact.nodes) {
      if (node.contextSource === "authored") next.fingerprints[node.id] = node.fingerprint;
    }
    mkdirSync(dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, JSON.stringify(next, null, 2) + "\n", "utf8");
    process.stderr.write(`Baseline updated: ${baselinePath}\n`);
    return 0;
  }

  const jsonStr = serializeArtifact(artifact);
  const chunk = isPack
    ? queryChunk(artifact, {
        search: query,
        nodeId,
        files: fileSeeds.length ? fileSeeds : undefined,
        lineRanges: lineRanges.length ? lineRanges : undefined,
        depth,
        includeSeedBodies: true,
        maxTokens,
      })
    : undefined;
  const mdStr = chunk ? chunk.markdown : renderMarkdown(artifact);
  if (chunk?.truncated) {
    process.stderr.write("[budget_truncated] seed body omitted to stay within the token budget\n");
  }
  const write = (path: string, content: string): void => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  };

  const outDir = parsed.values["out-dir"] as string | undefined;
  const outPath = parsed.values.out as string | undefined;
  const mdPath = parsed.values.md as string | undefined;
  let wroteFile = false;

  if (outDir) {
    write(join(outDir, "context.json"), jsonStr + "\n");
    write(join(outDir, "context.md"), mdStr + "\n");
    process.stderr.write(`Wrote ${join(outDir, "context.json")} and ${join(outDir, "context.md")}\n`);
    wroteFile = true;
  }
  if (outPath) {
    write(outPath, jsonStr + "\n");
    wroteFile = true;
  }
  if (mdPath) {
    write(mdPath, mdStr + "\n");
    wroteFile = true;
  }
  if (!wroteFile) {
    process.stdout.write((isPack ? mdStr : jsonStr) + "\n");
  }

  for (const w of artifact.warnings) {
    const loc = w.location ? `${w.location.file}:${w.location.startLine}` : "";
    process.stderr.write(`[${w.code}] ${loc} ${w.message}\n`);
  }

  const strictViolation = artifact.warnings.some(
    (w) => w.code === "stale_context" || w.code === "malformed_directive",
  );
  if (parsed.values.strict && strictViolation) return 1;
  return 0;
}

function asList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseLineSpec(spec: string): { file: string; startLine: number; endLine: number } | undefined {
  const match = spec.match(/^(.*):(\d+)-(\d+)$/);
  if (!match) return undefined;
  const startLine = Number.parseInt(match[2]!, 10);
  const endLine = Number.parseInt(match[3]!, 10);
  if (!Number.isFinite(startLine) || !Number.isFinite(endLine) || startLine < 1 || endLine < startLine) {
    return undefined;
  }
  return { file: match[1]!, startLine, endLine };
}

function isCliEntry(argv1: string | undefined): boolean {
  if (!argv1) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(argv1)).href;
  } catch {
    return import.meta.url === pathToFileURL(argv1).href;
  }
}

if (isCliEntry(process.argv[1])) {
  process.exit(runCli(process.argv.slice(2)));
}
