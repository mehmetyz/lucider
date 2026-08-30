import { describe, it, expect } from "vitest";
import { extractDirectives } from "../../src/directives/grammar.js";
import { buildNodes } from "../../src/core/nodes.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";
import { createRegistry } from "../../src/directives/registry.js";
import { WarningCollector } from "../../src/core/warnings.js";
import { buildArtifact } from "../../src/core/pipeline.js";
import { queryChunk } from "../../src/core/query.js";
import type { CommentNode } from "../../src/parsers/adapter.js";

function line(text: string, n = 1): CommentNode {
  return { text, startLine: n, endLine: n, startIndex: 0, endIndex: text.length };
}

function nodes(source: string, file = "t.js") {
  const warnings = new WarningCollector();
  return {
    nodes: buildNodes({
      file,
      source,
      adapter: new JavaScriptAdapter(),
      prefix: "ai",
      registry: createRegistry(),
      warnings,
    }),
    warnings,
  };
}

describe("ai-ignore grammar", () => {
  it("accepts valueless ai-ignore without a colon", () => {
    const [d] = extractDirectives(line("// ai-ignore"), "ai");
    expect(d).toMatchObject({ key: "ignore", value: "", status: "ok" });
  });

  it("accepts ai-ignore: with empty value as ok (not malformed)", () => {
    const [d] = extractDirectives(line("// ai-ignore:"), "ai");
    expect(d).toMatchObject({ key: "ignore", status: "ok" });
  });

  it("accepts @ai-ignore and @ai ignore forms", () => {
    expect(extractDirectives(line("// @ai-ignore"), "ai")[0]?.key).toBe("ignore");
    expect(extractDirectives(line("// @ai ignore"), "ai")[0]?.key).toBe("ignore");
  });

  it("still flags empty ai-context as malformed", () => {
    const [d] = extractDirectives(line("// ai-context:"), "ai");
    expect(d!.status).toBe("malformed");
  });
});

describe("ai-ignore association", () => {
  it("drops the annotated declaration from the graph", () => {
    const src =
      "// ai-ignore\nfunction secret() { return 1; }\nfunction publicFn() { return 2; }\n";
    const { nodes: n, warnings } = nodes(src);
    expect(n.map((x) => x.name)).toEqual(["publicFn"]);
    expect(warnings.list().some((w) => w.code === "malformed_directive")).toBe(false);
  });

  it("drops declaration-level ignore while keeping a sibling with only interior ignore", () => {
    const src = [
      "// ai-ignore",
      "function secret() { return 1 }",
      "function test() {",
      "  // ai-ignore",
      "  console.log('x')",
      "  return 2",
      "}",
      "",
    ].join("\n");
    const artifact = buildArtifact({
      generatedFrom: "t.js",
      entries: [{ file: "t.js", source: src }],
      adapter: new JavaScriptAdapter(),
      prefix: "ai",
      defaultBody: "on",
    });
    expect(artifact.nodes.map((n) => n.name)).toEqual(["test"]);
    const body = artifact.nodes[0]!.body ?? "";
    expect(body).toContain("return 2");
    expect(body).not.toContain("console.log");
    const chunk = queryChunk(artifact, { search: "secret", depth: 0 });
    expect(chunk.nodes.every((n) => n.name !== "secret")).toBe(true);
  });

  it("does not emit the ignored symbol in the artifact", () => {
    const artifact = buildArtifact({
      generatedFrom: "t.js",
      entries: [
        {
          file: "t.js",
          source:
            "// ai-ignore\nfunction hidden() { return 0; }\n// ai-context: visible helper\nfunction shown() { return 1; }\n",
        },
      ],
      adapter: new JavaScriptAdapter(),
      prefix: "ai",
      defaultBody: "on",
    });
    expect(artifact.nodes.map((x) => x.name)).toEqual(["shown"]);
    expect(artifact.edges.every((e) => !e.to.includes("hidden"))).toBe(true);
  });
});
