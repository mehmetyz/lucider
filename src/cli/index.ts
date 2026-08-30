#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, realpathSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import type { Baseline } from "../types.js";
import { buildArtifact, type SourceEntry } from "../core/pipeline.js";
import { serializeArtifact } from "../output/artifact.js";
import { renderMarkdown } from "../output/markdown.js";
import { queryChunk } from "../core/query.js";
import { allAdapters, supportedExtensions } from "../parsers/registry.js";
import { emptyBaseline } from "../core/staleness.js";
import type { BodyDefault } from "../core/context.js";

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", ".lucider"]);

function discover(path: string, extensions: string[]): string[] {
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
      },
    });
  } catch (err) {
    process.stderr.write(`Usage error: ${(err as Error).message}\n`);
    return 2;
  }

  const target = parsed.positionals[0];
  if (!target) {
    process.stderr.write(
      "Usage: lucider <path> [--query term] [--depth N] [--out-dir .lucider] [--out file.json] [--md file.md] [--strict] [--prefix ai] [--default-body on|off]\n",
    );
    return 2;
  }

  const defaultBody = parsed.values["default-body"] === "off" ? "off" : "on";
  const query = parsed.values.query as string | undefined;
  const depth = Number.parseInt(String(parsed.values.depth ?? "0"), 10) || 0;
  // Live query fetches exact-point bodies even if the index would omit them.
  const effectiveBody = query ? "on" : defaultBody;
  const prefix = parsed.values.prefix as string;
  const adapters = allAdapters();

  let files: string[];
  try {
    files = discover(target, supportedExtensions(adapters));
  } catch {
    process.stderr.write(`Error: path not found: ${target}\n`);
    return 3;
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

  const artifact = buildArtifact({
    generatedFrom: target,
    entries,
    adapters,
    prefix,
    defaultBody: effectiveBody as BodyDefault,
    baseline,
  });

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
  const mdStr = query
    ? queryChunk(artifact, { search: query, depth, includeSeedBodies: true }).markdown
    : renderMarkdown(artifact);
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
    process.stdout.write((query ? mdStr : jsonStr) + "\n");
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
