import { describe, it, expect } from "vitest";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";

const adapter = new JavaScriptAdapter();

describe("JavaScriptAdapter", () => {
  it("declares its extensions", () => {
    expect(adapter.extensions).toContain(".js");
  });

  it("extracts function declarations with names and positions", () => {
    const src = "// ai-context: adds\nfunction sum(a, b) {\n  return a + b;\n}\n";
    const decls = adapter.parseDeclarations(src);
    const fn = decls.find((d) => d.name === "sum");
    expect(fn).toBeDefined();
    expect(fn!.kind).toBe("function");
    expect(fn!.startLine).toBe(2);
    expect(fn!.text).toContain("return a + b");
  });

  it("extracts classes and methods", () => {
    const src = "class Calc {\n  add(a, b) { return a + b; }\n}\n";
    const decls = adapter.parseDeclarations(src);
    expect(decls.some((d) => d.kind === "class" && d.name === "Calc")).toBe(true);
    expect(decls.some((d) => d.kind === "method" && d.name === "add")).toBe(true);
  });

  it("extracts comments with line numbers", () => {
    const src = "// hello\nfunction x() {}\n";
    const comments = adapter.parseComments(src);
    expect(comments).toHaveLength(1);
    expect(comments[0]!.startLine).toBe(1);
    expect(comments[0]!.text).toContain("hello");
  });

  it("lists statement ranges inside function bodies", () => {
    const src = "function test() {\n  doWork();\n  return 1;\n}\n";
    const stmts = adapter.parseStatements(src);
    expect(stmts.length).toBeGreaterThanOrEqual(2);
    expect(src.slice(stmts[0]!.startIndex, stmts[0]!.endIndex)).toContain("doWork");
    expect(src.slice(stmts[1]!.startIndex, stmts[1]!.endIndex)).toContain("return");
  });
});
