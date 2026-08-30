import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { queryChunk } from "../../src/core/query.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";

const artifact = buildArtifact({
  generatedFrom: "proj",
  entries: [
    {
      file: "auth.js",
      source: [
        "function hashPassword(p) { return p; }",
        "function login(user, pass) { return hashPassword(pass); }",
      ].join("\n"),
    },
    {
      file: "cart.js",
      source: "function add(sku) { return sku; }\n",
    },
  ],
  adapter: new JavaScriptAdapter(),
  prefix: "ai",
  defaultBody: "on",
});

describe("query seeds (US4 / US5)", () => {
  it("seeds only symbols in the given file at depth 0", () => {
    const chunk = queryChunk(artifact, { files: ["auth.js"], depth: 0 });
    expect(chunk.nodes.map((n) => n.name).sort()).toEqual(["hashPassword", "login"]);
    expect(chunk.nodes.every((n) => n.location.file === "auth.js")).toBe(true);
    expect(chunk.markdown).not.toContain("add");
  });

  it("seeds the innermost symbol covering a line range", () => {
    const login = artifact.nodes.find((n) => n.name === "login")!;
    const chunk = queryChunk(artifact, {
      lineRanges: [
        {
          file: "auth.js",
          startLine: login.location.startLine,
          endLine: login.location.startLine,
        },
      ],
      depth: 0,
    });
    expect(chunk.nodes.map((n) => n.name)).toEqual(["login"]);
  });

  it("returns no-match markdown instead of the catalog when nothing overlaps", () => {
    const chunk = queryChunk(artifact, {
      lineRanges: [{ file: "auth.js", startLine: 999, endLine: 1000 }],
      depth: 0,
    });
    expect(chunk.nodes).toEqual([]);
    expect(chunk.packTokens).toBe(0);
    expect(chunk.markdown).toContain("_No matching symbols._");
    expect(chunk.markdown).not.toContain("schemaVersion");
  });

  it("returns no-match markdown for an unknown node id (US5)", () => {
    const chunk = queryChunk(artifact, { nodeId: "nope::missing#function@0", depth: 0 });
    expect(chunk.nodes).toEqual([]);
    expect(chunk.markdown).toContain("_No matching symbols._");
  });

  it("packs a known node id", () => {
    const login = artifact.nodes.find((n) => n.name === "login")!;
    const chunk = queryChunk(artifact, { nodeId: login.id, depth: 0, includeSeedBodies: true });
    expect(chunk.nodes.map((n) => n.id)).toEqual([login.id]);
  });
});
