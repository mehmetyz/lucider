import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../../src/output/markdown.js";
import type { ContextArtifact } from "../../src/types.js";

function artifact(overrides: Partial<ContextArtifact> = {}): ContextArtifact {
  return {
    schemaVersion: "1.0.0",
    grammarVersion: "1.0.0",
    generatedFrom: "src",
    nodes: [
      {
        id: "a.ts::sum#function@0",
        kind: "function",
        name: "sum",
        location: { file: "a.ts", startLine: 2, endLine: 4 },
        derivedSummary: "function sum(a, b)",
        context: "Adds two numbers",
        contextSource: "authored",
        bodyIncluded: false,
        body: null,
        fingerprint: "abc",
        staleness: "stale",
        directives: [],
      },
      {
        id: "a.ts::mul#function@0",
        kind: "function",
        name: "mul",
        location: { file: "a.ts", startLine: 7, endLine: 9 },
        derivedSummary: "function mul(a, b)",
        context: "Multiplies",
        contextSource: "derived",
        bodyIncluded: true,
        body: "function mul(a, b) { return a * b; }",
        fingerprint: "def",
        staleness: "fresh",
        directives: [],
      },
    ],
    edges: [],
    warnings: [],
    metrics: { rawTokens: 100, emittedTokens: 30, reductionRatio: 0.7, rawBytes: 1, emittedBytes: 1 },
    ...overrides,
  };
}

describe("renderMarkdown", () => {
  it("includes each symbol's context", () => {
    const md = renderMarkdown(artifact());
    expect(md).toContain("Adds two numbers");
    expect(md).toContain("Multiplies");
  });

  it("omits body when excluded but includes it fenced when present", () => {
    const md = renderMarkdown(artifact());
    expect(md).toContain("function mul(a, b) { return a * b; }");
    expect(md).toContain("```");
  });

  it("marks stale nodes", () => {
    const md = renderMarkdown(artifact());
    expect(md.toLowerCase()).toContain("stale");
  });

  it("groups by file and reports reduction", () => {
    const md = renderMarkdown(artifact());
    expect(md).toContain("a.ts");
    expect(md).toMatch(/70(\.0+)?%/);
  });
});
