import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { queryChunk } from "../../src/core/query.js";
import { renderMarkdown } from "../../src/output/markdown.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";
import { approxTokens } from "../../src/core/metrics.js";

function eightPlusSymbols(): string {
  const extras = Array.from({ length: 8 }, (_, i) => `function helper${i}() { return ${i}; }`);
  return [
    "// ai-context: logs a user in",
    "function login() { return true; }",
    ...extras,
  ].join("\n") + "\n";
}

describe("US1 SC-001 chunk size", () => {
  it("depth-0 chunk for one name is at least 70% smaller than the full map", () => {
    const artifact = buildArtifact({
      generatedFrom: "big.js",
      entries: [{ file: "big.js", source: eightPlusSymbols() }],
      adapter: new JavaScriptAdapter(),
      prefix: "ai",
      defaultBody: "off",
    });
    expect(artifact.nodes.length).toBeGreaterThanOrEqual(8);

    const full = renderMarkdown(artifact);
    const chunk = queryChunk(artifact, { search: "login", depth: 0, includeSeedBodies: false });
    expect(chunk.nodes.map((n) => n.name)).toEqual(["login"]);

    const fullTok = approxTokens(full);
    const chunkTok = approxTokens(chunk.markdown);
    expect(1 - chunkTok / fullTok).toBeGreaterThanOrEqual(0.7);
  });
});
