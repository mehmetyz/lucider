import { describe, it, expect } from "vitest";
import { createRegistry } from "../../src/directives/registry.js";

describe("registry", () => {
  it("recognizes the v1 known keys", () => {
    const r = createRegistry();
    expect(r.isKnown("context")).toBe(true);
    expect(r.isKnown("body")).toBe(true);
    expect(r.isKnown("ignore")).toBe(true);
    expect(r.isKnown("deps")).toBe(true);
    expect(r.isKnown("ignore")).toBe(true);
    expect(r.isKnown("deps")).toBe(true);
  });

  it("reports unknown keys", () => {
    const r = createRegistry();
    expect(r.isKnown("wat")).toBe(false);
    expect(r.deprecationOf("wat")).toBeUndefined();
  });

  it("supports deprecated keys with a replacement (mechanism present even if v1 has none)", () => {
    const r = createRegistry({
      deprecations: [
        { key: "summary", replacedBy: "context", deprecatedInGrammar: "1.0.0", removedInGrammar: "2.0.0" },
      ],
    });
    expect(r.isKnown("summary")).toBe(true);
    const dep = r.deprecationOf("summary");
    expect(dep).toMatchObject({ key: "summary", replacedBy: "context" });
  });
});
