#!/usr/bin/env node
/**
 * Fail the build if the npm tarball contains anything beyond the public API.
 * Run after `pnpm build`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ALLOWED = /^(package\.json|LICENSE|README\.md|dist\/.+\.(js|d\.ts))$/;
const REQUIRED = ["package.json", "LICENSE", "README.md", "dist/index.js", "dist/cli/index.js"];
const FORBIDDEN = /\.(env|pem|key)$|node_modules|\.git\/|src\/|tests\/|specs\/|\.cursor\/|context\.json/;

const raw = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const parsed = JSON.parse(raw);
const files = (parsed[0]?.files ?? parsed.files ?? []).map((f) => f.path || f);
const names = files.map(String).sort();

const extra = names.filter((p) => !ALLOWED.test(p) || FORBIDDEN.test(p));
if (extra.length) {
  console.error("npm pack contains unexpected files:\n" + extra.map((p) => `  ${p}`).join("\n"));
  process.exit(1);
}

const missing = REQUIRED.filter((p) => !names.includes(p));
if (missing.length) {
  console.error("npm pack is missing required files:\n" + missing.map((p) => `  ${p}`).join("\n"));
  process.exit(1);
}

const cli = readFileSync("dist/cli/index.js", "utf8");
if (!cli.startsWith("#!/usr/bin/env node")) {
  console.error("dist/cli/index.js is missing the node shebang");
  process.exit(1);
}

console.log(`pack ok: ${names.length} files (API only)`);
