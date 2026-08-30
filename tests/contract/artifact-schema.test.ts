import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import { buildArtifact } from "../../src/core/pipeline.js";
import { JavaScriptAdapter } from "../../src/parsers/javascript.js";
import { GRAMMAR_VERSION } from "../../src/directives/grammar.js";

const schemaPath = fileURLToPath(
  new URL("../../specs/001-ai-context-graph/contracts/artifact.schema.json", import.meta.url),
);
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

describe("contract: artifact schema", () => {
  it("produces output that validates against artifact.schema.json", () => {
    const source =
      "// ai-context: adds\n// ai-body: off\nfunction sum(a, b) { return a + b; }\n" +
      "class Calc {\n  // ai-context: multiplies\n  mul(a, b) { return a * b; }\n}\n";

    const artifact = buildArtifact({
      generatedFrom: "mixed.js",
      entries: [{ file: "mixed.js", source }],
      adapter: new JavaScriptAdapter(),
      prefix: "ai",
      defaultBody: "on",
    });

    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const valid = validate(artifact);
    if (!valid) {
      throw new Error(
        "Schema validation failed: " + JSON.stringify(validate.errors, null, 2),
      );
    }
    expect(valid).toBe(true);
  });

  it("reports grammarVersion 1.2.0", () => {
    const artifact = buildArtifact({
      generatedFrom: "t.js",
      entries: [{ file: "t.js", source: "function f() { return 1; }\n" }],
      adapter: new JavaScriptAdapter(),
      prefix: "ai",
      defaultBody: "on",
    });
    expect(GRAMMAR_VERSION).toBe("1.2.0");
    expect(artifact.grammarVersion).toBe("1.2.0");
  });
});
