import { describe, it, expect } from "vitest";
import { buildNodes } from "../../src/core/nodes.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";
import { createRegistry } from "../../src/directives/registry.js";
import { WarningCollector } from "../../src/core/warnings.js";

const adapter = new JavaScriptAdapter();

function build(source: string, file = "test.js") {
  const warnings = new WarningCollector();
  const nodes = buildNodes({
    file,
    source,
    adapter,
    prefix: "ai",
    registry: createRegistry(),
    warnings,
  });
  return { nodes, warnings };
}

describe("buildNodes / directive association", () => {
  it("associates a directive block with the next declaration", () => {
    const src = "// ai-context: sums two numbers\n// ai-body: off\nfunction sum(a, b) { return a + b; }\n";
    const { nodes } = build(src);
    const sum = nodes.find((n) => n.name === "sum")!;
    expect(sum).toBeDefined();
    expect(sum.directives.map((d) => d.key).sort()).toEqual(["body", "context"]);
  });

  it("warns on an orphaned directive with no following declaration", () => {
    const src = "function done() {}\n// ai-context: dangling at end\n";
    const { warnings } = build(src);
    expect(warnings.list().some((w) => w.code === "orphaned_directive")).toBe(true);
  });

  it("warns on a malformed (empty value) directive", () => {
    const src = "// ai-context:\nfunction f() {}\n";
    const { warnings } = build(src);
    expect(warnings.list().some((w) => w.code === "malformed_directive")).toBe(true);
  });

  it("warns on an unknown key", () => {
    const src = "// ai-bogus: x\nfunction f() {}\n";
    const { warnings } = build(src);
    expect(warnings.list().some((w) => w.code === "unknown_key")).toBe(true);
  });

  it("detects conflicting directives in one block (last-writer-wins + warning)", () => {
    const src = "// ai-body: on\n// ai-body: off\nfunction f() { return 1; }\n";
    const { nodes, warnings } = build(src);
    expect(warnings.list().some((w) => w.code === "conflict")).toBe(true);
    const f = nodes.find((n) => n.name === "f")!;
    const body = f.directives.filter((d) => d.key === "body").at(-1)!;
    expect(body.value).toBe("off");
  });
});
