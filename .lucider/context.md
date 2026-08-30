# Lucider Context — src

Schema 1.0.0 · Grammar 1.0.0 · 79 symbols · 79 edges · ~8.2% token reduction (8374/9125).

## src/cli/index.ts

### discover — function (L14)

function discover(path: string, extensions: string[]): string[]

```ts
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
```

### loadBaseline — function (L29)

function loadBaseline(path: string): Baseline | undefined

```ts
function loadBaseline(path: string): Baseline | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Baseline;
  } catch {
    return undefined;
  }
}
```

### runCli — function (L37)

function runCli(argv: string[]): number

```ts
function runCli(argv: string[]): number {
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
      },
    });
  } catch (err) {
    process.stderr.write(`Usage error: ${(err as Error).message}\n`);
    return 2;
  }

  const target = parsed.positionals[0];
  if (!target) {
    process.stderr.write(
      "Usage: lucider <path> [--out-dir .lucider] [--out file.json] [--md file.md] [--strict] [--prefix ai] [--default-body on|off]\n",
    );
    return 2;
  }

  const defaultBody = parsed.values["default-body"] === "off" ? "off" : "on";
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
    defaultBody: defaultBody as BodyDefault,
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
  const mdStr = renderMarkdown(artifact);
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
    process.stdout.write(jsonStr + "\n");
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
```

## src/core/context.ts

### BodyDefault — type (L4)

type BodyDefault = "on" | "off";

```ts
type BodyDefault = "on" | "off";
```

### ContextResult — interface (L6)

interface ContextResult

```ts
interface ContextResult {
  derivedSummary: string;
  context: string;
  contextSource: ContextSource;
  bodyIncluded: boolean;
  body: string | null;
}
```

### applyContext — function (L38)

function applyContext(node: RawNode, defaultBody: BodyDefault): ContextResult

```ts
function applyContext(node: RawNode, defaultBody: BodyDefault): ContextResult {
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
    body: bodyIncluded ? node.text : null,
  };
}
```

### deriveSummary — function (L19)

function deriveSummary(node: RawNode): string

```ts
function deriveSummary(node: RawNode): string {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  const head = braceIndex === -1 ? text.split("\n")[0] ?? text : text.slice(0, braceIndex);
  return head.replace(/\s+/g, " ").trim();
}
```

### lastDirectiveValue — function (L26)

function lastDirectiveValue(node: RawNode, key: string): string | undefined

```ts
function lastDirectiveValue(node: RawNode, key: string): string | undefined {
  const matches = node.directives.filter(
    (d) => d.key === key && d.status !== "malformed" && d.status !== "unknown",
  );
  return matches.at(-1)?.value;
}
```

## src/core/graph.ts

### NeighbourSlice — interface (L35)

interface NeighbourSlice

```ts
interface NeighbourSlice {
  node: AnnotatedNode;
  neighbours: AnnotatedNode[];
}
```

### buildContainmentEdges — function (L21)

function buildContainmentEdges(nodes: AnnotatedNode[]): Edge[]

```ts
function buildContainmentEdges(nodes: AnnotatedNode[]): Edge[] {
  const edges: Edge[] = [];
  for (const node of nodes) {
    let nearest: AnnotatedNode | undefined;
    for (const candidate of nodes) {
      if (!contains(candidate, node)) continue;
      if (!nearest || span(candidate) < span(nearest)) nearest = candidate;
    }
    const from = nearest ? nearest.id : node.location.file;
    edges.push({ type: "contains", from, to: node.id });
  }
  return edges;
}
```

### contains — function (L7)

function contains(outer: AnnotatedNode, inner: AnnotatedNode): boolean

```ts
function contains(outer: AnnotatedNode, inner: AnnotatedNode): boolean {
  if (outer.id === inner.id) return false;
  if (outer.location.file !== inner.location.file) return false;
  const enclosesLines =
    outer.location.startLine <= inner.location.startLine &&
    outer.location.endLine >= inner.location.endLine;
  return enclosesLines && span(outer) > span(inner);
}
```

### neighbourSlice — function (L44)

function neighbourSlice( nodes: AnnotatedNode[], edges: Edge[], nodeId: string, ): NeighbourSlice | undefined

```ts
function neighbourSlice(
  nodes: AnnotatedNode[],
  edges: Edge[],
  nodeId: string,
): NeighbourSlice | undefined {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const node = byId.get(nodeId);
  if (!node) return undefined;

  const neighbourIds = new Set<string>();
  for (const edge of edges) {
    if (edge.from === nodeId) neighbourIds.add(edge.to);
    if (edge.to === nodeId) neighbourIds.add(edge.from);
  }

  const neighbours = [...neighbourIds]
    .map((id) => byId.get(id))
    .filter((n): n is AnnotatedNode => n !== undefined)
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  return { node, neighbours };
}
```

### span — function (L3)

function span(node: AnnotatedNode): number

```ts
function span(node: AnnotatedNode): number {
  return node.location.endLine - node.location.startLine;
}
```

## src/core/ids.ts

### makeLocation — function (L17)

function makeLocation( file: string, startLine: number, endLine: number, ): Location

```ts
function makeLocation(
  file: string,
  startLine: number,
  endLine: number,
): Location {
  return { file, startLine, endLine };
}
```

### makeNodeId — function (L8)

function makeNodeId( file: string, name: string, kind: string, index: number, ): string

```ts
function makeNodeId(
  file: string,
  name: string,
  kind: string,
  index: number,
): string {
  return `${file}::${name}#${kind}@${index}`;
}
```

## src/core/metrics.ts

### EmittedContext — interface (L13)

interface EmittedContext

```ts
interface EmittedContext {
  context: string;
  body: string | null;
}
```

### approxTokens — function (L8)

function approxTokens(text: string): number

```ts
function approxTokens(text: string): number {
  const matches = text.match(/\w+|[^\s\w]/g);
  return matches ? matches.length : 0;
}
```

### computeMetrics — function (L18)

function computeMetrics(rawSource: string, emitted: EmittedContext[]): Metrics

```ts
function computeMetrics(rawSource: string, emitted: EmittedContext[]): Metrics {
  const rawTokens = approxTokens(rawSource);
  const rawBytes = Buffer.byteLength(rawSource, "utf8");

  let emittedTokens = 0;
  let emittedBytes = 0;
  for (const e of emitted) {
    const chunk = e.body === null ? e.context : `${e.context}\n${e.body}`;
    emittedTokens += approxTokens(chunk);
    emittedBytes += Buffer.byteLength(chunk, "utf8");
  }

  const reductionRatio =
    rawTokens === 0 ? 0 : Math.max(0, Math.min(1, 1 - emittedTokens / rawTokens));

  return { rawTokens, emittedTokens, reductionRatio, rawBytes, emittedBytes };
}
```

## src/core/nodes.ts

### BuildNodesArgs — interface (L17)

interface BuildNodesArgs

```ts
interface BuildNodesArgs {
  file: string;
  source: string;
  adapter: LanguageAdapter;
  prefix: string;
  registry: Registry;
  warnings: WarningCollector;
}
```

### RawNode — interface (L8)

interface RawNode

```ts
interface RawNode {
  id: string;
  kind: string;
  name: string;
  location: Location;
  text: string;
  directives: Directive[];
}
```

### buildNodes — function (L26)

function buildNodes(args: BuildNodesArgs): RawNode[]

```ts
function buildNodes(args: BuildNodesArgs): RawNode[] {
  const { file, source, adapter, prefix, registry, warnings } = args;

  const decls = adapter
    .parseDeclarations(source)
    .sort((a, b) => a.startIndex - b.startIndex);
  const comments = adapter.parseComments(source);

  const commentLines = new Set<number>();
  for (const c of comments) {
    for (let l = c.startLine; l <= c.endLine; l++) commentLines.add(l);
  }

  const directivesByLine = new Map<number, Directive[]>();
  const allDirectives: Directive[] = [];
  for (const c of comments) {
    for (const d of extractDirectives(c, prefix)) {
      d.location.file = file;
      allDirectives.push(d);
      const bucket = directivesByLine.get(d.location.startLine) ?? [];
      bucket.push(d);
      directivesByLine.set(d.location.startLine, bucket);
    }
  }

  const sourceLines = source.split("\n");
  const isBlank = (line: number): boolean =>
    (sourceLines[line - 1] ?? "").trim().length === 0;

  const associated = new Set<Directive>();
  const nodes: RawNode[] = [];
  const occurrence = new Map<string, number>();

  for (const decl of decls) {
    const collected: Directive[] = [];
    for (let line = decl.startLine - 1; line >= 1; line--) {
      if (isBlank(line)) continue;
      if (!commentLines.has(line)) break;
      const onLine = directivesByLine.get(line);
      if (onLine) collected.push(...onLine);
    }
    collected.reverse(); // restore top-to-bottom order
    for (const d of collected) associated.add(d);

    resolveStatuses(collected, registry, warnings);
    detectConflicts(collected, file, decl.startLine, warnings);

    if (collected.some((d) => d.key === "ignore")) continue;

    const occKey = `${decl.name}#${decl.kind}`;
    const index = occurrence.get(occKey) ?? 0;
    occurrence.set(occKey, index + 1);

    nodes.push({
      id: makeNodeId(file, decl.name, decl.kind, index),
      kind: decl.kind,
      name: decl.name,
      location: { file, startLine: decl.startLine, endLine: decl.endLine },
      text: decl.text,
      directives: collected,
    });
  }

  for (const d of allDirectives) {
    if (!associated.has(d)) {
      d.status = "orphaned";
      warnings.add(
        "orphaned_directive",
        `Directive ${d.prefix}-${d.key} has no following declaration`,
        d.location,
      );
    }
  }

  return nodes;
}
```

### detectConflicts — function (L138)

function detectConflicts( directives: Directive[], file: string, declLine: number, warnings: WarningCollector, ): void

```ts
function detectConflicts(
  directives: Directive[],
  file: string,
  declLine: number,
  warnings: WarningCollector,
): void {
  const byKey = new Map<string, Directive[]>();
  for (const d of directives) {
    if (d.status === "malformed" || d.status === "unknown") continue;
    const list = byKey.get(d.key) ?? [];
    list.push(d);
    byKey.set(d.key, list);
  }
  for (const [key, list] of byKey) {
    const values = new Set(list.map((d) => d.value));
    if (list.length > 1 && values.size > 1) {
      warnings.add(
        "conflict",
        `Conflicting '${key}' directives; last one wins`,
        { file, startLine: declLine, endLine: declLine },
      );
    }
  }
}
```

### resolveStatuses — function (L103)

function resolveStatuses( directives: Directive[], registry: Registry, warnings: WarningCollector, ): void

```ts
function resolveStatuses(
  directives: Directive[],
  registry: Registry,
  warnings: WarningCollector,
): void {
  for (const d of directives) {
    if (d.status === "malformed") {
      warnings.add(
        "malformed_directive",
        `Directive ${d.prefix}-${d.key} has an empty value`,
        d.location,
      );
      continue;
    }
    const deprecation = registry.deprecationOf(d.key);
    if (deprecation) {
      d.status = "deprecated";
      warnings.add(
        "deprecated_key",
        `Directive key '${d.key}' is deprecated; use '${deprecation.replacedBy}'`,
        d.location,
      );
      continue;
    }
    if (!registry.isKnown(d.key)) {
      d.status = "unknown";
      warnings.add(
        "unknown_key",
        `Unrecognized directive key '${d.key}'`,
        d.location,
      );
    }
  }
}
```

## src/core/pipeline.ts

### BuildArtifactArgs — interface (L19)

interface BuildArtifactArgs

```ts
interface BuildArtifactArgs {
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
```

### SourceEntry — interface (L14)

interface SourceEntry

```ts
interface SourceEntry {
  file: string;
  source: string;
}
```

### buildArtifact — function (L32)

function buildArtifact(args: BuildArtifactArgs): ContextArtifact

```ts
function buildArtifact(args: BuildArtifactArgs): ContextArtifact {
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
```

## src/core/staleness.ts

### computeFingerprint — function (L10)

function computeFingerprint(text: string): string

```ts
function computeFingerprint(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}
```

### emptyBaseline — function (L32)

function emptyBaseline(): Baseline

```ts
function emptyBaseline(): Baseline {
  return { schemaVersion: SCHEMA_VERSION, fingerprints: {} };
}
```

### resolveStaleness — function (L19)

function resolveStaleness( nodeId: string, fingerprint: string, contextSource: "authored" | "derived", baseline: Baseline | undefined, ): Staleness

```ts
function resolveStaleness(
  nodeId: string,
  fingerprint: string,
  contextSource: "authored" | "derived",
  baseline: Baseline | undefined,
): Staleness {
  if (contextSource !== "authored") return "fresh";
  if (!baseline) return "unknown";
  const recorded = baseline.fingerprints[nodeId];
  if (recorded === undefined) return "unknown";
  return recorded === fingerprint ? "fresh" : "stale";
}
```

## src/core/warnings.ts

### WarningCollector — class (L3)

class WarningCollector

```ts
class WarningCollector {
  private warnings: Warning[] = [];

  add(code: WarningCode, message: string, location: Location | null = null): void {
    this.warnings.push({ code, message, location });
  }

  list(): Warning[] {
    return [...this.warnings].sort((a, b) => {
      const fa = a.location?.file ?? "";
      const fb = b.location?.file ?? "";
      if (fa !== fb) return fa < fb ? -1 : 1;
      const la = a.location?.startLine ?? 0;
      const lb = b.location?.startLine ?? 0;
      if (la !== lb) return la - lb;
      return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
    });
  }
}
```

### add — method (L6)

add(code: WarningCode, message: string, location: Location | null = null): void

```ts
add(code: WarningCode, message: string, location: Location | null = null): void {
    this.warnings.push({ code, message, location });
  }
```

### list — method (L10)

list(): Warning[]

```ts
list(): Warning[] {
    return [...this.warnings].sort((a, b) => {
      const fa = a.location?.file ?? "";
      const fb = b.location?.file ?? "";
      if (fa !== fb) return fa < fb ? -1 : 1;
      const la = a.location?.startLine ?? 0;
      const lb = b.location?.startLine ?? 0;
      if (la !== lb) return la - lb;
      return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
    });
  }
```

## src/directives/grammar.ts

### extractDirectives — function (L26)

function extractDirectives( comment: CommentNode, prefix: string, ): Directive[]

```ts
function extractDirectives(
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
```

### stripCommentSyntax — function (L11)

function stripCommentSyntax(line: string): string

```ts
function stripCommentSyntax(line: string): string {
  let s = line.trim();
  if (s.startsWith("/*")) s = s.slice(2);
  if (s.endsWith("*/")) s = s.slice(0, -2);
  s = s.trim();
  if (s.startsWith("//")) s = s.slice(2);
  else if (s.startsWith("*")) s = s.slice(1);
  return s.trim();
}
```

## src/directives/registry.ts

### DeprecationEntry — interface (L1)

interface DeprecationEntry

```ts
interface DeprecationEntry {
  key: string;
  replacedBy: string;
  deprecatedInGrammar: string;
  removedInGrammar: string;
}
```

### Registry — interface (L8)

interface Registry

```ts
interface Registry {
  isKnown(key: string): boolean;
  deprecationOf(key: string): DeprecationEntry | undefined;
}
```

### RegistryOptions — interface (L13)

interface RegistryOptions

```ts
interface RegistryOptions {
  knownKeys?: string[];
  deprecations?: DeprecationEntry[];
}
```

### createRegistry — function (L24)

function createRegistry(options: RegistryOptions =

```ts
function createRegistry(options: RegistryOptions = {}): Registry {
  const known = new Set(options.knownKeys ?? DEFAULT_KNOWN_KEYS);
  const deprecations = new Map<string, DeprecationEntry>();
  for (const dep of options.deprecations ?? []) {
    deprecations.set(dep.key, dep);
    known.add(dep.key);
  }

  return {
    isKnown: (key) => known.has(key),
    deprecationOf: (key) => deprecations.get(key),
  };
}
```

## src/output/artifact.ts

### AssembleArgs — interface (L5)

interface AssembleArgs

```ts
interface AssembleArgs {
  generatedFrom: string;
  nodes: AnnotatedNode[];
  edges: Edge[];
  warnings: Warning[];
  metrics: Metrics;
}
```

### assembleArtifact — function (L13)

function assembleArtifact(args: AssembleArgs): ContextArtifact

```ts
function assembleArtifact(args: AssembleArgs): ContextArtifact {
  const nodes = [...args.nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const edges = [...args.edges].sort(byEdge);
  return {
    schemaVersion: SCHEMA_VERSION,
    grammarVersion: GRAMMAR_VERSION,
    generatedFrom: args.generatedFrom,
    nodes,
    edges,
    warnings: args.warnings,
    metrics: args.metrics,
  };
}
```

### byEdge — function (L27)

function byEdge(a: Edge, b: Edge): number

```ts
function byEdge(a: Edge, b: Edge): number {
  if (a.type !== b.type) return a.type < b.type ? -1 : 1;
  if (a.from !== b.from) return a.from < b.from ? -1 : 1;
  if (a.to !== b.to) return a.to < b.to ? -1 : 1;
  return 0;
}
```

### serializeArtifact — function (L54)

function serializeArtifact(artifact: ContextArtifact): string

```ts
function serializeArtifact(artifact: ContextArtifact): string {
  return stableStringify(artifact);
}
```

### sortKeys — function (L42)

function sortKeys(value: unknown): unknown

```ts
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
```

### stableStringify — function (L38)

function stableStringify(value: unknown): string

```ts
function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}
```

## src/output/markdown.ts

### fenceLang — function (L9)

function fenceLang(file: string): string

```ts
function fenceLang(file: string): string {
  if (file.endsWith(".ts") || file.endsWith(".mts") || file.endsWith(".cts")) return "ts";
  if (file.endsWith(".tsx")) return "tsx";
  return "js";
}
```

### renderMarkdown — function (L36)

function renderMarkdown(artifact: ContextArtifact): string

```ts
function renderMarkdown(artifact: ContextArtifact): string {
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
```

### renderNode — function (L15)

function renderNode(node: AnnotatedNode): string

```ts
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
```

## src/parsers/adapter.ts

### CommentNode — interface (L11)

interface CommentNode

```ts
interface CommentNode {
  text: string;
  startLine: number;
  endLine: number;
  startIndex: number;
  endIndex: number;
}
```

### DeclNode — interface (L1)

interface DeclNode

```ts
interface DeclNode {
  kind: string;
  name: string;
  startLine: number;
  endLine: number;
  startIndex: number;
  endIndex: number;
  text: string;
}
```

### LanguageAdapter — interface (L24)

interface LanguageAdapter

```ts
interface LanguageAdapter {
  name: string;
  extensions: string[];
  parseDeclarations(source: string): DeclNode[];
  parseComments(source: string): CommentNode[];
}
```

## src/parsers/javascript.ts

### JavaScriptAdapter — class (L11)

class JavaScriptAdapter extends TreeSitterAdapter

```ts
class JavaScriptAdapter extends TreeSitterAdapter {
  constructor() {
    super({
      name: "javascript",
      extensions: [".js", ".mjs", ".cjs", ".jsx"],
      language: JavaScript,
      declKinds: JS_DECL_KINDS,
    });
  }
}
```

### constructor — method (L12)

constructor()

```ts
constructor() {
    super({
      name: "javascript",
      extensions: [".js", ".mjs", ".cjs", ".jsx"],
      language: JavaScript,
      declKinds: JS_DECL_KINDS,
    });
  }
```

## src/parsers/registry.ts

### allAdapters — function (L7)

function allAdapters(): LanguageAdapter[]

```ts
function allAdapters(): LanguageAdapter[] {
  return [new JavaScriptAdapter(), new TypeScriptAdapter(), new TsxAdapter()];
}
```

### resolveAdapter — function (L12)

function resolveAdapter( file: string, adapters: LanguageAdapter[], ): LanguageAdapter | undefined

```ts
function resolveAdapter(
  file: string,
  adapters: LanguageAdapter[],
): LanguageAdapter | undefined {
  const ext = extname(file);
  return adapters.find((a) => a.extensions.includes(ext));
}
```

### supportedExtensions — function (L21)

function supportedExtensions(adapters: LanguageAdapter[]): string[]

```ts
function supportedExtensions(adapters: LanguageAdapter[]): string[] {
  return [...new Set(adapters.flatMap((a) => a.extensions))];
}
```

## src/parsers/tree-sitter-adapter.ts

### TSNode — type (L4)

type TSNode = Parser.SyntaxNode;

```ts
type TSNode = Parser.SyntaxNode;
```

### TreeSitterAdapter — class (L18)

class TreeSitterAdapter implements LanguageAdapter

```ts
class TreeSitterAdapter implements LanguageAdapter {
  readonly name: string;
  readonly extensions: string[];
  private readonly parser: Parser;
  private readonly declKinds: Record<string, string>;

  constructor(config: TreeSitterAdapterConfig) {
    this.name = config.name;
    this.extensions = config.extensions;
    this.declKinds = config.declKinds;
    this.parser = new Parser();
    this.parser.setLanguage(config.language as never);
  }

  private root(source: string): TSNode {
    return this.parser.parse(source).rootNode;
  }

  parseDeclarations(source: string): DeclNode[] {
    const decls: DeclNode[] = [];
    const visit = (node: TSNode): void => {
      const kind = this.declKinds[node.type];
      if (kind) {
        const nameNode = node.childForFieldName("name");
        decls.push({
          kind,
          name: nameNode?.text ?? "<anonymous>",
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startIndex: node.startIndex,
          endIndex: node.endIndex,
          text: node.text,
        });
      }
      for (const child of node.namedChildren) visit(child);
    };
    visit(this.root(source));
    return decls;
  }

  parseComments(source: string): CommentNode[] {
    const comments: CommentNode[] = [];
    const visit = (node: TSNode): void => {
      if (node.type === "comment") {
        comments.push({
          text: node.text,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startIndex: node.startIndex,
          endIndex: node.endIndex,
        });
      }
      for (const child of node.namedChildren) visit(child);
    };
    visit(this.root(source));
    return comments;
  }
}
```

### TreeSitterAdapterConfig — interface (L6)

interface TreeSitterAdapterConfig

```ts
interface TreeSitterAdapterConfig {
  name: string;
  extensions: string[];
  language: unknown;
  declKinds: Record<string, string>;
}
```

### constructor — method (L24)

constructor(config: TreeSitterAdapterConfig)

```ts
constructor(config: TreeSitterAdapterConfig) {
    this.name = config.name;
    this.extensions = config.extensions;
    this.declKinds = config.declKinds;
    this.parser = new Parser();
    this.parser.setLanguage(config.language as never);
  }
```

### parseComments — method (L58)

parseComments(source: string): CommentNode[]

```ts
parseComments(source: string): CommentNode[] {
    const comments: CommentNode[] = [];
    const visit = (node: TSNode): void => {
      if (node.type === "comment") {
        comments.push({
          text: node.text,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startIndex: node.startIndex,
          endIndex: node.endIndex,
        });
      }
      for (const child of node.namedChildren) visit(child);
    };
    visit(this.root(source));
    return comments;
  }
```

### parseDeclarations — method (L36)

parseDeclarations(source: string): DeclNode[]

```ts
parseDeclarations(source: string): DeclNode[] {
    const decls: DeclNode[] = [];
    const visit = (node: TSNode): void => {
      const kind = this.declKinds[node.type];
      if (kind) {
        const nameNode = node.childForFieldName("name");
        decls.push({
          kind,
          name: nameNode?.text ?? "<anonymous>",
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startIndex: node.startIndex,
          endIndex: node.endIndex,
          text: node.text,
        });
      }
      for (const child of node.namedChildren) visit(child);
    };
    visit(this.root(source));
    return decls;
  }
```

### root — method (L32)

private root(source: string): TSNode

```ts
private root(source: string): TSNode {
    return this.parser.parse(source).rootNode;
  }
```

## src/parsers/typescript.ts

### TsxAdapter — class (L25)

class TsxAdapter extends TreeSitterAdapter

```ts
class TsxAdapter extends TreeSitterAdapter {
  constructor() {
    super({
      name: "tsx",
      extensions: [".tsx"],
      language: TypeScriptGrammars.tsx,
      declKinds: TS_DECL_KINDS,
    });
  }
}
```

### TypeScriptAdapter — class (L14)

class TypeScriptAdapter extends TreeSitterAdapter

```ts
class TypeScriptAdapter extends TreeSitterAdapter {
  constructor() {
    super({
      name: "typescript",
      extensions: [".ts", ".mts", ".cts"],
      language: TypeScriptGrammars.typescript,
      declKinds: TS_DECL_KINDS,
    });
  }
}
```

### constructor — method (L15)

constructor()

```ts
constructor() {
    super({
      name: "typescript",
      extensions: [".ts", ".mts", ".cts"],
      language: TypeScriptGrammars.typescript,
      declKinds: TS_DECL_KINDS,
    });
  }
```

### constructor — method (L26)

constructor()

```ts
constructor() {
    super({
      name: "tsx",
      extensions: [".tsx"],
      language: TypeScriptGrammars.tsx,
      declKinds: TS_DECL_KINDS,
    });
  }
```

## src/types.ts

### AnnotatedNode — interface (L28)

interface AnnotatedNode

```ts
interface AnnotatedNode {
  id: string;
  kind: string;
  name: string;
  location: Location;
  derivedSummary: string;
  context: string;
  contextSource: ContextSource;
  bodyIncluded: boolean;
  body: string | null;
  fingerprint: string;
  staleness: Staleness;
  directives: Directive[];
}
```

### Baseline — interface (L84)

interface Baseline

```ts
interface Baseline {
  schemaVersion: string;
  fingerprints: Record<string, string>;
}
```

### ContextArtifact — interface (L74)

interface ContextArtifact

```ts
interface ContextArtifact {
  schemaVersion: string;
  grammarVersion: string;
  generatedFrom: string;
  nodes: AnnotatedNode[];
  edges: Edge[];
  warnings: Warning[];
  metrics: Metrics;
}
```

### ContextSource — type (L24)

type ContextSource = "authored" | "derived";

```ts
type ContextSource = "authored" | "derived";
```

### Directive — interface (L15)

interface Directive

```ts
interface Directive {
  key: string;
  value: string;
  prefix: string;
  raw: string;
  location: Location;
  status: DirectiveStatus;
}
```

### DirectiveStatus — type (L7)

type DirectiveStatus =

```ts
type DirectiveStatus =
  | "ok"
  | "malformed"
  | "orphaned"
  | "conflicting"
  | "unknown"
  | "deprecated";
```

### Edge — interface (L45)

interface Edge

```ts
interface Edge {
  type: EdgeType;
  from: string;
  to: string;
}
```

### EdgeType — type (L43)

type EdgeType = "contains" | "references" | "calls";

```ts
type EdgeType = "contains" | "references" | "calls";
```

### Location — interface (L1)

interface Location

```ts
interface Location {
  file: string;
  startLine: number;
  endLine: number;
}
```

### Metrics — interface (L66)

interface Metrics

```ts
interface Metrics {
  rawTokens: number;
  emittedTokens: number;
  reductionRatio: number;
  rawBytes: number;
  emittedBytes: number;
}
```

### Staleness — type (L26)

type Staleness = "fresh" | "stale" | "unknown";

```ts
type Staleness = "fresh" | "stale" | "unknown";
```

### Warning — interface (L60)

interface Warning

```ts
interface Warning {
  code: WarningCode;
  message: string;
  location: Location | null;
}
```

### WarningCode — type (L51)

type WarningCode =

```ts
type WarningCode =
  | "malformed_directive"
  | "orphaned_directive"
  | "conflict"
  | "unknown_key"
  | "deprecated_key"
  | "parse_skipped"
  | "stale_context";
```

