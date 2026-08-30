import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { FileParseCache } from "../../src/core/parse-cache.js";
import { serializeArtifact } from "../../src/output/artifact.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";

const adapter = new JavaScriptAdapter();

describe("parse cache", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("warm rebuild matches cold serialize (FR-012)", () => {
    const dir = mkdtempSync(join(tmpdir(), "lucider-cache-"));
    dirs.push(dir);
    const cachePath = join(dir, "parse-cache.json");
    const entries = [
      { file: "a.js", source: "function ay() { return 1; }\n" },
      { file: "b.js", source: "function bee() { return hash();\n}\nfunction hash() { return 2; }\n" },
    ];
    const coldCache = new FileParseCache(cachePath);
    const cold = serializeArtifact(
      buildArtifact({
        generatedFrom: "p",
        entries,
        adapter,
        prefix: "ai",
        defaultBody: "on",
        parseCache: coldCache,
      }),
    );
    coldCache.flush();

    const warmCache = new FileParseCache(cachePath);
    const warm = serializeArtifact(
      buildArtifact({
        generatedFrom: "p",
        entries,
        adapter,
        prefix: "ai",
        defaultBody: "on",
        parseCache: warmCache,
      }),
    );
    expect(warm).toBe(cold);
  });

  it("reparses a file when its content hash changes", () => {
    const dir = mkdtempSync(join(tmpdir(), "lucider-cache-"));
    dirs.push(dir);
    const cachePath = join(dir, "parse-cache.json");
    const cache = new FileParseCache(cachePath);
    const first = buildArtifact({
      generatedFrom: "p",
      entries: [{ file: "a.js", source: "function ay() { return 1; }\n" }],
      adapter,
      prefix: "ai",
      defaultBody: "on",
      parseCache: cache,
    });
    cache.flush();
    const second = buildArtifact({
      generatedFrom: "p",
      entries: [{ file: "a.js", source: "function ay() { return 99; }\n" }],
      adapter,
      prefix: "ai",
      defaultBody: "on",
      parseCache: cache,
    });
    expect(first.nodes[0]!.body).toContain("return 1");
    expect(second.nodes[0]!.body).toContain("return 99");
    expect(serializeArtifact(first)).not.toBe(serializeArtifact(second));
  });

  it("does not require writing the sidecar until flush", () => {
    const dir = mkdtempSync(join(tmpdir(), "lucider-cache-"));
    dirs.push(dir);
    writeFileSync(join(dir, "keep"), "x");
    const cache = new FileParseCache(join(dir, "missing", "parse-cache.json"));
    buildArtifact({
      generatedFrom: "p",
      entries: [{ file: "a.js", source: "function ay() { return 1; }\n" }],
      adapter,
      prefix: "ai",
      defaultBody: "on",
      parseCache: cache,
    });
    cache.flush();
    const again = new FileParseCache(join(dir, "missing", "parse-cache.json"));
    const hit = again.load("a.js", "function ay() { return 1; }\n", "ai");
    expect(hit).toBeDefined();
    expect(hit!.raws[0]!.name).toBe("ay");
  });
});
