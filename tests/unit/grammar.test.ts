import { describe, it, expect } from "vitest";
import { GRAMMAR_VERSION, extractDirectives } from "../../src/directives/grammar.js";
import type { CommentNode } from "../../src/parsers/adapter.js";

function lineComment(text: string, line: number): CommentNode {
  return { text, startLine: line, endLine: line, startIndex: 0, endIndex: text.length };
}

describe("grammar", () => {
  it("exposes a semver grammar version", () => {
    expect(GRAMMAR_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("parses a line-comment directive", () => {
    const [d] = extractDirectives(lineComment("// ai-context: sums two numbers", 3), "ai");
    expect(d).toMatchObject({
      key: "context",
      value: "sums two numbers",
      prefix: "ai",
    });
    expect(d!.location.startLine).toBe(3);
  });

  it("parses a single-line block-comment directive", () => {
    const [d] = extractDirectives(lineComment("/* ai-body: off */", 5), "ai");
    expect(d).toMatchObject({ key: "body", value: "off" });
  });

  it("parses multiple directives inside a multi-line block comment with correct line offsets", () => {
    const block: CommentNode = {
      text: "/*\n ai-context: does things\n ai-body: off\n*/",
      startLine: 10,
      endLine: 13,
      startIndex: 0,
      endIndex: 40,
    };
    const ds = extractDirectives(block, "ai");
    expect(ds.map((d) => d.key)).toEqual(["context", "body"]);
    expect(ds[0]!.location.startLine).toBe(11);
    expect(ds[1]!.location.startLine).toBe(12);
  });

  it("flags an empty value as malformed", () => {
    const [d] = extractDirectives(lineComment("// ai-context:", 1), "ai");
    expect(d!.status).toBe("malformed");
  });

  it("ignores non-directive comments", () => {
    expect(extractDirectives(lineComment("// just a normal comment", 1), "ai")).toHaveLength(0);
  });

  it("respects a custom prefix", () => {
    const [d] = extractDirectives(lineComment("// doc-context: hi", 1), "doc");
    expect(d).toMatchObject({ prefix: "doc", key: "context", value: "hi" });
  });
});
