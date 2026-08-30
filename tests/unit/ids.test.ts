import { describe, it, expect } from "vitest";
import { makeNodeId } from "../../src/core/ids.js";

describe("makeNodeId", () => {
  it("builds a stable composite id", () => {
    expect(makeNodeId("src/math.js", "sum", "function", 0)).toBe(
      "src/math.js::sum#function@0",
    );
  });

  it("disambiguates same-named symbols by index", () => {
    const a = makeNodeId("a.js", "run", "function", 0);
    const b = makeNodeId("a.js", "run", "function", 1);
    expect(a).not.toBe(b);
  });

  it("is deterministic for identical inputs", () => {
    expect(makeNodeId("f.js", "x", "class", 2)).toBe(
      makeNodeId("f.js", "x", "class", 2),
    );
  });
});
