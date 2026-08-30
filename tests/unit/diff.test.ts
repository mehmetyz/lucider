import { describe, it, expect } from "vitest";
import { parseUnifiedDiff } from "../../src/core/diff.js";

const sample = `
diff --git a/src/auth.js b/src/auth.js
index 111..222 100644
--- a/src/auth.js
+++ b/src/auth.js
@@ -3,7 +3,8 @@
 export function login(email, password) {
   const hash = hashPassword(password);
-  return issueToken(email, hash);
+  const token = issueToken(email, hash);
+  return token;
 }
`.trim();

describe("parseUnifiedDiff", () => {
  it("maps added lines to inclusive new-file ranges", () => {
    const ranges = parseUnifiedDiff(sample);
    expect(ranges).toEqual([{ file: "src/auth.js", startLine: 5, endLine: 6 }]);
  });

  it("seeds a deletion-only hunk at the new-file insertion line", () => {
    const diff = [
      "--- a/a.js",
      "+++ b/a.js",
      "@@ -4,1 +4,0 @@",
      "-removed()",
    ].join("\n");
    expect(parseUnifiedDiff(diff)).toEqual([{ file: "a.js", startLine: 4, endLine: 4 }]);
  });
});
