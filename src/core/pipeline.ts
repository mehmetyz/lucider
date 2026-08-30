import type { LanguageAdapter } from "../parsers/adapter.js";
import type { AnnotatedNode, Baseline, ContextArtifact, Edge } from "../types.js";
import type { Registry } from "../directives/registry.js";
import { createRegistry } from "../directives/registry.js";
import { resolveAdapter } from "../parsers/registry.js";
import { WarningCollector } from "./warnings.js";
import { buildNodes } from "./nodes.js";
import { applyContext, type BodyDefault } from "./context.js";
import { computeFingerprint, resolveStaleness } from "./staleness.js";
import { computeMetrics, type EmittedContext } from "./metrics.js";
import { assembleArtifact } from "../output/artifact.js";
import { buildContainmentEdges } from "./graph.js";

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
}

export function buildArtifact(args: BuildArtifactArgs): ContextArtifact {
  const registry = args.registry ?? createRegistry();
  const warnings = new WarningCollector();
  const nodes: AnnotatedNode[] = [];
  const emitted: EmittedContext[] = [];

  const adapterList = args.adapters ?? (args.adapter ? [args.adapter] : []);
  if (adapterList.length === 0) {
    throw new Error("buildArtifact requires `adapter` or `adapters`");
  }

  for (const entry of args.entries) {
    const adapter =
      resolveAdapter(entry.file, adapterList) ?? adapterList[0]!;
    const raws = buildNodes({
      file: entry.file,
      source: entry.source,
      adapter,
      prefix: args.prefix,
      registry,
      warnings,
    });

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
  const edges: Edge[] = buildContainmentEdges(nodes);

  return assembleArtifact({
    generatedFrom: args.generatedFrom,
    nodes,
    edges,
    warnings: warnings.list(),
    metrics,
  });
}
