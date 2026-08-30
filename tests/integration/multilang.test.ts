import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { allAdapters, resolveAdapter } from "../../src/parsers/registry.js";

describe("multi-language support", () => {
  it("resolves adapters by file extension", () => {
    const adapters = allAdapters();
    expect(resolveAdapter("x.ts", adapters)?.name).toBe("typescript");
    expect(resolveAdapter("x.tsx", adapters)?.name).toBe("tsx");
    expect(resolveAdapter("x.js", adapters)?.name).toBe("javascript");
    expect(resolveAdapter("x.py", adapters)).toBeUndefined();
  });

  it("builds nodes from both TS and JS entries in one run", () => {
    const artifact = buildArtifact({
      generatedFrom: "proj",
      adapters: allAdapters(),
      prefix: "ai",
      defaultBody: "off",
      entries: [
        { file: "a.ts", source: "// ai-context: typed add\nfunction add(a: number, b: number) { return a + b; }\n" },
        { file: "b.js", source: "// ai-context: plain sub\nfunction sub(a, b) { return a - b; }\n" },
      ],
    });
    const names = artifact.nodes.map((n) => n.name).sort();
    expect(names).toEqual(["add", "sub"]);
  });
});
