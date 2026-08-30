import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";
import { SCHEMA_VERSION } from "../../src/types.js";
import { GRAMMAR_VERSION } from "../../src/directives/grammar.js";

const adapter = new JavaScriptAdapter();

function analyze(file: string, source: string, defaultBody: "on" | "off" = "on") {
  return buildArtifact({
    generatedFrom: file,
    entries: [{ file, source }],
    adapter,
    prefix: "ai",
    defaultBody,
  });
}

describe("US1 - optimized context artifact", () => {
  const source =
    "// ai-context: Generates the sum of two numbers\n" +
    "// ai-body: off\n" +
    "function sum(a, b) {\n" +
    "  const total = a + b;\n" +
    "  return total;\n" +
    "}\n";

  it("emits authored context with body excluded (Scenario 1)", () => {
    const artifact = analyze("math.js", source);
    const node = artifact.nodes.find((n) => n.name === "sum")!;
    expect(node.contextSource).toBe("authored");
    expect(node.context).toBe("Generates the sum of two numbers");
    expect(node.bodyIncluded).toBe(false);
    expect(node.body).toBeNull();
  });

  it("carries schema and grammar versions", () => {
    const artifact = analyze("math.js", source);
    expect(artifact.schemaVersion).toBe(SCHEMA_VERSION);
    expect(artifact.grammarVersion).toBe(GRAMMAR_VERSION);
  });

  it("achieves >= 60% token reduction for a fully body-excluded file (SC-001)", () => {
    const artifact = analyze("math.js", source);
    expect(artifact.metrics.reductionRatio).toBeGreaterThanOrEqual(0.6);
  });

  it("includes the body when default is on and no ai-body directive is given", () => {
    const src = "// ai-context: does a thing\nfunction thing() { return 42; }\n";
    const artifact = analyze("t.js", src, "on");
    const node = artifact.nodes.find((n) => n.name === "thing")!;
    expect(node.bodyIncluded).toBe(true);
    expect(node.body).toContain("return 42");
  });
});
