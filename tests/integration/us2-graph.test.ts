import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { neighbourSlice } from "../../src/core/graph.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";

const adapter = new JavaScriptAdapter();

describe("US2 - relationship graph", () => {
  const entries = [
    { file: "a.js", source: "// ai-context: greets\nfunction greet() { return 'hi'; }\n" },
    {
      file: "b.js",
      source:
        "class Store {\n  // ai-context: saves an item\n  save(x) { return x; }\n}\n",
    },
  ];

  const artifact = buildArtifact({
    generatedFrom: "proj",
    entries,
    adapter,
    prefix: "ai",
    defaultBody: "on",
  });

  it("creates a node per annotated symbol with stable ids", () => {
    const ids = artifact.nodes.map((n) => n.id);
    expect(ids).toContain("a.js::greet#function@0");
    expect(ids).toContain("b.js::Store#class@0");
    expect(ids).toContain("b.js::save#method@0");
  });

  it("links top-level symbols from their file and methods from their class", () => {
    expect(artifact.edges).toContainEqual({
      type: "contains",
      from: "a.js",
      to: "a.js::greet#function@0",
    });
    expect(artifact.edges).toContainEqual({
      type: "contains",
      from: "b.js::Store#class@0",
      to: "b.js::save#method@0",
    });
  });

  it("returns a node plus its immediate neighbours (bounded slice)", () => {
    const slice = neighbourSlice(artifact.nodes, artifact.edges, "b.js::Store#class@0");
    expect(slice).toBeDefined();
    const neighbourIds = slice!.neighbours.map((n) => n.id);
    expect(neighbourIds).toContain("b.js::save#method@0");
  });

  it("returns undefined for an unknown node id", () => {
    expect(neighbourSlice(artifact.nodes, artifact.edges, "nope")).toBeUndefined();
  });
});
