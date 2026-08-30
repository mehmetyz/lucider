import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNodes } from "../../src/core/nodes.js";
import { buildArtifact } from "../../src/core/pipeline.js";
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

describe("unmarked examples/shop bodies (FR-010)", () => {
  it("publishes declaration text unchanged when there is no interior ignore", () => {
    const shopDir = fileURLToPath(new URL("../../examples/shop/", import.meta.url));
    const files = ["auth.js", "cart.js"];
    const adapter = new JavaScriptAdapter();
    const entries = files.map((name) => {
      const file = `examples/shop/${name}`;
      const source = readFileSync(join(shopDir, name), "utf8");
      return { file, source };
    });

    const artifact = buildArtifact({
      generatedFrom: "examples/shop",
      entries,
      adapter,
      prefix: "ai",
      defaultBody: "on",
    });

    for (const entry of entries) {
      const decls = adapter.parseDeclarations(entry.source);
      for (const node of artifact.nodes.filter((n) => n.location.file === entry.file)) {
        if (!node.bodyIncluded || node.body === null) continue;
        const decl = decls.find(
          (d) => d.name === node.name && d.kind === node.kind && d.startLine === node.location.startLine,
        );
        expect(decl, `${node.id} should match a declaration`).toBeDefined();
        expect(node.body).toBe(decl!.text);
      }
    }
  });
});
