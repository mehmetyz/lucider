import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";

const adapter = new JavaScriptAdapter();

function generate(functionCount: number): string {
  const lines: string[] = [];
  for (let i = 0; i < functionCount; i++) {
    lines.push(`// ai-context: function number ${i}`);
    lines.push(`// ai-body: off`);
    lines.push(`function fn${i}(a, b) {`);
    lines.push(`  const r = a + b + ${i};`);
    lines.push(`  return r;`);
    lines.push(`}`);
  }
  return lines.join("\n") + "\n";
}

function timeBuild(source: string): { ms: number; nodeCount: number } {
  const start = performance.now();
  const artifact = buildArtifact({
    generatedFrom: "perf.js",
    entries: [{ file: "perf.js", source }],
    adapter,
    prefix: "ai",
    defaultBody: "off",
  });
  return { ms: performance.now() - start, nodeCount: artifact.nodes.length };
}

describe("performance (SC-004) - approximately linear scaling", () => {
  it("processes a ~10k-line project and produces the expected node count", () => {
    // ~1,700 functions * 6 lines ≈ 10,200 lines
    const big = generate(1700);
    const { ms, nodeCount } = timeBuild(big);
    expect(nodeCount).toBe(1700);
    // Generous absolute bound to prove feasibility without flakiness.
    expect(ms).toBeLessThan(5000);
  });

  it("scales no worse than roughly proportional vs a 1k-line baseline", () => {
    const small = timeBuild(generate(170)); // ~1,020 lines
    const big = timeBuild(generate(1700)); // ~10,200 lines (10x)
    // Allow a very generous factor to absorb JIT/GC noise; guards against
    // accidental super-linear (e.g. O(n^2)) regressions.
    const floorMs = 5;
    const ratio = big.ms / Math.max(small.ms, floorMs);
    expect(ratio).toBeLessThan(30);
  });
});
