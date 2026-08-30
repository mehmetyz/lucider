import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";

const adapter = new JavaScriptAdapter();

describe("no silent drops (SC-005 / FR-009)", () => {
  it("emits located warnings for malformed, unknown, conflicting and orphaned directives", () => {
    const source = [
      "// ai-context:", // malformed (empty value)
      "// ai-bogus: x", // unknown key
      "// ai-body: on",
      "// ai-body: off", // conflict
      "function f() { return 1; }",
      "// ai-context: dangling", // orphaned (no following declaration)
    ].join("\n");

    const artifact = buildArtifact({
      generatedFrom: "w.js",
      entries: [{ file: "w.js", source }],
      adapter,
      prefix: "ai",
      defaultBody: "on",
    });

    const codes = new Set(artifact.warnings.map((w) => w.code));
    expect(codes.has("malformed_directive")).toBe(true);
    expect(codes.has("unknown_key")).toBe(true);
    expect(codes.has("conflict")).toBe(true);
    expect(codes.has("orphaned_directive")).toBe(true);

    for (const w of artifact.warnings) {
      expect(w.location).not.toBeNull();
      expect(w.location!.file).toBe("w.js");
    }
  });
});
