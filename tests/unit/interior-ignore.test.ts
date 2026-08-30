import { describe, it, expect } from "vitest";
import { buildArtifact } from "../../src/core/pipeline.js";
import { queryChunk } from "../../src/core/query.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";
import { approxTokens } from "../../src/core/metrics.js";

const US1_SOURCE = [
  "function test() {",
  "  doWork()",
  "  // ai-ignore",
  "  console.log('dasfsaf')",
  "  return 1",
  "}",
  "",
].join("\n");

function artifact(source: string, file = "demo.js") {
  return buildArtifact({
    generatedFrom: file,
    entries: [{ file, source }],
    adapter: new JavaScriptAdapter(),
    prefix: "ai",
    defaultBody: "on",
  });
}

describe("interior ai-ignore (US1)", () => {
  it("keeps the enclosing function as a graph node", () => {
    const a = artifact(US1_SOURCE);
    expect(a.nodes.map((n) => n.name)).toEqual(["test"]);
  });

  it("omits the ignored statement and the ignore comment from the published body", () => {
    const a = artifact(US1_SOURCE);
    const body = a.nodes[0]!.body ?? "";
    expect(body).toContain("doWork()");
    expect(body).toContain("return 1");
    expect(body).not.toContain("console.log");
    expect(body).not.toContain("dasfsaf");
    expect(body).not.toContain("ai-ignore");
  });

  it("query chunk body matches the published map body", () => {
    const a = artifact(US1_SOURCE);
    const mapBody = a.nodes[0]!.body;
    const chunk = queryChunk(a, { search: "test", depth: 0, includeSeedBodies: true });
    expect(chunk.nodes.map((n) => n.name)).toEqual(["test"]);
    expect(chunk.nodes[0]!.body).toBe(mapBody);
    expect(chunk.markdown).toContain("doWork()");
    expect(chunk.markdown).not.toContain("console.log");
    expect(chunk.markdown).not.toContain("ai-ignore");
  });
});

describe("trailing interior ai-ignore (US3)", () => {
  const source = [
    "function test() {",
    "  return 1",
    "  // ai-ignore",
    "}",
    "",
  ].join("\n");

  it("keeps the node, leaves prior instructions, and warns orphaned_directive", () => {
    const a = artifact(source);
    expect(a.nodes.map((n) => n.name)).toEqual(["test"]);
    const body = a.nodes[0]!.body ?? "";
    expect(body).toContain("return 1");
    expect(a.warnings.some((w) => w.code === "orphaned_directive")).toBe(true);
    expect(
      a.warnings.some(
        (w) =>
          w.code === "orphaned_directive" &&
          w.message.toLowerCase().includes("no following instruction"),
      ),
    ).toBe(true);
  });
});

describe("interior ignore token impact (SC-004)", () => {
  it("reduces published body by at least 20% when the ignored span is ≥20% of the declaration", () => {
    const noise = "N".repeat(80);
    const withIgnore = [
      "function test() {",
      "  const x = 1",
      "  // ai-ignore",
      `  console.log('${noise}')`,
      "  return x",
      "}",
      "",
    ].join("\n");
    const withoutIgnore = [
      "function test() {",
      "  const x = 1",
      `  console.log('${noise}')`,
      "  return x",
      "}",
      "",
    ].join("\n");

    const published = artifact(withIgnore).nodes[0]!.body!;
    const baseline = artifact(withoutIgnore).nodes[0]!.body!;
    expect(baseline.length - published.length).toBeGreaterThanOrEqual(
      Math.ceil(baseline.length * 0.2),
    );
    expect(approxTokens(published)).toBeLessThanOrEqual(approxTokens(baseline) * 0.8);
  });
});
