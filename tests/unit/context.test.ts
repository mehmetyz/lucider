import { describe, it, expect } from "vitest";
import { deriveSummary, applyContext } from "../../src/core/context.js";
import type { RawNode } from "../../src/core/nodes.js";
import type { Directive } from "../../src/types.js";

function directive(key: string, value: string): Directive {
  return {
    key,
    value,
    prefix: "ai",
    raw: `ai-${key}: ${value}`,
    location: { file: "f.js", startLine: 1, endLine: 1 },
    status: "ok",
  };
}

function rawNode(text: string, directives: Directive[] = []): RawNode {
  return {
    id: "f.js::sum#function@0",
    kind: "function",
    name: "sum",
    location: { file: "f.js", startLine: 2, endLine: 4 },
    startIndex: 0,
    endIndex: text.length,
    text,
    directives,
    omitRanges: [],
  };
}

describe("context", () => {
  it("derives a signature-style summary from the declaration", () => {
    const summary = deriveSummary(rawNode("function sum(a, b) {\n  return a + b;\n}"));
    expect(summary).toBe("function sum(a, b)");
  });

  it("uses derived context when no ai-context directive is present", () => {
    const r = applyContext(rawNode("function sum(a, b) { return a + b; }"), "on");
    expect(r.contextSource).toBe("derived");
    expect(r.context).toContain("function sum");
  });

  it("overrides with authored ai-context when present (hybrid)", () => {
    const r = applyContext(
      rawNode("function sum(a, b) { return a + b; }", [directive("context", "adds two numbers")]),
      "on",
    );
    expect(r.contextSource).toBe("authored");
    expect(r.context).toBe("adds two numbers");
  });

  it("excludes the body when ai-body: off, emitting body: null", () => {
    const r = applyContext(
      rawNode("function sum(a, b) { return a + b; }", [directive("body", "off")]),
      "on",
    );
    expect(r.bodyIncluded).toBe(false);
    expect(r.body).toBeNull();
  });

  it("includes the body when ai-body: on", () => {
    const text = "function sum(a, b) { return a + b; }";
    const r = applyContext(rawNode(text, [directive("body", "on")]), "off");
    expect(r.bodyIncluded).toBe(true);
    expect(r.body).toBe(text);
  });

  it("honors the configured default when ai-body is unspecified", () => {
    expect(applyContext(rawNode("function f(){}"), "off").bodyIncluded).toBe(false);
    expect(applyContext(rawNode("function f(){}"), "on").bodyIncluded).toBe(true);
  });
});
