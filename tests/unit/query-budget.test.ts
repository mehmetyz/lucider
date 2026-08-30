import { describe, it, expect } from "vitest";
import { approxTokens } from "../../src/core/metrics.js";
import { buildArtifact } from "../../src/core/pipeline.js";
import { queryChunk } from "../../src/core/query.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";

const padding = Array.from({ length: 80 }, (_, i) => `token${i}`).join(" ");

const source = [
  "function seed() { return huge(); }",
  `function huge() { return "${padding}"; }`,
  "function other() { return 0; }",
].join("\n");

const artifact = buildArtifact({
  generatedFrom: "demo.js",
  entries: [{ file: "demo.js", source }],
  adapter: new JavaScriptAdapter(),
  prefix: "ai",
  defaultBody: "on",
});

describe("query budget (US3)", () => {
  it("caps packTokens at maxTokens while keeping the seed", () => {
    const chunk = queryChunk(artifact, {
      search: "seed",
      depth: 1,
      includeSeedBodies: true,
      maxTokens: 80,
    });
    expect(chunk.packTokens).toBeLessThanOrEqual(80);
    expect(chunk.nodes.some((n) => n.name === "seed")).toBe(true);
    expect(chunk.nodes.some((n) => n.name === "other")).toBe(false);
  });

  it("fills the seed body before neighbor bodies", () => {
    const unlimited = queryChunk(artifact, {
      search: "seed",
      depth: 1,
      includeSeedBodies: true,
    });
    const seed = unlimited.nodes.find((n) => n.name === "seed")!;
    const huge = unlimited.nodes.find((n) => n.name === "huge")!;
    const budget =
      approxTokens(`${seed.context}\n${seed.body}`) + approxTokens(huge.context);
    const chunk = queryChunk(artifact, {
      search: "seed",
      depth: 1,
      includeSeedBodies: true,
      maxTokens: budget,
    });
    expect(chunk.nodes.find((n) => n.name === "seed")!.bodyIncluded).toBe(true);
    const neighbor = chunk.nodes.find((n) => n.name === "huge");
    if (neighbor) expect(neighbor.bodyIncluded).toBe(false);
  });

  it("matches today's unbounded slice when maxTokens is omitted", () => {
    const chunk = queryChunk(artifact, { search: "seed", depth: 1, includeSeedBodies: true });
    expect(chunk.nodes.map((n) => n.name).sort()).toEqual(["huge", "seed"]);
    expect(chunk.nodes.find((n) => n.name === "huge")!.bodyIncluded).toBe(true);
    expect(chunk.truncated).toBe(false);
  });

  it("is at least 50% smaller than full-index emission under a tight budget (SC-004)", () => {
    const chunk = queryChunk(artifact, {
      search: "seed",
      depth: 1,
      includeSeedBodies: true,
      maxTokens: 80,
    });
    expect(chunk.packTokens).toBeLessThanOrEqual(artifact.metrics.emittedTokens * 0.5);
  });

  it("notes budget_truncated when a seed body does not fit", () => {
    const seed = artifact.nodes.find((n) => n.name === "seed")!;
    const chunk = queryChunk(artifact, {
      search: "seed",
      depth: 0,
      includeSeedBodies: true,
      maxTokens: Math.max(1, approxTokens(seed.context)),
    });
    expect(chunk.nodes.find((n) => n.name === "seed")!.bodyIncluded).toBe(false);
    expect(chunk.truncated).toBe(true);
    expect(chunk.markdown).toMatch(/budget_truncated/);
  });
});
