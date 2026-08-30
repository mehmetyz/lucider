import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { queryChunk } from "../../src/core/query.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";

describe("ai-deps pointing at an ignored symbol (SC-006)", () => {
  const source = [
    "// ai-ignore",
    "function dumpDebugSecrets() { return process.env.SECRET; }",
    "// ai-context: logs a user in",
    "// ai-deps: dumpDebugSecrets",
    "function login() { return true; }",
    "function visible() { return 1; }",
  ].join("\n");

  const artifact = buildArtifact({
    generatedFrom: "auth.js",
    entries: [{ file: "auth.js", source }],
    adapter: new JavaScriptAdapter(),
    prefix: "ai",
    defaultBody: "on",
  });

  it("does not put the ignored symbol on the map", () => {
    expect(artifact.nodes.map((n) => n.name).sort()).toEqual(["login", "visible"]);
  });

  it("warns unresolved_dep and does not leak the ignored name into a depth-1 chunk", () => {
    expect(artifact.warnings.some((w) => w.code === "unresolved_dep")).toBe(true);
    const chunk = queryChunk(artifact, { search: "login", depth: 1, includeSeedBodies: true });
    expect(chunk.nodes.map((n) => n.name)).toEqual(["login"]);
    expect(chunk.markdown).not.toContain("dumpDebugSecrets");
  });
});
