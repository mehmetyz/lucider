import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { queryChunk } from "../../src/core/query.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";

function artifact(source: string, file = "auth.js") {
  return buildArtifact({
    generatedFrom: file,
    entries: [{ file, source }],
    adapter: new JavaScriptAdapter(),
    prefix: "ai",
    defaultBody: "on",
  });
}

describe("structural depends (US1)", () => {
  const unlabeled = [
    "function hashPassword(p) { return p; }",
    "function login(user, pass) { return hashPassword(pass); }",
  ].join("\n");

  it("records a depends edge from an unlabeled call", () => {
    const a = artifact(unlabeled);
    const login = a.nodes.find((n) => n.name === "login")!;
    const hash = a.nodes.find((n) => n.name === "hashPassword")!;
    expect(a.edges).toContainEqual({ type: "depends", from: login.id, to: hash.id });
  });

  it("includes the callee in a depth-1 pack without ai-deps", () => {
    const a = artifact(unlabeled);
    const chunk = queryChunk(a, { search: "login", depth: 1, includeSeedBodies: true });
    expect(chunk.nodes.map((n) => n.name).sort()).toEqual(["hashPassword", "login"]);
  });

  it("unions ai-deps with structural depends without duplicate pairs", () => {
    const source = [
      "// ai-deps: hashPassword",
      "function hashPassword(p) { return p; }",
      "function login(user, pass) { return hashPassword(pass); }",
    ].join("\n");
    const a = artifact(source);
    const login = a.nodes.find((n) => n.name === "login")!;
    const hash = a.nodes.find((n) => n.name === "hashPassword")!;
    const pairs = a.edges.filter(
      (e) => e.type === "depends" && e.from === login.id && e.to === hash.id,
    );
    expect(pairs).toHaveLength(1);
  });

  it("does not invent a node for an unknown callee", () => {
    const a = artifact("function login() { return missingHelper(); }\n");
    expect(a.nodes.map((n) => n.name)).toEqual(["login"]);
    expect(a.edges.filter((e) => e.type === "depends")).toEqual([]);
  });
});
