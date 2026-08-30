import { describe, it, expect } from "vitest";
import { TypeScriptAdapter, TsxAdapter } from "../../src/parsers/typescript.js";

describe("TypeScriptAdapter", () => {
  const adapter = new TypeScriptAdapter();

  it("declares .ts extensions", () => {
    expect(adapter.extensions).toContain(".ts");
  });

  it("extracts typed function declarations", () => {
    const src = "// ai-context: adds\nfunction sum(a: number, b: number): number {\n  return a + b;\n}\n";
    const decls = adapter.parseDeclarations(src);
    const fn = decls.find((d) => d.name === "sum");
    expect(fn).toBeDefined();
    expect(fn!.kind).toBe("function");
  });

  it("extracts classes, methods, and interfaces", () => {
    const src =
      "interface Shape { area(): number }\n" +
      "class Circle {\n  radius = 1;\n  area(): number { return 3.14 * this.radius ** 2; }\n}\n";
    const decls = adapter.parseDeclarations(src);
    expect(decls.some((d) => d.kind === "interface" && d.name === "Shape")).toBe(true);
    expect(decls.some((d) => d.kind === "class" && d.name === "Circle")).toBe(true);
    expect(decls.some((d) => d.kind === "method" && d.name === "area")).toBe(true);
  });

  it("extracts comments", () => {
    const comments = adapter.parseComments("// hey\nconst x: number = 1;\n");
    expect(comments[0]!.text).toContain("hey");
  });
});

describe("TsxAdapter", () => {
  it("parses .tsx and declares its extension", () => {
    const adapter = new TsxAdapter();
    expect(adapter.extensions).toContain(".tsx");
    const decls = adapter.parseDeclarations("function App() { return null; }\n");
    expect(decls.some((d) => d.name === "App")).toBe(true);
  });
});
