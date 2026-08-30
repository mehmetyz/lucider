import type { LanguageAdapter, RefNode } from "../parsers/adapter.js";
import type { AnnotatedNode, Baseline, ContextArtifact, Edge } from "../types.js";
import type { Registry } from "../directives/registry.js";
import { createRegistry } from "../directives/registry.js";
import { resolveAdapter } from "../parsers/registry.js";
import { WarningCollector } from "./warnings.js";
import { buildNodes, type RawNode } from "./nodes.js";
import { applyContext, type BodyDefault } from "./context.js";
import { computeFingerprint, resolveStaleness } from "./staleness.js";
import { computeMetrics, type EmittedContext } from "./metrics.js";
import { assembleArtifact } from "../output/artifact.js";
import {
  buildContainmentEdges,
  buildDependsEdges,
  buildStructuralDepends,
  unionDependsEdges,
} from "./graph.js";
import type { ParseCache } from "./parse-cache.js";

export interface SourceEntry {
  file: string;
  source: string;
}

export interface BuildArtifactArgs {
  generatedFrom: string;
  entries: SourceEntry[];
  /** A single adapter used for every entry. */
  adapter?: LanguageAdapter;
  /** Multiple adapters resolved per entry by file extension. */
  adapters?: LanguageAdapter[];
  prefix: string;
  defaultBody: BodyDefault;
  registry?: Registry;
  baseline?: Baseline;
  /**
   * Optional parse cache (file + content hash). Unchanged files skip Tree-sitter.
   * Call `cache.flush()` after the build if the implementation buffers to disk.
   */
  parseCache?: ParseCache;
}

export function buildArtifact(args: BuildArtifactArgs): ContextArtifact {
  const registry = args.registry ?? createRegistry();
  const warnings = new WarningCollector();
  const nodes: AnnotatedNode[] = [];
  const emitted: EmittedContext[] = [];
  const allRaws: RawNode[] = [];
  const refsByFile = new Map<string, RefNode[]>();

  const adapterList = args.adapters ?? (args.adapter ? [args.adapter] : []);
  if (adapterList.length === 0) {
    throw new Error("buildArtifact requires `adapter` or `adapters`");
  }

  for (const entry of args.entries) {
    const adapter =
      resolveAdapter(entry.file, adapterList) ?? adapterList[0]!;
    const cached = args.parseCache?.load(entry.file, entry.source, args.prefix);
    let raws: RawNode[];
    let refs: RefNode[];
    if (cached) {
      raws = cached.raws;
      refs = cached.refs;
      for (const w of cached.warnings) {
        warnings.add(w.code, w.message, w.location);
      }
    } else {
      const warnAt = warnings.size();
      raws = buildNodes({
        file: entry.file,
        source: entry.source,
        adapter,
        prefix: args.prefix,
        registry,
        warnings,
      });
      refs = adapter.parseReferences(entry.source);
      args.parseCache?.save(entry.file, entry.source, args.prefix, {
        raws,
        refs,
        warnings: warnings.sliceFrom(warnAt),
      });
    }
    allRaws.push(...raws);
    refsByFile.set(entry.file, refs);

    for (const raw of raws) {
      const ctx = applyContext(raw, args.defaultBody);
      const fingerprint = computeFingerprint(raw.text);
      const staleness = resolveStaleness(
        raw.id,
        fingerprint,
        ctx.contextSource,
        args.baseline,
      );
      if (staleness === "stale") {
        warnings.add(
          "stale_context",
          `Authored context for '${raw.id}' is stale; code changed since it was written`,
          raw.location,
        );
      }

      nodes.push({
        id: raw.id,
        kind: raw.kind,
        name: raw.name,
        location: raw.location,
        derivedSummary: ctx.derivedSummary,
        context: ctx.context,
        contextSource: ctx.contextSource,
        bodyIncluded: ctx.bodyIncluded,
        body: ctx.body,
        fingerprint,
        staleness,
        directives: raw.directives,
      });
      emitted.push({ context: ctx.context, body: ctx.body });
    }
  }

  const rawSource = args.entries.map((e) => e.source).join("\n");
  const metrics = computeMetrics(rawSource, emitted);
  const containment = buildContainmentEdges(nodes);
  const authored = buildDependsEdges(nodes, warnings);
  const structural = buildStructuralDepends(allRaws, nodes, refsByFile);
  const depends = unionDependsEdges(structural, authored);
  const edges: Edge[] = [...containment, ...depends];

  return assembleArtifact({
    generatedFrom: args.generatedFrom,
    nodes,
    edges,
    warnings: warnings.list(),
    metrics,
  });
}
