import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildArtifact } from "../../src/core/pipeline.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";
import { emptyBaseline } from "../../src/core/staleness.js";
import type { Baseline } from "../../src/types.js";
import { runCli } from "../../src/cli/index.js";

const adapter = new JavaScriptAdapter();

function baselineFrom(source: string): Baseline {
  const artifact = buildArtifact({
    generatedFrom: "f.js",
    entries: [{ file: "f.js", source }],
    adapter,
    prefix: "ai",
    defaultBody: "on",
  });
  const baseline = emptyBaseline();
  for (const n of artifact.nodes) {
    if (n.contextSource === "authored") baseline.fingerprints[n.id] = n.fingerprint;
  }
  return baseline;
}

describe("US3 - stale context detection", () => {
  const original = "// ai-context: adds two numbers\nfunction sum(a, b) { return a + b; }\n";

  it("marks a node fresh when code is unchanged", () => {
    const baseline = baselineFrom(original);
    const artifact = buildArtifact({
      generatedFrom: "f.js",
      entries: [{ file: "f.js", source: original }],
      adapter,
      prefix: "ai",
      defaultBody: "on",
      baseline,
    });
    expect(artifact.nodes.find((n) => n.name === "sum")!.staleness).toBe("fresh");
  });

  it("marks a node stale and warns when code changes but context does not", () => {
    const baseline = baselineFrom(original);
    const changed = "// ai-context: adds two numbers\nfunction sum(a, b) { return a + b + 1; }\n";
    const artifact = buildArtifact({
      generatedFrom: "f.js",
      entries: [{ file: "f.js", source: changed }],
      adapter,
      prefix: "ai",
      defaultBody: "on",
      baseline,
    });
    expect(artifact.nodes.find((n) => n.name === "sum")!.staleness).toBe("stale");
    expect(artifact.warnings.some((w) => w.code === "stale_context")).toBe(true);
  });
});

describe("US3 - CLI strict mode (SC-006)", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("exits non-zero in strict mode when a stale directive is present", () => {
    dir = mkdtempSync(join(tmpdir(), "lucider-"));
    const file = join(dir, "sum.js");
    const baselinePath = join(dir, "baseline.json");
    writeFileSync(file, "// ai-context: adds\nfunction sum(a, b) { return a + b; }\n");

    const updateCode = runCli([file, "--baseline", baselinePath, "--update-baseline"]);
    expect(updateCode).toBe(0);

    writeFileSync(file, "// ai-context: adds\nfunction sum(a, b) { return a + b + 99; }\n");
    const strictCode = runCli([file, "--baseline", baselinePath, "--strict", "--out", join(dir, "out.json")]);
    expect(strictCode).toBe(1);
  });
});
