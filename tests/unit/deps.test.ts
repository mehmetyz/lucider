import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
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

describe("ai-deps", () => {
  const source = [
    "// ai-context: logs a user in",
    "// ai-deps: hashPassword, issueToken",
    "function login(user, pass) { return issueToken(user, hashPassword(pass)); }",
    "// ai-context: hashes a password",
    "function hashPassword(p) { return p; }",
    "function issueToken(u, h) { return u + h; }",
  ].join("\n");

  it("creates depends edges from the annotated node to named symbols", () => {
    const a = artifact(source);
    const login = a.nodes.find((n) => n.name === "login")!;
    const hash = a.nodes.find((n) => n.name === "hashPassword")!;
    const token = a.nodes.find((n) => n.name === "issueToken")!;
    expect(a.edges).toContainEqual({ type: "depends", from: login.id, to: hash.id });
    expect(a.edges).toContainEqual({ type: "depends", from: login.id, to: token.id });
  });

  it("warns on unresolved dependency names", () => {
    const a = artifact(
      "// ai-deps: doesNotExist\nfunction login() { return 1; }\n",
    );
    expect(a.warnings.some((w) => w.code === "unresolved_dep")).toBe(true);
  });
});
