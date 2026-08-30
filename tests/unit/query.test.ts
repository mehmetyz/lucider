import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { queryChunk } from "../../src/core/query.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";

const source = [
  "// ai-context: logs a user in",
  "// ai-deps: hashPassword",
  "function login(user, pass) { return hashPassword(pass); }",
  "// ai-context: hashes a password",
  "function hashPassword(p) { return p; }",
  "// ai-ignore",
  "function secret() { return 'nope'; }",
  "function unrelated() { return 0; }",
].join("\n");

const artifact = buildArtifact({
  generatedFrom: "auth.js",
  entries: [{ file: "auth.js", source }],
  adapter: new JavaScriptAdapter(),
  prefix: "ai",
  defaultBody: "off",
});

describe("queryChunk (dynamic context)", () => {
  it("depth 0 returns only the matched node as a short chunk", () => {
    const chunk = queryChunk(artifact, { search: "login", depth: 0 });
    const names = chunk.nodes.map((n) => n.name);
    expect(names).toEqual(["login"]);
    expect(chunk.markdown).toContain("logs a user in");
    expect(chunk.markdown).not.toContain("unrelated");
    expect(chunk.markdown).not.toContain("secret");
  });

  it("depth 1 expands along depends edges (and not unrelated symbols)", () => {
    const chunk = queryChunk(artifact, { search: "login", depth: 1 });
    const names = chunk.nodes.map((n) => n.name).sort();
    expect(names).toEqual(["hashPassword", "login"]);
    expect(names).not.toContain("unrelated");
    expect(names).not.toContain("secret");
  });

  it("includes bodies for seed nodes when they were captured", () => {
    const rich = buildArtifact({
      generatedFrom: "auth.js",
      entries: [{ file: "auth.js", source }],
      adapter: new JavaScriptAdapter(),
      prefix: "ai",
      defaultBody: "on",
    });
    const chunk = queryChunk(rich, { search: "login", depth: 0, includeSeedBodies: true });
    expect(chunk.nodes[0]!.body).toContain("hashPassword");
    expect(chunk.markdown).toContain("function login");
  });

  it("does not treat the file path as a match (checkout vs checkout.ts)", () => {
    const artifact = buildArtifact({
      generatedFrom: "proj",
      entries: [
        {
          file: "checkout.ts",
          source:
            "function checkout() { return 1; }\nfunction formatMoney() { return 2; }\n",
        },
      ],
      adapter: new JavaScriptAdapter(),
      prefix: "ai",
      defaultBody: "off",
    });
    const chunk = queryChunk(artifact, { search: "checkout", depth: 0 });
    expect(chunk.nodes.map((n) => n.name)).toEqual(["checkout"]);
  });

  it("ignores weak context hits when an exact name match exists", () => {
    const artifact = buildArtifact({
      generatedFrom: "proj",
      entries: [
        {
          file: "a.ts",
          source:
            "// ai-context: used by checkout\nfunction lines() { return []; }\nfunction checkout() { return 1; }\n",
        },
      ],
      adapter: new JavaScriptAdapter(),
      prefix: "ai",
      defaultBody: "off",
    });
    const chunk = queryChunk(artifact, { search: "checkout", depth: 0 });
    expect(chunk.nodes.map((n) => n.name)).toEqual(["checkout"]);
  });
});
