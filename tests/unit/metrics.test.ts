import { describe, it, expect } from "vitest";
import { approxTokens, computeMetrics } from "../../src/core/metrics.js";

describe("metrics", () => {
  it("counts tokens deterministically", () => {
    const a = approxTokens("function sum(a, b)");
    const b = approxTokens("function sum(a, b)");
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
  });

  it("computes a reduction ratio between 0 and 1", () => {
    const raw = "function sum(a, b) {\n  const total = a + b;\n  return total;\n}";
    const m = computeMetrics(raw, [{ context: "sums a and b", body: null }]);
    expect(m.reductionRatio).toBeGreaterThan(0);
    expect(m.reductionRatio).toBeLessThanOrEqual(1);
    expect(m.emittedTokens).toBeLessThan(m.rawTokens);
  });

  it("handles empty raw source without dividing by zero", () => {
    const m = computeMetrics("", []);
    expect(m.reductionRatio).toBe(0);
  });
});
