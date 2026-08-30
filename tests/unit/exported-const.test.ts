import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { queryChunk } from "../../src/core/query.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";

const adapter = new JavaScriptAdapter();

describe("exported const symbols (US2)", () => {
  it("emits export const as kind const and packs it by name", () => {
    const a = buildArtifact({
      generatedFrom: "parse.js",
      entries: [{ file: "parse.js", source: "export const parse = (x) => x;\n" }],
      adapter,
      prefix: "ai",
      defaultBody: "on",
    });
    const node = a.nodes.find((n) => n.name === "parse");
    expect(node).toBeDefined();
    expect(node!.kind).toBe("const");
    const chunk = queryChunk(a, { search: "parse", depth: 0, includeSeedBodies: true });
    expect(chunk.nodes.map((n) => n.name)).toEqual(["parse"]);
    expect(chunk.markdown).toContain("parse");
  });

  it("keeps export const parse distinct from function parse in another file", () => {
    const a = buildArtifact({
      generatedFrom: "proj",
      entries: [
        { file: "parse.js", source: "export const parse = (x) => x;\n" },
        { file: "fn.js", source: "function parse() { return 1; }\n" },
      ],
      adapter,
      prefix: "ai",
      defaultBody: "on",
    });
    const kinds = a.nodes.filter((n) => n.name === "parse").map((n) => n.kind).sort();
    expect(kinds).toEqual(["const", "function"]);
    expect(a.nodes.find((n) => n.kind === "const")!.id).not.toBe(
      a.nodes.find((n) => n.kind === "function")!.id,
    );
  });

  it("does not index a non-exported inner const", () => {
    const a = buildArtifact({
      generatedFrom: "inner.js",
      entries: [
        {
          file: "inner.js",
          source: "function wrap() {\n  const hidden = 1;\n  return hidden;\n}\n",
        },
      ],
      adapter,
      prefix: "ai",
      defaultBody: "on",
    });
    expect(a.nodes.some((n) => n.name === "hidden")).toBe(false);
  });
});
