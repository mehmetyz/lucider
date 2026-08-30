import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { serializeArtifact } from "../../src/output/artifact.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";

const adapter = new JavaScriptAdapter();

describe("determinism (Constitution Principle II)", () => {
  it("produces byte-identical output across repeated runs", () => {
    const entries = [
      { file: "z.js", source: "// ai-context: zed\nfunction zed() { return 0; }\n" },
      { file: "a.js", source: "// ai-context: ay\nfunction ay() { return 1; }\nfunction bee() { return 2; }\n" },
    ];
    const run = () =>
      serializeArtifact(
        buildArtifact({ generatedFrom: "p", entries, adapter, prefix: "ai", defaultBody: "on" }),
      );
    expect(run()).toBe(run());
  });

  it("is byte-identical for unlabeled calls and exported consts (SC-006)", () => {
    const entries = [
      {
        file: "auth.js",
        source: "function hashPassword(p) { return p; }\nfunction login() { return hashPassword(1); }\n",
      },
      { file: "parse.js", source: "export const parse = (x) => x;\n" },
    ];
    const run = () =>
      serializeArtifact(
        buildArtifact({ generatedFrom: "p", entries, adapter, prefix: "ai", defaultBody: "on" }),
      );
    expect(run()).toBe(run());
  });
});
